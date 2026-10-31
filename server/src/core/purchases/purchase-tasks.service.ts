import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { toPage, type PaginationQueryDto } from '../../common/pagination/pagination.js';
import type { EmailMessage } from '../../integrations/dummy/dummy-email.sender.js';
import type { AuthUser } from '../access/auth-user.js';
import { auditChanges, auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { LegalTeamsService } from '../legal/legal-teams.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import type { CreateTaskDto, UpdateTaskDto } from './dto/purchase.dto.js';
import type { PurchaseTaskDto, PurchaseTaskListDto } from './dto/purchase-response.dto.js';
import type { TaskStatus } from './entities/purchase-task.entity.js';
import { PurchaseAccessService } from './purchase-access.service.js';
import { toTaskDto } from './purchases.mapper.js';
import { PurchasesRepository } from './purchases.repository.js';

/** Dozvoljeni prelazi statusa zadatka (F-13, P11). DONE i REJECTED su konačni. */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  NEW: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['WAITING', 'DONE', 'REJECTED'],
  WAITING: ['IN_PROGRESS', 'DONE', 'REJECTED'],
  DONE: [],
  REJECTED: [],
};

const OPEN_STATUSES: readonly TaskStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING'];

/** Zadaci na kupovini (F-13, F-31): advokat i inženjer rade, koordinator i vodeći advokat dodeljuju. */
@Injectable()
export class PurchaseTasksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly purchases: PurchasesRepository,
    private readonly access: PurchaseAccessService,
    private readonly legalTeams: LegalTeamsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthUser, purchaseId: string, dto: CreateTaskDto): Promise<PurchaseTaskDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseTaskDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.getForUpdate(manager, purchaseId, actor);
      const { purchase } = access;
      // Zadatke dodeljuju koordinator, naš tim i vodeći advokat tima na kupovini.
      const canAssign = access.relations.has('COORDINATOR') || access.relations.has('INTERNAL') || access.legalTeamRole === 'LEAD';
      if (!canAssign) throw new ApiError(ApiErrorCode.Forbidden);
      if (purchase.status !== 'ACTIVE' && purchase.status !== 'BLOCKED') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      // Izvršilac mora biti advokat iz tima kupovine ili inženjer kupovine.
      let legalTeamId: string | null = null;
      if (dto.assigneeUserId === purchase.engineerId) {
        legalTeamId = null;
      } else if (purchase.legalTeamId && (await this.legalTeams.memberRole(manager, purchase.legalTeamId, dto.assigneeUserId))) {
        legalTeamId = purchase.legalTeamId;
      } else {
        throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['assigneeUserId'] });
      }

      const task = await this.purchases.insertTask(manager, {
        market: purchase.market,
        purchaseId: purchase.id,
        type: dto.type,
        title: dto.title.trim(),
        assigneeUserId: dto.assigneeUserId,
        legalTeamId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        createdById: actor.id,
      });
      await this.audit.record(manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'purchase.task.created',
        entityType: 'purchase_task',
        entityId: task.id,
        data: {
          purchaseId: purchase.id,
          type: dto.type,
          assigneeUserId: dto.assigneeUserId,
          changes: auditInitial(task, ['type', 'title', 'assigneeUserId', 'legalTeamId', 'dueAt', 'status']),
        },
      });
      if (dto.assigneeUserId !== actor.id) {
        emails = await this.notifications.notify(manager, [
          {
            userId: dto.assigneeUserId,
            type: 'task.assigned',
            title: 'Nov zadatak',
            body: dto.title.trim(),
            link: `/purchases/${purchase.id}`,
          },
        ]);
      }
      result = toTaskDto(task);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  async update(actor: AuthUser, taskId: string, dto: UpdateTaskDto): Promise<PurchaseTaskDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseTaskDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const task = await this.purchases.findTaskForUpdate(manager, taskId);
      if (!task) throw new ApiError(ApiErrorCode.NotFound);
      // Pristup kupovini zadatka; nepovezani dobijaju NOT_FOUND.
      const access = await this.access.get(manager, task.purchaseId, actor);
      const isAssignee = task.assigneeUserId === actor.id;
      const isLead = access.legalTeamRole === 'LEAD' && task.legalTeamId === access.purchase.legalTeamId;
      if (!isAssignee && !isLead && !this.access.isAdmin(access)) throw new ApiError(ApiErrorCode.Forbidden);

      if (dto.status !== task.status && !TRANSITIONS[task.status].includes(dto.status)) {
        throw new ApiError(ApiErrorCode.InvalidStateTransition);
      }
      if (dto.status === 'WAITING' && !dto.waitingReason) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['waitingReason'] });
      if (dto.documentId && !(await this.purchases.findPurchaseDocument(manager, dto.documentId, task.purchaseId))) {
        throw new ApiError(ApiErrorCode.NotFound);
      }

      const finished = dto.status === 'DONE' || dto.status === 'REJECTED';
      const now = new Date();
      const patch = {
        status: dto.status,
        waitingReason: dto.status === 'WAITING' ? (dto.waitingReason ?? null) : null,
        result: dto.result ?? task.result,
        documentId: dto.documentId ?? task.documentId,
        completedAt: finished ? now : null,
      };
      await this.purchases.updateTask(manager, task.id, patch);
      await this.audit.record(manager, {
        market: task.market,
        actorId: actor.id,
        action: 'purchase.task.updated',
        entityType: 'purchase_task',
        entityId: task.id,
        data: {
          purchaseId: task.purchaseId,
          changes: auditChanges(task, patch, ['status', 'waitingReason', 'result', 'documentId', 'completedAt']),
        },
      });

      const drafts: NotificationDraft[] = [];
      const { coordinatorId } = access.purchase;
      if (finished && coordinatorId && coordinatorId !== actor.id) {
        drafts.push({
          userId: coordinatorId,
          type: 'task.finished',
          title: dto.status === 'DONE' ? 'Zadatak je završen' : 'Zadatak je odbijen',
          body: task.title,
          link: `/purchases/${task.purchaseId}`,
        });
      }
      emails = await this.notifications.notify(manager, drafts);

      const updated = await this.purchases.findTask(manager, task.id);
      if (!updated) throw new ApiError(ApiErrorCode.NotFound);
      result = toTaskDto(updated);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  async listForPurchase(actor: AuthUser, purchaseId: string, query: PaginationQueryDto): Promise<PurchaseTaskListDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await this.access.get(queryRunner.manager, purchaseId, actor);
      const [tasks, total] = await this.purchases.listTasksForPurchase(queryRunner.manager, purchaseId, query);
      return toPage(tasks.map(toTaskDto), total, query);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async listMine(actor: AuthUser, query: PaginationQueryDto): Promise<PurchaseTaskListDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [tasks, total] = await this.purchases.listTasksForAssignee(queryRunner.manager, actor.id, OPEN_STATUSES, query);
      return toPage(tasks.map(toTaskDto), total, query);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}

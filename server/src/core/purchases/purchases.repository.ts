import { Injectable } from '@nestjs/common';
import { Brackets, In, type EntityManager } from 'typeorm';
import type { PaginationQueryDto } from '../../common/pagination/pagination.js';
import type { MarketCode } from '../../markets/market-code.js';
import { Document } from '../documents/entities/document.entity.js';
import { LegalOpinion } from '../legal/entities/legal-opinion.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PurchaseMessage } from './entities/purchase-message.entity.js';
import { PurchaseStep, type StepStatus } from './entities/purchase-step.entity.js';
import { PurchaseTask, type TaskStatus } from './entities/purchase-task.entity.js';
import { Purchase, type PurchaseStatus } from './entities/purchase.entity.js';

export interface NewPurchase {
  market: MarketCode;
  packVersion: string;
  buyerId: string;
  unitId: string;
  projectId: string;
  developerId: string;
  coordinatorId: string | null;
  requestId: string | null;
}

export interface NewStep {
  stepCode: string;
  phase: string;
  position: number;
}

/** Kome je kupovina vidljiva u listi (F-01). Uslovi se spajaju sa OR. */
export interface PurchaseVisibility {
  buyerId?: string;
  coordinatorId?: string;
  internalMarkets?: readonly MarketCode[];
  legalTeamIds?: readonly string[];
  engineerId?: string;
  escrowAgentId?: string;
}

export interface PurchaseListFilter {
  status?: PurchaseStatus;
  market?: MarketCode;
  limit: number;
  offset: number;
}

/** Osnovni podaci o korisniku za prikaz na kupovini (bez lozinke i internih polja). */
export interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

type PageWindow = Pick<PaginationQueryDto, 'limit' | 'offset'>;

@Injectable()
export class PurchasesRepository {
  // ---- Kupovina ----

  async insertPurchase(manager: EntityManager, data: NewPurchase): Promise<string> {
    const result = await manager.getRepository(Purchase).insert({ ...data, status: 'ACTIVE' });
    return (result.identifiers[0] as { id: string }).id;
  }

  async updatePurchase(
    manager: EntityManager,
    id: string,
    data: Partial<
      Pick<Purchase, 'status' | 'blockReason' | 'closedAt' | 'coordinatorId' | 'legalTeamId' | 'lawyerId' | 'engineerId' | 'escrowAgentId'>
    >,
  ): Promise<void> {
    await manager.getRepository(Purchase).update({ id }, data);
  }

  findDetail(manager: EntityManager, id: string): Promise<Purchase | null> {
    return manager.getRepository(Purchase).findOne({
      where: { id },
      relations: { unit: { project: { developer: true } }, steps: true },
      order: { steps: { position: 'ASC' } },
    });
  }

  list(manager: EntityManager, visibility: PurchaseVisibility, filter: PurchaseListFilter): Promise<[Purchase[], number]> {
    const query = manager
      .getRepository(Purchase)
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.unit', 'unit')
      .leftJoinAndSelect('unit.project', 'project')
      .leftJoinAndSelect('purchase.steps', 'step')
      .where(
        new Brackets((where) => {
          where.where('1 = 0');
          if (visibility.buyerId) where.orWhere('purchase.buyerId = :buyerId', { buyerId: visibility.buyerId });
          if (visibility.coordinatorId) {
            where.orWhere('purchase.coordinatorId = :coordinatorId', { coordinatorId: visibility.coordinatorId });
          }
          if (visibility.internalMarkets?.length) {
            where.orWhere('purchase.market IN (:...internalMarkets)', { internalMarkets: [...visibility.internalMarkets] });
          }
          if (visibility.legalTeamIds?.length) {
            where.orWhere('purchase.legalTeamId IN (:...legalTeamIds)', { legalTeamIds: [...visibility.legalTeamIds] });
          }
          if (visibility.engineerId) where.orWhere('purchase.engineerId = :engineerId', { engineerId: visibility.engineerId });
          if (visibility.escrowAgentId) {
            where.orWhere('purchase.escrowAgentId = :escrowAgentId', { escrowAgentId: visibility.escrowAgentId });
          }
        }),
      )
      .orderBy('purchase.createdAt', 'DESC')
      .addOrderBy('purchase.id', 'ASC')
      .addOrderBy('step.position', 'ASC')
      .take(filter.limit)
      .skip(filter.offset);
    if (filter.status) query.andWhere('purchase.status = :status', { status: filter.status });
    if (filter.market) query.andWhere('purchase.market = :market', { market: filter.market });
    return query.getManyAndCount();
  }

  // ---- Koraci ----

  async insertSteps(manager: EntityManager, purchaseId: string, steps: readonly NewStep[]): Promise<void> {
    if (steps.length === 0) return;
    await manager.getRepository(PurchaseStep).insert(steps.map((step) => ({ ...step, purchaseId, status: 'PENDING' as const })));
  }

  findSteps(manager: EntityManager, purchaseId: string): Promise<PurchaseStep[]> {
    return manager.getRepository(PurchaseStep).find({ where: { purchaseId }, order: { position: 'ASC' } });
  }

  async updateStep(
    manager: EntityManager,
    id: string,
    data: { status: StepStatus; completedAt: Date; completedById: string; note: string | null },
  ): Promise<void> {
    await manager.getRepository(PurchaseStep).update({ id }, data);
  }

  // ---- Zadaci ----

  async insertTask(
    manager: EntityManager,
    data: Pick<PurchaseTask, 'market' | 'purchaseId' | 'type' | 'title' | 'assigneeUserId' | 'legalTeamId' | 'dueAt' | 'createdById'>,
  ): Promise<PurchaseTask> {
    const repository = manager.getRepository(PurchaseTask);
    const result = await repository.insert({ ...data, status: 'NEW' });
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findTaskForUpdate(manager: EntityManager, id: string): Promise<PurchaseTask | null> {
    return manager.getRepository(PurchaseTask).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  findTask(manager: EntityManager, id: string): Promise<PurchaseTask | null> {
    return manager.getRepository(PurchaseTask).findOne({ where: { id } });
  }

  async updateTask(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<PurchaseTask, 'status' | 'waitingReason' | 'result' | 'documentId' | 'completedAt'>>,
  ): Promise<void> {
    await manager.getRepository(PurchaseTask).update({ id }, data);
  }

  listTasksForPurchase(manager: EntityManager, purchaseId: string, page: PageWindow): Promise<[PurchaseTask[], number]> {
    return manager.getRepository(PurchaseTask).findAndCount({
      where: { purchaseId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  listTasksForAssignee(
    manager: EntityManager,
    userId: string,
    statuses: readonly TaskStatus[],
    page: PageWindow,
  ): Promise<[PurchaseTask[], number]> {
    return manager
      .getRepository(PurchaseTask)
      .createQueryBuilder('task')
      .where('task.assigneeUserId = :userId', { userId })
      .andWhere('task.status IN (:...statuses)', { statuses: [...statuses] })
      .orderBy('task.dueAt', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'ASC')
      .addOrderBy('task.id', 'ASC')
      .take(page.limit)
      .skip(page.offset)
      .getManyAndCount();
  }

  // ---- Poruke ----

  async insertMessage(manager: EntityManager, data: Pick<PurchaseMessage, 'purchaseId' | 'authorId' | 'body' | 'internal'>): Promise<PurchaseMessage> {
    const repository = manager.getRepository(PurchaseMessage);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  listMessages(manager: EntityManager, purchaseId: string, includeInternal: boolean): Promise<PurchaseMessage[]> {
    return manager.getRepository(PurchaseMessage).find({
      where: includeInternal ? { purchaseId } : { purchaseId, internal: false },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  // ---- Čitanja iz drugih tabela, samo za proveru (bez upisa) ----

  /** Da li postoji pravno mišljenje koje dozvoljava potpis (F-12). */
  async hasPositiveOpinion(manager: EntityManager, purchaseId: string): Promise<boolean> {
    const count = await manager
      .getRepository(LegalOpinion)
      .count({ where: { purchaseId, conclusion: In(['SIGN', 'SIGN_WITH_CONDITIONS']) } });
    return count > 0;
  }

  /** Dokument koji pripada kupovini (zadaci prilažu dokument iz trezora). */
  findPurchaseDocument(manager: EntityManager, documentId: string, purchaseId: string): Promise<Document | null> {
    return manager.getRepository(Document).findOne({ where: { id: documentId, purchaseId } });
  }

  findPeople(manager: EntityManager, ids: readonly string[]): Promise<PersonRow[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return Promise.resolve([]);
    return manager.getRepository(User).find({
      select: { id: true, firstName: true, lastName: true, email: true },
      where: { id: In(unique) },
    });
  }
}

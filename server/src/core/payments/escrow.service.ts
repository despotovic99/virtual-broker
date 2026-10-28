/*
 * Escrow (F-15, samo tržišta sa modelom ESCROW).
 * DUMMY: stvarna isplata se radi u banci escrow partnera, van platforme.
 * Escrow partner ovde samo potvrđuje izvršenje ili vraća instrukciju.
 * TODO(integracija): API banke ili trust kompanije za instrukcije i potvrde.
 */
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import { PurchaseAccessService } from '../purchases/purchase-access.service.js';
import type { EscrowInstruction } from './entities/escrow-instruction.entity.js';
import type { Installment } from './entities/installment.entity.js';
import { EscrowRepository } from './escrow.repository.js';
import { PaymentsRepository } from './payments.repository.js';

export interface EscrowInstructionResponse {
  id: string;
  purchaseId: string;
  installmentId: string;
  amount: number;
  status: EscrowInstruction['status'];
  /** Račun primaoca. Vide ga samo naš tim i escrow partner. */
  recipient: { iban: string; bankName: string; holderName: string } | null;
  firstApproverId: string | null;
  secondApproverId: string | null;
  executedAt: string | null;
  returnReason: string | null;
  createdAt: string;
}

function toResponse(instruction: EscrowInstruction): EscrowInstructionResponse {
  const account = instruction.bankAccount;
  return {
    id: instruction.id,
    purchaseId: instruction.purchaseId,
    installmentId: instruction.installmentId,
    amount: instruction.amount,
    status: instruction.status,
    recipient: account ? { iban: account.iban, bankName: account.bankName, holderName: account.holderName } : null,
    firstApproverId: instruction.firstApproverId,
    secondApproverId: instruction.secondApproverId,
    executedAt: instruction.executedAt ? instruction.executedAt.toISOString() : null,
    returnReason: instruction.returnReason,
    createdAt: instruction.createdAt.toISOString(),
  };
}

@Injectable()
export class EscrowService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly escrow: EscrowRepository,
    private readonly payments: PaymentsRepository,
    private readonly markets: MarketRegistry,
    private readonly purchaseAccess: PurchaseAccessService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser): Promise<EscrowInstructionResponse[]> {
    const internal = hasRole(actor, Role.Admin, Role.Analyst, Role.Coordinator);
    const agent = hasRole(actor, Role.EscrowAgent);
    if (!internal && !agent) throw new ApiError(ApiErrorCode.Forbidden);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const instructions = await this.escrow.list(
        queryRunner.manager,
        internal ? { markets: actor.markets } : { escrowAgentId: actor.id },
      );
      return instructions.map(toResponse);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Odobrenje instrukcije: dva različita admina na tržištu (princip četiri oka). */
  async approve(actor: AuthUser, id: string): Promise<EscrowInstructionResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const instruction = await this.escrow.findForUpdate(queryRunner.manager, id);
      if (!instruction || !hasMarketAccess(actor, instruction.market)) throw new ApiError(ApiErrorCode.NotFound);
      this.assertEscrowMarket(instruction.market);
      if (!hasRole(actor, Role.Admin)) throw new ApiError(ApiErrorCode.Forbidden);
      if (instruction.status !== 'PENDING_APPROVAL') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      const now = new Date();
      const drafts: NotificationDraft[] = [];
      if (!instruction.firstApproverId) {
        await this.escrow.update(queryRunner.manager, id, { firstApproverId: actor.id, firstApprovedAt: now });
      } else {
        if (instruction.firstApproverId === actor.id) throw new ApiError(ApiErrorCode.EscrowSameApprover);
        await this.escrow.update(queryRunner.manager, id, { secondApproverId: actor.id, secondApprovedAt: now, status: 'APPROVED' });
        const { purchase } = await this.purchaseAccess.get(queryRunner.manager, instruction.purchaseId, actor);
        if (purchase.escrowAgentId) {
          drafts.push({
            userId: purchase.escrowAgentId,
            type: 'escrow.instruction.approved',
            title: 'Instrukcija za isplatu je odobrena',
            body: `Instrukcija za isplatu ${instruction.amount} € je odobrena i čeka izvršenje.`,
            link: '/escrow',
          });
        }
      }
      await this.audit.record(queryRunner.manager, {
        market: instruction.market,
        actorId: actor.id,
        action: instruction.firstApproverId ? 'escrow.instruction.approved' : 'escrow.instruction.first-approval',
        entityType: 'escrow_instruction',
        entityId: id,
        data: { purchaseId: instruction.purchaseId, amount: instruction.amount },
      });
      const emails = await this.notifications.notify(queryRunner.manager, drafts);
      const fresh = await this.escrow.findWithAccount(queryRunner.manager, id);
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toResponse(fresh as EscrowInstruction);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Escrow partner potvrđuje da je isplatio investitoru. Rata postaje RELEASED. */
  async execute(actor: AuthUser, id: string): Promise<EscrowInstructionResponse> {
    return this.finish(actor, id, 'EXECUTED', null);
  }

  /** Escrow partner vraća instrukciju uz razlog (npr. račun se ne poklapa). */
  async returnInstruction(actor: AuthUser, id: string, reason: string): Promise<EscrowInstructionResponse> {
    return this.finish(actor, id, 'RETURNED', reason.trim());
  }

  // ---- Učestvuje u tuđoj transakciji (PaymentsService) ----

  /** Pravi instrukciju za isplatu plaćene rate na poslednji provereni račun investitora. */
  async createInstruction(manager: EntityManager, installment: Installment, developerId: string, actorId: string): Promise<string> {
    this.assertEscrowMarket(installment.market);
    const account = await this.catalog.findLatestVerifiedAccount(manager, developerId);
    if (!account) throw new ApiError(ApiErrorCode.BankAccountNotVerified);
    const id = await this.escrow.insert(manager, {
      market: installment.market,
      installmentId: installment.id,
      purchaseId: installment.purchaseId,
      amount: installment.amount,
      bankAccountId: account.id,
      createdById: actorId,
    });
    await this.audit.record(manager, {
      market: installment.market,
      actorId,
      action: 'escrow.instruction.created',
      entityType: 'escrow_instruction',
      entityId: id,
      data: { purchaseId: installment.purchaseId, amount: installment.amount },
    });
    return id;
  }

  private async finish(
    actor: AuthUser,
    id: string,
    status: 'EXECUTED' | 'RETURNED',
    reason: string | null,
  ): Promise<EscrowInstructionResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const instruction = await this.escrow.findForUpdate(queryRunner.manager, id);
      if (!instruction) throw new ApiError(ApiErrorCode.NotFound);
      const access = await this.purchaseAccess.get(queryRunner.manager, instruction.purchaseId, actor);
      this.purchaseAccess.require(access, 'ESCROW');
      this.assertEscrowMarket(instruction.market);

      const allowedFrom = status === 'EXECUTED' ? ['APPROVED'] : ['APPROVED', 'PENDING_APPROVAL'];
      if (!allowedFrom.includes(instruction.status)) throw new ApiError(ApiErrorCode.InvalidStateTransition);

      const now = new Date();
      const { purchase } = access;
      const drafts: NotificationDraft[] = [];
      if (status === 'EXECUTED') {
        await this.escrow.update(queryRunner.manager, id, { status, executedById: actor.id, executedAt: now });
        const installment = await this.payments.findForUpdate(queryRunner.manager, instruction.installmentId);
        if (!installment || installment.status !== 'PAID') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.payments.updateInstallment(queryRunner.manager, installment.id, { status: 'RELEASED' });
        drafts.push({
          userId: purchase.buyerId,
          type: 'escrow.instruction.executed',
          title: 'Isplata investitoru je izvršena',
          body: `Escrow partner je isplatio ratu ${installment.sequence} investitoru.`,
          link: `/purchases/${purchase.id}`,
        });
      } else {
        await this.escrow.update(queryRunner.manager, id, { status, returnReason: reason });
      }
      if (purchase.coordinatorId) {
        drafts.push({
          userId: purchase.coordinatorId,
          type: status === 'EXECUTED' ? 'escrow.instruction.executed' : 'escrow.instruction.returned',
          title: status === 'EXECUTED' ? 'Escrow isplata izvršena' : 'Escrow instrukcija vraćena',
          body: status === 'EXECUTED' ? 'Escrow partner je potvrdio isplatu.' : 'Escrow partner je vratio instrukciju; razlog je u aplikaciji.',
          link: `/purchases/${purchase.id}`,
        });
      }
      await this.audit.record(queryRunner.manager, {
        market: instruction.market,
        actorId: actor.id,
        action: status === 'EXECUTED' ? 'escrow.instruction.executed' : 'escrow.instruction.returned',
        entityType: 'escrow_instruction',
        entityId: id,
        data: { purchaseId: instruction.purchaseId, amount: instruction.amount },
      });
      const emails = await this.notifications.notify(queryRunner.manager, drafts);
      const fresh = await this.escrow.findWithAccount(queryRunner.manager, id);
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toResponse(fresh as EscrowInstruction);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  private assertEscrowMarket(market: EscrowInstruction['market']): void {
    if (this.markets.get(market).moneyModel !== 'ESCROW') throw new ApiError(ApiErrorCode.EscrowNotUsed);
  }
}

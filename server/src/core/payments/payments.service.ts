import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { MarketPack, PaymentConditionDefinition } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuthUser } from '../access/auth-user.js';
import { Role } from '../access/role.enum.js';
import { auditChanges, auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import type { Purchase } from '../purchases/entities/purchase.entity.js';
import { PurchaseAccessService, type PurchaseAccess, type PurchaseRelation } from '../purchases/purchase-access.service.js';
import type { ConfirmConditionDto, RecordPaymentDto, ReplacePaymentPlanDto } from './dto/payments.dto.js';
import type { InstallmentCondition } from './entities/installment-condition.entity.js';
import type { Installment } from './entities/installment.entity.js';
import { toInstallmentResponse, type InstallmentResponse, type PaymentPlanResponse } from './payments.mapper.js';
import { PaymentsRepository } from './payments.repository.js';
import { EscrowService } from './escrow.service.js';

/** Koja veza sa kupovinom važi za potvrdu uslova, po ulozi iz paketa tržišta. */
const RELATION_FOR_CONFIRMER: Partial<Record<Role, PurchaseRelation>> = {
  [Role.Lawyer]: 'LAWYER',
  [Role.Engineer]: 'ENGINEER',
  [Role.Analyst]: 'INTERNAL',
  [Role.Coordinator]: 'INTERNAL',
  [Role.Admin]: 'INTERNAL',
};

function conditionApplies(definition: PaymentConditionDefinition, installment: { sequence: number; phaseCode: string | null; isFinal: boolean }): boolean {
  switch (definition.appliesTo) {
    case 'FIRST':
      return installment.sequence === 1;
    case 'EVERY':
      return true;
    case 'PHASE':
      return installment.phaseCode !== null;
    case 'LAST':
      return installment.isFinal;
  }
}

/**
 * Novac (F-14 – F-16): plan uplata, uslovi pre uplate i uplate. Mi nikad ne
 * držimo novac kupca. Model novca (ESCROW ili GATE) dolazi iz paketa tržišta.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsRepository,
    private readonly markets: MarketRegistry,
    private readonly purchaseAccess: PurchaseAccessService,
    private readonly catalog: CatalogService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly escrow: EscrowService,
  ) {}

  async getPlan(actor: AuthUser, purchaseId: string): Promise<PaymentPlanResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const { purchase } = await this.purchaseAccess.get(queryRunner.manager, purchaseId, actor);
      const installments = await this.payments.listForPurchase(queryRunner.manager, purchase.id);
      return this.toPlan(purchase, installments);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Zamenjuje ceo plan uplata dok nijedna rata nije plaćena (koordinator ili naš tim). */
  async replacePlan(actor: AuthUser, purchaseId: string, dto: ReplacePaymentPlanDto): Promise<PaymentPlanResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const access = await this.purchaseAccess.getForUpdate(queryRunner.manager, purchaseId, actor);
      this.purchaseAccess.require(access, 'COORDINATOR', 'INTERNAL');
      const { purchase } = access;
      this.assertActive(purchase);

      const pack = this.markets.get(purchase.market);
      const phaseCodes = new Set(pack.constructionPhases.map((phase) => phase.code));
      const invalidPhases = dto.installments
        .map((installment, index) => (installment.phaseCode && !phaseCodes.has(installment.phaseCode) ? `installments.${index}.phaseCode` : null))
        .filter((field): field is string => field !== null);
      if (invalidPhases.length > 0) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: invalidPhases });

      // Plan mora da pokrije tačno cenu stana: ni manje (deo cene bez uslova) ni više.
      const unit = await this.catalog.getUnit(queryRunner.manager, purchase.unitId);
      const planTotal = dto.installments.reduce((sum, installment) => sum + installment.amount, 0);
      if (planTotal !== Number(unit.price)) {
        throw new ApiError(ApiErrorCode.PaymentPlanTotalMismatch, { planTotal, unitPrice: Number(unit.price) });
      }

      const existing = await this.payments.listForPurchaseForUpdate(queryRunner.manager, purchase.id);
      if (existing.some((installment) => installment.status === 'PAID' || installment.status === 'RELEASED')) {
        throw new ApiError(ApiErrorCode.InvalidStateTransition);
      }
      await this.payments.deleteForPurchase(queryRunner.manager, purchase.id);

      const lastIndex = dto.installments.length - 1;
      for (const [index, input] of dto.installments.entries()) {
        const shape = { sequence: index + 1, phaseCode: input.phaseCode ?? null, isFinal: index === lastIndex };
        const codes = pack.paymentConditions.filter((definition) => conditionApplies(definition, shape)).map((definition) => definition.code);
        const installmentId = await this.payments.insertInstallment(queryRunner.manager, {
          market: purchase.market,
          purchaseId: purchase.id,
          ...shape,
          label: input.label.trim(),
          amount: input.amount,
          dueDate: input.dueDate ?? null,
          status: codes.length === 0 ? 'READY' : 'LOCKED',
        });
        await this.payments.insertConditions(queryRunner.manager, installmentId, codes);
      }

      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'payments.plan.replaced',
        entityType: 'purchase',
        entityId: purchase.id,
        data: {
          purchaseId: purchase.id,
          installments: dto.installments.length,
          total: planTotal,
          changes: auditChanges(
            { installments: existing.length, total: existing.reduce((sum, item) => sum + Number(item.amount), 0) },
            { installments: dto.installments.length, total: planTotal },
            ['installments', 'total'],
          ),
        },
      });
      const emails = await this.notifications.notify(queryRunner.manager, [
        {
          userId: purchase.buyerId,
          type: 'payments.plan.updated',
          title: 'Plan uplata je ažuriran',
          body: 'Koordinator je postavio plan uplata za vašu kupovinu. Svaka rata se otključava tek kada su ispunjeni njeni uslovi.',
          link: `/purchases/${purchase.id}`,
        },
      ]);
      const installments = await this.payments.listForPurchase(queryRunner.manager, purchase.id);
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return this.toPlan(purchase, installments);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Potvrda jednog uslova pre uplate (F-14). Kada su svi uslovi ispunjeni, rata se otključava. */
  async confirmCondition(actor: AuthUser, installmentId: string, code: string, dto: ConfirmConditionDto): Promise<InstallmentResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const installment = await this.payments.findForUpdate(queryRunner.manager, installmentId);
      if (!installment) throw new ApiError(ApiErrorCode.NotFound);
      const access = await this.purchaseAccess.get(queryRunner.manager, installment.purchaseId, actor);
      const { purchase } = access;
      this.assertActive(purchase);
      if (installment.status !== 'LOCKED' && installment.status !== 'READY') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      const pack = this.markets.get(purchase.market);
      const definition = pack.paymentConditions.find((condition) => condition.code === code);
      const conditions = await this.payments.conditionsFor(queryRunner.manager, installment.id);
      const condition = conditions.find((item) => item.conditionCode === code);
      if (!definition || !condition) throw new ApiError(ApiErrorCode.NotFound);
      this.assertCanConfirm(actor, access, definition);
      if (condition.status === 'MET') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      if (definition.code.endsWith('_ACCOUNT_VERIFIED')) {
        const account = await this.catalog.findLatestVerifiedAccount(queryRunner.manager, purchase.developerId);
        if (!account) throw new ApiError(ApiErrorCode.BankAccountNotVerified);
      }
      if (dto.evidenceDocumentId) {
        await this.documents.assertBelongsToPurchase(queryRunner.manager, dto.evidenceDocumentId, purchase.id);
      }

      const now = new Date();
      const confirmation = { evidenceDocumentId: dto.evidenceDocumentId ?? null, note: dto.note?.trim() || null };
      await this.payments.markConditionMet(queryRunner.manager, condition.id, { confirmedById: actor.id, confirmedAt: now, ...confirmation });
      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'payments.condition.confirmed',
        entityType: 'installment',
        entityId: installment.id,
        data: {
          purchaseId: purchase.id,
          condition: code,
          changes: {
            [`condition.${code}`]: { from: condition.status, to: 'MET' },
            ...auditInitial(confirmation, ['evidenceDocumentId', 'note']),
          },
        },
      });

      const updated = conditions.map((item) => (item.id === condition.id ? { ...item, status: 'MET' as const } : item));
      const drafts = await this.unlockIfReady(queryRunner.manager, installment, updated, purchase.buyerId, purchase.id);
      const emails = await this.notifications.notify(queryRunner.manager, drafts);

      const fresh = await this.payments.conditionsFor(queryRunner.manager, installment.id);
      const status = drafts.length > 0 ? 'READY' : installment.status;
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toInstallmentResponse({ ...installment, status }, fresh, pack);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Uplata rate (F-15). Kupac prijavljuje uplatu sa dokazom; koordinator ili
   * naš tim (u modelu ESCROW i escrow partner) potvrđuje da je novac stigao.
   * DUMMY: stvarni prijem novca se proverava van platforme (izvod banke ili
   * potvrda escrow partnera). TODO(integracija): bankarski izvod / escrow API.
   */
  async recordPayment(actor: AuthUser, installmentId: string, dto: RecordPaymentDto): Promise<InstallmentResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const installment = await this.payments.findForUpdate(queryRunner.manager, installmentId);
      if (!installment) throw new ApiError(ApiErrorCode.NotFound);
      const access = await this.purchaseAccess.get(queryRunner.manager, installment.purchaseId, actor);
      const { purchase } = access;
      this.assertActive(purchase);
      const pack = this.markets.get(purchase.market);

      const canConfirm =
        access.relations.has('COORDINATOR') ||
        access.relations.has('INTERNAL') ||
        (pack.moneyModel === 'ESCROW' && access.relations.has('ESCROW'));
      if (!canConfirm) this.purchaseAccess.require(access, 'BUYER');

      if (installment.status === 'LOCKED') throw new ApiError(ApiErrorCode.PaymentConditionsNotMet);
      if (installment.status !== 'READY') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      if (dto.proofDocumentId) {
        await this.documents.assertBelongsToPurchase(queryRunner.manager, dto.proofDocumentId, purchase.id);
      }
      const proofDocumentId = dto.proofDocumentId ?? installment.proofDocumentId;
      if (!proofDocumentId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['proofDocumentId'] });

      const drafts: NotificationDraft[] = [];
      let updated: Installment;
      if (!canConfirm) {
        // Kupac samo prijavljuje uplatu; potvrdu daje koordinator.
        await this.payments.updateInstallment(queryRunner.manager, installment.id, { proofDocumentId });
        updated = { ...installment, proofDocumentId };
        if (purchase.coordinatorId) {
          drafts.push({
            userId: purchase.coordinatorId,
            type: 'installment.payment.reported',
            title: 'Kupac je prijavio uplatu',
            body: `Kupac je priložio dokaz o uplati za ratu ${installment.sequence}. Potvrdite prijem novca.`,
            link: `/purchases/${purchase.id}`,
          });
        }
      } else {
        const now = new Date();
        await this.payments.updateInstallment(queryRunner.manager, installment.id, {
          status: 'PAID',
          paidAt: now,
          paidConfirmedById: actor.id,
          proofDocumentId,
        });
        updated = { ...installment, status: 'PAID', paidAt: now, paidConfirmedById: actor.id, proofDocumentId };
        if (pack.moneyModel === 'ESCROW') {
          // Novac je na escrow računu; isplata investitoru ide preko instrukcije (četiri oka).
          await this.escrow.createInstruction(queryRunner.manager, { ...updated, market: purchase.market }, purchase.developerId, actor.id);
        }
        drafts.push({
          userId: purchase.buyerId,
          type: 'installment.paid',
          title: 'Uplata je potvrđena',
          body: `Potvrđena je uplata rate ${installment.sequence} (${installment.amount} €).`,
          link: `/purchases/${purchase.id}`,
        });
      }

      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: canConfirm ? 'payments.installment.paid' : 'payments.installment.reported',
        entityType: 'installment',
        entityId: installment.id,
        data: {
          purchaseId: purchase.id,
          amount: installment.amount,
          moneyModel: pack.moneyModel,
          changes: auditChanges(installment, updated, ['status', 'paidAt', 'proofDocumentId']),
        },
      });
      const emails = await this.notifications.notify(queryRunner.manager, drafts);
      const conditions = await this.payments.conditionsFor(queryRunner.manager, installment.id);
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toInstallmentResponse(updated, conditions, pack);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Učestvuje u tuđoj transakciji (ConstructionService) ----

  /**
   * Posle potvrde faze gradnje: uslovi tipa PHASE na zaključanim ratama te
   * faze u aktivnim kupovinama projekta postaju ispunjeni; rate kojima su svi
   * uslovi ispunjeni se otključavaju. Vraća obaveštenja za kupce.
   */
  async onPhaseConfirmed(manager: EntityManager, projectId: string, phaseCode: string, actorId: string): Promise<NotificationDraft[]> {
    const installments = await this.payments.lockedPhaseInstallmentsForUpdate(manager, projectId, phaseCode);
    if (installments.length === 0) return [];
    const conditions = await this.payments.conditionsForMany(manager, installments.map((installment) => installment.id));
    const buyers = await this.payments.buyersOf(manager, [...new Set(installments.map((installment) => installment.purchaseId))]);
    const now = new Date();
    const drafts: NotificationDraft[] = [];

    for (const installment of installments) {
      const phaseCodes = new Set(
        this.markets
          .get(installment.market)
          .paymentConditions.filter((definition) => definition.appliesTo === 'PHASE')
          .map((definition) => definition.code),
      );
      const own = conditions.filter((condition) => condition.installmentId === installment.id);
      const updated: InstallmentCondition[] = [];
      for (const condition of own) {
        if (phaseCodes.has(condition.conditionCode) && condition.status === 'PENDING') {
          await this.payments.markConditionMet(manager, condition.id, {
            confirmedById: actorId,
            confirmedAt: now,
            evidenceDocumentId: null,
            note: 'Potvrđeno izveštajem inženjera o završenoj fazi.',
          });
          await this.audit.record(manager, {
            market: installment.market,
            actorId,
            action: 'payments.condition.confirmed',
            entityType: 'installment',
            entityId: installment.id,
            data: {
              purchaseId: installment.purchaseId,
              projectId,
              condition: condition.conditionCode,
              automatic: true,
              changes: { [`condition.${condition.conditionCode}`]: { from: condition.status, to: 'MET' } },
            },
          });
          updated.push({ ...condition, status: 'MET' });
        } else {
          updated.push(condition);
        }
      }
      const buyerId = buyers.get(installment.purchaseId);
      if (buyerId) drafts.push(...(await this.unlockIfReady(manager, installment, updated, buyerId, installment.purchaseId)));
    }
    return drafts;
  }

  // ---- Pomoćno ----

  /** Ako su svi uslovi rate ispunjeni, rata postaje READY. Vraća obaveštenje kupcu (bez broja računa). */
  private async unlockIfReady(
    manager: EntityManager,
    installment: Installment,
    conditions: readonly InstallmentCondition[],
    buyerId: string,
    purchaseId: string,
  ): Promise<NotificationDraft[]> {
    if (installment.status !== 'LOCKED' || !conditions.every((condition) => condition.status === 'MET')) return [];
    await this.payments.updateInstallment(manager, installment.id, { status: 'READY' });
    await this.audit.record(manager, {
      market: installment.market,
      actorId: null,
      action: 'payments.installment.unlocked',
      entityType: 'installment',
      entityId: installment.id,
      data: { purchaseId, changes: { status: { from: installment.status, to: 'READY' } } },
    });
    return [
      {
        userId: buyerId,
        type: 'installment.ready',
        title: 'Rata je otključana',
        body: `Svi uslovi za ratu ${installment.sequence} su ispunjeni. Podatke za uplatu proverite u aplikaciji ili kod koordinatora.`,
        link: `/purchases/${purchaseId}`,
      },
    ];
  }

  private assertCanConfirm(actor: AuthUser, access: PurchaseAccess, definition: PaymentConditionDefinition): void {
    // Admin na tržištu potvrđuje svaki uslov.
    if (access.relations.has('ADMIN')) return;
    const allowed = definition.confirmerRoles.some((role) => {
      if (!actor.roles.includes(role)) return false;
      const relation = RELATION_FOR_CONFIRMER[role];
      return relation !== undefined && access.relations.has(relation);
    });
    if (!allowed) throw new ApiError(ApiErrorCode.Forbidden);
    // Saradnik u pravnom timu priprema, ali ne potvrđuje (F-31).
    if (access.relations.has('LAWYER') && !access.relations.has('INTERNAL') && access.legalTeamRole === 'ASSOCIATE') {
      const viaOther = definition.confirmerRoles.some(
        (role) => role !== Role.Lawyer && actor.roles.includes(role) && access.relations.has(RELATION_FOR_CONFIRMER[role] ?? 'BUYER'),
      );
      if (!viaOther) throw new ApiError(ApiErrorCode.Forbidden);
    }
  }

  private assertActive(purchase: Purchase): void {
    if (purchase.status !== 'ACTIVE') throw new ApiError(ApiErrorCode.InvalidStateTransition);
  }

  private toPlan(purchase: Purchase, installments: readonly Installment[]): PaymentPlanResponse {
    const pack: MarketPack = this.markets.get(purchase.market);
    return {
      moneyModel: pack.moneyModel,
      total: installments.reduce((sum, installment) => sum + installment.amount, 0),
      installments: installments.map((installment) =>
        toInstallmentResponse(
          installment,
          [...(installment.conditions ?? [])].sort((a, b) => a.conditionCode.localeCompare(b.conditionCode)),
          pack,
        ),
      ),
    };
  }
}


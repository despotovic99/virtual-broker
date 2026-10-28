import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { EmailMessage } from '../../integrations/dummy/dummy-email.sender.js';
import type { MarketCode } from '../../markets/market-code.js';
import { JOURNEY_PHASE_ORDER, type JourneyPhase, type MarketPack } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasRole, isInternalOnMarket } from '../access/market-access.js';
import { MARKET_SCOPED_ROLES, Role } from '../access/role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ChecksService } from '../checks/checks.service.js';
import { LegalTeamsService } from '../legal/legal-teams.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import { RequestsService } from '../requests/requests.service.js';
import { UsersService } from '../users/users.service.js';
import type {
  CreatePurchaseDto,
  ListPurchasesQueryDto,
  StepCompleteDto,
  StepSkipDto,
  UpdateAssignmentsDto,
} from './dto/purchase.dto.js';
import type { PurchaseDetailDto, PurchaseListDto, PurchaseStepDto } from './dto/purchase-response.dto.js';
import type { Purchase } from './entities/purchase.entity.js';
import { PurchaseAccessService, type PurchaseAccess, type PurchaseRelation } from './purchase-access.service.js';
import { stepDefinition, toPerson, toPurchaseSummary } from './purchases.mapper.js';
import { PurchasesRepository, type PurchaseVisibility } from './purchases.repository.js';

/** Veza sa kupovinom → uloga iz `ownerRoles` koraka koju ta veza pokriva. */
const RELATION_ROLE: Partial<Record<PurchaseRelation, Role>> = {
  BUYER: Role.Buyer,
  LAWYER: Role.Lawyer,
  ENGINEER: Role.Engineer,
};

function phaseIndex(phase: string): number {
  const index = JOURNEY_PHASE_ORDER.indexOf(phase as JourneyPhase);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function link(purchaseId: string): string {
  return `/purchases/${purchaseId}`;
}

/**
 * Kupovina (F-01, F-13, F-24): kreiranje iz zahteva, liste, detalj, dodele,
 * koraci iz paketa tržišta, blokada i otkaz. Pristup ide isključivo kroz
 * PurchaseAccessService.
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly purchases: PurchasesRepository,
    private readonly access: PurchaseAccessService,
    private readonly markets: MarketRegistry,
    private readonly catalog: CatalogService,
    private readonly checks: ChecksService,
    private readonly requests: RequestsService,
    private readonly legalTeams: LegalTeamsService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthUser, dto: CreatePurchaseDto): Promise<PurchaseDetailDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseDetailDto;
    let purchaseId: string;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const unit = await this.catalog.getUnit(manager, dto.unitId);
      if (!isInternalOnMarket(actor, unit.market)) throw new ApiError(ApiErrorCode.MarketNotAllowed);

      let buyerId = dto.buyerId ?? null;
      let requestId: string | null = null;
      if (dto.requestId) {
        const request = await this.requests.getForConversion(manager, dto.requestId);
        if (request.market !== unit.market || (buyerId && buyerId !== request.buyerId)) {
          throw new ApiError(ApiErrorCode.InvalidRequest);
        }
        buyerId = request.buyerId;
        requestId = request.id;
      }
      if (!buyerId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['buyerId'] });
      const buyer = await this.users.findActiveByIdWithRoles(manager, buyerId);
      if (!buyer || !buyer.roles.some((userRole) => userRole.role === Role.Buyer)) {
        throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['buyerId'] });
      }

      // Tvrda blokada (README pravilo 8): crvena provera koja blokira kupovinu.
      const project = await this.catalog.getProject(manager, unit.projectId);
      const developer = await this.catalog.getDeveloper(manager, project.developerId);
      const semaphore = await this.checks.projectSemaphore(manager, project, developer);
      if (semaphore.hardBlocked) throw new ApiError(ApiErrorCode.PurchaseHardBlocked);

      await this.catalog.reserveUnit(manager, unit.id);

      const pack = this.markets.get(unit.market);
      purchaseId = await this.purchases.insertPurchase(manager, {
        market: unit.market,
        packVersion: pack.version,
        buyerId,
        unitId: unit.id,
        projectId: project.id,
        developerId: developer.id,
        coordinatorId: hasRole(actor, Role.Coordinator) ? actor.id : null,
        requestId,
      });
      await this.purchases.insertSteps(
        manager,
        purchaseId,
        pack.journey.map((step, index) => ({ stepCode: step.code, phase: step.phase, position: index + 1 })),
      );
      if (requestId) await this.requests.markConverted(manager, requestId, purchaseId);

      await this.audit.record(manager, {
        market: unit.market,
        actorId: actor.id,
        action: 'purchase.created',
        entityType: 'purchase',
        entityId: purchaseId,
        data: { unitId: unit.id, projectId: project.id, buyerId, requestId, packVersion: pack.version },
      });
      emails = await this.notifications.notify(manager, [
        {
          userId: buyerId,
          type: 'purchase.created',
          title: 'Kupovina je otvorena',
          body: `Otvorena je vaša kupovina stana ${unit.label} u projektu ${project.name}. Koordinator će vas voditi kroz korake.`,
          link: link(purchaseId),
        },
      ]);

      await queryRunner.commitTransaction();
      // Odgovor se čita na istoj konekciji, posle commit-a.
      result = await this.buildDetail(manager, await this.access.get(manager, purchaseId, actor));
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  async list(actor: AuthUser, query: ListPurchasesQueryDto): Promise<PurchaseListDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const visibility = await this.visibilityFor(queryRunner.manager, actor);
      const [items, total] = await this.purchases.list(queryRunner.manager, visibility, {
        status: query.status,
        market: query.market,
        limit: query.limit,
        offset: query.offset,
      });
      return {
        items: items.map((purchase) => toPurchaseSummary(purchase, this.markets.get(purchase.market))),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async detail(actor: AuthUser, purchaseId: string): Promise<PurchaseDetailDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const access = await this.access.get(queryRunner.manager, purchaseId, actor);
      return await this.buildDetail(queryRunner.manager, access);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async updateAssignments(actor: AuthUser, purchaseId: string, dto: UpdateAssignmentsDto): Promise<PurchaseDetailDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseDetailDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.getForUpdate(manager, purchaseId, actor);
      this.access.require(access, 'COORDINATOR', 'INTERNAL');
      const { purchase } = access;
      this.assertOpen(purchase);
      const pack = this.markets.get(purchase.market);
      const changes: Partial<Pick<Purchase, 'legalTeamId' | 'lawyerId' | 'engineerId' | 'escrowAgentId' | 'coordinatorId'>> = {};

      if (dto.legalTeamId !== undefined) {
        if (dto.legalTeamId !== null) {
          const team = await this.legalTeams.findTeam(manager, dto.legalTeamId);
          if (!team || !team.active || team.market !== purchase.market || team.conflictDeveloperIds.includes(purchase.developerId)) {
            throw new ApiError(ApiErrorCode.LegalTeamNotAvailable);
          }
        }
        changes.legalTeamId = dto.legalTeamId;
        // Promena tima poništava advokata ako novi nije poslat.
        if (dto.legalTeamId !== purchase.legalTeamId && dto.lawyerId === undefined) changes.lawyerId = null;
      }

      if (dto.lawyerId !== undefined) {
        if (dto.lawyerId !== null) {
          const teamId = changes.legalTeamId !== undefined ? changes.legalTeamId : purchase.legalTeamId;
          const teamRole = teamId ? await this.legalTeams.memberRole(manager, teamId, dto.lawyerId) : null;
          if (teamRole !== 'LEAD' && teamRole !== 'LAWYER') throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['lawyerId'] });
          await this.assertStaff(manager, dto.lawyerId, Role.Lawyer, purchase.market, 'lawyerId');
        }
        changes.lawyerId = dto.lawyerId;
      }

      if (dto.engineerId !== undefined) {
        if (dto.engineerId !== null) await this.assertStaff(manager, dto.engineerId, Role.Engineer, purchase.market, 'engineerId');
        changes.engineerId = dto.engineerId;
      }

      if (dto.escrowAgentId !== undefined) {
        if (pack.moneyModel !== 'ESCROW') throw new ApiError(ApiErrorCode.EscrowNotUsed);
        if (dto.escrowAgentId !== null) {
          await this.assertStaff(manager, dto.escrowAgentId, Role.EscrowAgent, purchase.market, 'escrowAgentId');
        }
        changes.escrowAgentId = dto.escrowAgentId;
      }

      if (dto.coordinatorId !== undefined) {
        if (dto.coordinatorId !== null) {
          await this.assertStaff(manager, dto.coordinatorId, Role.Coordinator, purchase.market, 'coordinatorId');
        }
        changes.coordinatorId = dto.coordinatorId;
      }

      if (Object.keys(changes).length > 0) {
        await this.purchases.updatePurchase(manager, purchase.id, changes);
        await this.audit.record(manager, {
          market: purchase.market,
          actorId: actor.id,
          action: 'purchase.assignments.updated',
          entityType: 'purchase',
          entityId: purchase.id,
          data: Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value ?? null])),
        });

        const drafts: NotificationDraft[] = [];
        for (const userId of [changes.lawyerId, changes.engineerId, changes.escrowAgentId, changes.coordinatorId]) {
          if (userId) {
            drafts.push({
              userId,
              type: 'purchase.assigned',
              title: 'Dodeljena vam je kupovina',
              body: 'Dodeljeni ste na novu kupovinu. Otvorite predmet za detalje.',
              link: link(purchase.id),
            });
          }
        }
        if (changes.legalTeamId || changes.lawyerId) {
          drafts.push({
            userId: purchase.buyerId,
            type: 'purchase.lawyer-assigned',
            title: 'Dodeljen vam je advokat',
            body: 'Vašoj kupovini je dodeljen nezavisni pravni tim.',
            link: link(purchase.id),
          });
        }
        emails = await this.notifications.notify(manager, drafts);
      }

      await queryRunner.commitTransaction();
      // Odgovor se čita na istoj konekciji, posle commit-a.
      result = await this.buildDetail(manager, await this.access.get(manager, purchaseId, actor));
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  async completeStep(actor: AuthUser, purchaseId: string, code: string, dto: StepCompleteDto): Promise<PurchaseDetailDto> {
    return this.finishStep(actor, purchaseId, code, 'DONE', dto.note ?? null);
  }

  async skipStep(actor: AuthUser, purchaseId: string, code: string, dto: StepSkipDto): Promise<PurchaseDetailDto> {
    return this.finishStep(actor, purchaseId, code, 'SKIPPED', dto.reason);
  }

  async block(actor: AuthUser, purchaseId: string, reason: string): Promise<PurchaseDetailDto> {
    return this.changeStatus(actor, purchaseId, 'block', reason);
  }

  async unblock(actor: AuthUser, purchaseId: string): Promise<PurchaseDetailDto> {
    return this.changeStatus(actor, purchaseId, 'unblock', null);
  }

  async cancel(actor: AuthUser, purchaseId: string): Promise<PurchaseDetailDto> {
    return this.changeStatus(actor, purchaseId, 'cancel', null);
  }

  // ---- Interno ----

  private async finishStep(
    actor: AuthUser,
    purchaseId: string,
    code: string,
    status: 'DONE' | 'SKIPPED',
    note: string | null,
  ): Promise<PurchaseDetailDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseDetailDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.getForUpdate(manager, purchaseId, actor);
      const { purchase } = access;
      if (purchase.status !== 'ACTIVE') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      const pack = this.markets.get(purchase.market);
      const definition = stepDefinition(pack, code);
      const steps = await this.purchases.findSteps(manager, purchase.id);
      const step = steps.find((candidate) => candidate.stepCode === code);
      if (!definition || !step) throw new ApiError(ApiErrorCode.NotFound);
      if (step.status !== 'PENDING') throw new ApiError(ApiErrorCode.InvalidStateTransition);
      if (status === 'SKIPPED' && !definition.optional) throw new ApiError(ApiErrorCode.InvalidStateTransition);

      // Ko sme: koordinator kupovine i naš tim uvek; ostali samo ako im veza odgovara ulozi koraka.
      const isManager = access.relations.has('COORDINATOR') || access.relations.has('INTERNAL');
      const isOwner = [...access.relations].some((relation) => {
        const role = RELATION_ROLE[relation];
        return role !== undefined && definition.ownerRoles.includes(role);
      });
      if (!isManager && !isOwner) throw new ApiError(ApiErrorCode.Forbidden);

      // Raniji koraci: svi neopcioni koraci u ranijim fazama moraju biti završeni ili preskočeni.
      const currentPhase = phaseIndex(step.phase);
      const blocking = steps.some((candidate) => {
        if (phaseIndex(candidate.phase) >= currentPhase || candidate.status !== 'PENDING') return false;
        return !stepDefinition(pack, candidate.stepCode)?.optional;
      });
      if (blocking) throw new ApiError(ApiErrorCode.PurchaseStepNotReady);

      if (status === 'DONE' && definition.requiresLegalOpinion && !(await this.purchases.hasPositiveOpinion(manager, purchase.id))) {
        throw new ApiError(ApiErrorCode.LegalOpinionRequired);
      }

      const now = new Date();
      await this.purchases.updateStep(manager, step.id, { status, completedAt: now, completedById: actor.id, note });
      await this.audit.record(manager, {
        market: purchase.market,
        actorId: actor.id,
        action: status === 'DONE' ? 'purchase.step.completed' : 'purchase.step.skipped',
        entityType: 'purchase',
        entityId: purchase.id,
        data: { step: code, note },
      });

      const drafts: NotificationDraft[] = [];
      const allFinished = steps.every((candidate) => candidate.id === step.id || candidate.status !== 'PENDING');
      if (allFinished) {
        await this.purchases.updatePurchase(manager, purchase.id, { status: 'COMPLETED', closedAt: now });
        await this.catalog.markUnitSold(manager, purchase.unitId);
        await this.audit.record(manager, {
          market: purchase.market,
          actorId: actor.id,
          action: 'purchase.completed',
          entityType: 'purchase',
          entityId: purchase.id,
          data: null,
        });
        drafts.push({
          userId: purchase.buyerId,
          type: 'purchase.completed',
          title: 'Kupovina je završena',
          body: 'Svi koraci kupovine su završeni.',
          link: link(purchase.id),
        });
      } else if (purchase.buyerId !== actor.id) {
        drafts.push({
          userId: purchase.buyerId,
          type: 'purchase.step.completed',
          title: status === 'DONE' ? `Završen korak ${code}` : `Preskočen korak ${code}`,
          body: `Korak „${definition.title.sr}” je ${status === 'DONE' ? 'završen' : 'preskočen'}.`,
          link: link(purchase.id),
        });
      }
      if (purchase.coordinatorId && purchase.coordinatorId !== actor.id) {
        drafts.push({
          userId: purchase.coordinatorId,
          type: 'purchase.step.completed',
          title: `Korak ${code} ${status === 'DONE' ? 'završen' : 'preskočen'}`,
          body: `Korak „${definition.title.sr}” je ${status === 'DONE' ? 'završen' : 'preskočen'}.`,
          link: link(purchase.id),
        });
      }
      emails = await this.notifications.notify(manager, drafts);

      await queryRunner.commitTransaction();
      // Odgovor se čita na istoj konekciji, posle commit-a.
      result = await this.buildDetail(manager, await this.access.get(manager, purchaseId, actor));
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  private async changeStatus(
    actor: AuthUser,
    purchaseId: string,
    action: 'block' | 'unblock' | 'cancel',
    reason: string | null,
  ): Promise<PurchaseDetailDto> {
    let emails: EmailMessage[] = [];
    let result: PurchaseDetailDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.getForUpdate(manager, purchaseId, actor);
      this.access.require(access, 'COORDINATOR', 'INTERNAL');
      const { purchase } = access;
      const now = new Date();

      if (action === 'block') {
        if (purchase.status !== 'ACTIVE') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.purchases.updatePurchase(manager, purchase.id, { status: 'BLOCKED', blockReason: reason });
      } else if (action === 'unblock') {
        if (purchase.status !== 'BLOCKED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.purchases.updatePurchase(manager, purchase.id, { status: 'ACTIVE', blockReason: null });
      } else {
        if (purchase.status !== 'ACTIVE' && purchase.status !== 'BLOCKED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.purchases.updatePurchase(manager, purchase.id, { status: 'CANCELLED', closedAt: now });
        await this.catalog.releaseUnit(manager, purchase.unitId);
      }

      await this.audit.record(manager, {
        market: purchase.market,
        actorId: actor.id,
        action: `purchase.${action}`,
        entityType: 'purchase',
        entityId: purchase.id,
        data: reason ? { reason } : null,
      });
      const titles = { block: 'Kupovina je zaustavljena', unblock: 'Kupovina se nastavlja', cancel: 'Kupovina je otkazana' };
      emails = await this.notifications.notify(manager, [
        {
          userId: purchase.buyerId,
          type: `purchase.${action}`,
          title: titles[action],
          body: action === 'block' ? 'Koordinator je zaustavio kupovinu i objasniće vam razlog.' : titles[action],
          link: link(purchase.id),
        },
      ]);

      await queryRunner.commitTransaction();
      // Odgovor se čita na istoj konekciji, posle commit-a.
      result = await this.buildDetail(manager, await this.access.get(manager, purchaseId, actor));
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
    return result;
  }

  private assertOpen(purchase: Purchase): void {
    if (purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
  }

  /** Dodeljeni korisnik mora biti aktivan, imati ulogu i raditi na tržištu kupovine. */
  private async assertStaff(manager: EntityManager, userId: string, role: Role, market: MarketCode, field: string): Promise<void> {
    const user = await this.users.findActiveByIdWithRoles(manager, userId);
    const ok =
      user !== null &&
      user.roles.some((userRole) => userRole.role === role) &&
      (!MARKET_SCOPED_ROLES.includes(role) || (user.markets ?? []).some((userMarket) => userMarket.market === market));
    if (!ok) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: [field] });
  }

  private async visibilityFor(manager: EntityManager, actor: AuthUser): Promise<PurchaseVisibility> {
    const visibility: PurchaseVisibility = {};
    if (hasRole(actor, Role.Buyer)) visibility.buyerId = actor.id;
    if (hasRole(actor, Role.Coordinator)) visibility.coordinatorId = actor.id;
    if (hasRole(actor, Role.Admin, Role.Analyst, Role.Coordinator)) visibility.internalMarkets = actor.markets;
    if (hasRole(actor, Role.Lawyer)) visibility.legalTeamIds = await this.legalTeams.teamIdsForUser(manager, actor.id);
    if (hasRole(actor, Role.Engineer)) visibility.engineerId = actor.id;
    if (hasRole(actor, Role.EscrowAgent)) visibility.escrowAgentId = actor.id;
    return visibility;
  }

  private async buildDetail(manager: EntityManager, access: PurchaseAccess): Promise<PurchaseDetailDto> {
    const purchase = await this.purchases.findDetail(manager, access.purchase.id);
    if (!purchase?.unit?.project?.developer) throw new ApiError(ApiErrorCode.NotFound);
    const pack: MarketPack = this.markets.get(purchase.market);
    const { unit } = purchase;
    const project = unit.project!;
    const developer = project.developer!;

    const people = await this.purchases.findPeople(manager, [
      purchase.buyerId,
      ...[purchase.coordinatorId, purchase.lawyerId, purchase.engineerId, purchase.escrowAgentId].filter(
        (id): id is string => id !== null,
      ),
      ...(purchase.steps ?? []).map((step) => step.completedById).filter((id): id is string => id !== null),
    ]);
    const byId = new Map(people.map((person) => [person.id, person]));
    // Kupac koji je samo kupac ne vidi emailove drugih učesnika, osim koordinatora.
    const buyerOnly = access.relations.size === 1 && access.relations.has('BUYER');
    const person = (id: string | null, emailForBuyer = false) => (id ? toPerson(byId.get(id), !buyerOnly || emailForBuyer) : null);

    const legalTeam = purchase.legalTeamId ? await this.legalTeams.findTeam(manager, purchase.legalTeamId) : null;
    const proposed =
      !purchase.legalTeamId && purchase.status === 'ACTIVE' && !buyerOnly
        ? await this.legalTeams.proposeTeam(manager, purchase.market, purchase.developerId, null)
        : null;

    const steps: PurchaseStepDto[] = [...(purchase.steps ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((step) => {
        const definition = stepDefinition(pack, step.stepCode);
        return {
          code: step.stepCode,
          phase: (definition?.phase ?? step.phase) as PurchaseStepDto['phase'],
          title: definition?.title ?? { sr: step.stepCode, en: step.stepCode },
          ownerRoles: [...(definition?.ownerRoles ?? [])],
          optional: definition?.optional ?? false,
          requiresLegalOpinion: definition?.requiresLegalOpinion ?? false,
          status: step.status,
          completedAt: step.completedAt ? step.completedAt.toISOString() : null,
          completedBy: person(step.completedById),
          note: step.note,
        };
      });

    return {
      ...toPurchaseSummary(purchase, pack),
      packVersion: purchase.packVersion,
      moneyModel: pack.moneyModel,
      blockReason: purchase.blockReason,
      closedAt: purchase.closedAt ? purchase.closedAt.toISOString() : null,
      unit: { id: unit.id, label: unit.label, floor: unit.floor, rooms: unit.rooms, area: unit.area, price: unit.price },
      project: { id: project.id, name: project.name, city: project.city, address: project.address },
      developer: { id: developer.id, name: developer.name },
      buyer: person(purchase.buyerId),
      coordinator: person(purchase.coordinatorId, true),
      lawyer: person(purchase.lawyerId),
      engineer: person(purchase.engineerId),
      escrowAgent: person(purchase.escrowAgentId),
      legalTeam: legalTeam ? { id: legalTeam.id, name: legalTeam.name } : null,
      proposedLegalTeam: proposed ? { id: proposed.id, name: proposed.name } : null,
      steps,
      myRelations: [...access.relations],
    };
  }
}

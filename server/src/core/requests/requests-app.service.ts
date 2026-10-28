import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { EmailMessage } from '../../integrations/dummy/dummy-email.sender.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole, isInternalOnMarket } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { Developer } from '../catalog/entities/developer.entity.js';
import type { Project } from '../catalog/entities/project.entity.js';
import { ChecksService, type AutomaticCheckResult } from '../checks/checks.service.js';
import { LegalTeamsService } from '../legal/legal-teams.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  AnswerRequestDto,
  CreateRequestDto,
  ForwardRequestDto,
  LegalAnswerRequestDto,
  LinkRequestDto,
  RequestQueueQueryDto,
} from './dto/requests.dto.js';
import type { BuyerRequest, FreeSemaphoreSnapshot } from './entities/buyer-request.entity.js';
import { toRequestResponse, type RequestResponse } from './requests.mapper.js';
import { RequestsRepository } from './requests.repository.js';

/** Najviše besplatnih provera (zahteva tipa CHECK) mesečno po kupcu (F-35, P2). */
const FREE_CHECKS_PER_MONTH = 5;
/** Rok za prvi odgovor (F-35, P8: predlog 1 radni dan). */
const FIRST_RESPONSE_MS = 24 * 60 * 60 * 1000;

/**
 * Zahtevi kupca (F-35): provera, pitanje ili „vodi moju kupovinu”, red za naš
 * tim i pravni tim. Besplatni semafor koristi samo automatske izvore (u MVP-u
 * DUMMY); oni se zovu PRE otvaranja transakcije.
 */
@Injectable()
export class RequestsAppService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly requests: RequestsRepository,
    private readonly catalog: CatalogService,
    private readonly checks: ChecksService,
    private readonly legalTeams: LegalTeamsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateRequestDto): Promise<RequestResponse> {
    this.validateContent(dto);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const manager = queryRunner.manager;
      if (dto.kind === 'CHECK') {
        const used = await this.requests.countSince(manager, actor.id, 'CHECK', startOfMonth(new Date()));
        if (used >= FREE_CHECKS_PER_MONTH) throw new ApiError(ApiErrorCode.RequestQuotaExceeded);
      }
      const { developer, project, unitId } = await this.resolveCatalogLinks(manager, dto);

      // Spoljni izvori (DUMMY u MVP-u): konekcija je otvorena, transakcija nije.
      let developerResults: AutomaticCheckResult[] = [];
      let parcelResults: AutomaticCheckResult[] = [];
      if (dto.kind === 'CHECK') {
        const registrationNumber = developer?.registrationNumber ?? dto.registrationNumber;
        const parcelReference = project?.parcelReference ?? dto.parcelReference;
        if (registrationNumber) {
          developerResults = await this.checks.fetchAutomatic(dto.market, 'DEVELOPER', { registrationNumber }, { onlyFreeSemaphore: true });
        }
        if (parcelReference) {
          parcelResults = await this.checks.fetchAutomatic(dto.market, 'PROJECT', { parcelReference }, { onlyFreeSemaphore: true });
        }
      }

      await queryRunner.startTransaction();
      // Ako je investitor ili projekat u katalogu, rezultat se čuva i kao provera.
      if (developer && developerResults.length > 0) {
        await this.checks.recordAutomatic(manager, dto.market, { developerId: developer.id, projectId: null }, developerResults);
      }
      if (project && parcelResults.length > 0) {
        await this.checks.recordAutomatic(manager, dto.market, { developerId: null, projectId: project.id }, parcelResults);
      }
      const now = new Date();
      const freeSemaphore: FreeSemaphoreSnapshot | null =
        dto.kind === 'CHECK'
          ? {
              developer: developerResults.length > 0 ? this.checks.semaphoreFromResults(dto.market, developerResults, now) : null,
              parcel: parcelResults.length > 0 ? this.checks.semaphoreFromResults(dto.market, parcelResults, now) : null,
              checkedAt: now.toISOString(),
            }
          : null;

      const request = await this.requests.insert(manager, {
        market: dto.market,
        buyerId: actor.id,
        kind: dto.kind,
        status: 'NEW',
        listingUrl: dto.listingUrl ?? null,
        developerName: dto.developerName?.trim() || developer?.name || null,
        registrationNumber: dto.registrationNumber ?? null,
        parcelReference: dto.parcelReference?.trim() || null,
        address: dto.address?.trim() || null,
        question: dto.question?.trim() || null,
        freeSemaphore,
        developerId: developer?.id ?? null,
        projectId: project?.id ?? null,
        unitId,
        firstResponseDueAt: new Date(now.getTime() + FIRST_RESPONSE_MS),
      });
      await this.audit.record(manager, {
        market: request.market,
        actorId: actor.id,
        action: 'request.created',
        entityType: 'buyer_request',
        entityId: request.id,
        data: { kind: request.kind, linkedDeveloper: request.developerId !== null, dummy: request.freeSemaphore?.developer?.containsDummyData ?? false },
      });
      await queryRunner.commitTransaction();
      return toRequestResponse(request, false);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async listMine(actor: AuthUser): Promise<RequestResponse[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const requests = await this.requests.listForBuyer(queryRunner.manager, actor.id);
      return requests.map((request) => toRequestResponse(request, false));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Kupac vidi svoj zahtev; tim na tržištu i pravni tim kome je prosleđen vide sve detalje. */
  async getOne(actor: AuthUser, id: string): Promise<RequestResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const request = await this.requests.findById(queryRunner.manager, id);
      if (!request) throw new ApiError(ApiErrorCode.NotFound);
      if (isInternalOnMarket(actor, request.market) || (await this.isAssignedLawyer(queryRunner.manager, actor, request))) {
        return toRequestResponse(request, true);
      }
      if (request.buyerId === actor.id) return toRequestResponse(request, false);
      throw new ApiError(ApiErrorCode.NotFound);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Red zahteva za naš tim (analitičar, koordinator, admin) na njegovim tržištima. */
  async queue(actor: AuthUser, query: RequestQueueQueryDto): Promise<RequestResponse[]> {
    const markets = actor.markets.filter((market) => isInternalOnMarket(actor, market) && (!query.market || market === query.market));
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const requests = await this.requests.listQueue(queryRunner.manager, markets, query.status);
      return requests.map((request) => toRequestResponse(request, true));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Zahtevi prosleđeni pravnim timovima u kojima je advokat član. */
  async legalQueue(actor: AuthUser): Promise<RequestResponse[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const teamIds = await this.legalTeams.teamIdsForUser(queryRunner.manager, actor.id);
      const requests = await this.requests.listForLegalTeams(queryRunner.manager, teamIds);
      return requests.filter((request) => hasMarketAccess(actor, request.market)).map((request) => toRequestResponse(request, true));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Član tima preuzima zahtev (postaje vlasnik). */
  async take(actor: AuthUser, id: string): Promise<RequestResponse> {
    return this.changeAsInternal(actor, id, 'request.taken', (request) => ({
      ownerUserId: actor.id,
      status: request.status === 'NEW' ? 'IN_TRIAGE' : request.status,
    }));
  }

  /** Povezuje zahtev sa investitorom, projektom ili stanom iz kataloga (isto tržište). */
  async link(actor: AuthUser, id: string, dto: LinkRequestDto): Promise<RequestResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const request = await this.lockOpen(queryRunner.manager, actor, id);
      const changes: Partial<BuyerRequest> = {};
      if (dto.developerId) {
        const developer = await this.catalog.getDeveloper(queryRunner.manager, dto.developerId);
        if (developer.market !== request.market) throw new ApiError(ApiErrorCode.MarketNotAllowed);
        changes.developerId = developer.id;
      }
      if (dto.projectId) {
        const project = await this.catalog.getProject(queryRunner.manager, dto.projectId);
        if (project.market !== request.market) throw new ApiError(ApiErrorCode.MarketNotAllowed);
        changes.projectId = project.id;
        changes.developerId = project.developerId;
      }
      if (dto.unitId) {
        const unit = await this.catalog.getUnit(queryRunner.manager, dto.unitId);
        if (unit.market !== request.market) throw new ApiError(ApiErrorCode.MarketNotAllowed);
        const projectId = changes.projectId ?? request.projectId;
        if (projectId && unit.projectId !== projectId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['unitId'] });
        changes.unitId = unit.id;
        changes.projectId = unit.projectId;
      }
      const updated = await this.requests.update(queryRunner.manager, id, changes);
      await this.audit.record(queryRunner.manager, {
        market: request.market,
        actorId: actor.id,
        action: 'request.linked',
        entityType: 'buyer_request',
        entityId: id,
        data: { developerId: updated.developerId, projectId: updated.projectId, unitId: updated.unitId },
      });
      await queryRunner.commitTransaction();
      return toRequestResponse(updated, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Prosleđuje zahtev pravnom timu na istom tržištu. Članovi tima dobijaju obaveštenje. */
  async forward(actor: AuthUser, id: string, dto: ForwardRequestDto): Promise<RequestResponse> {
    let emails: EmailMessage[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let response: RequestResponse;
    try {
      const request = await this.lockOpen(queryRunner.manager, actor, id);
      const team = await this.legalTeams.findTeam(queryRunner.manager, dto.legalTeamId);
      if (!team || !team.active || team.market !== request.market) throw new ApiError(ApiErrorCode.LegalTeamNotAvailable);
      if (request.developerId && team.conflictDeveloperIds.includes(request.developerId)) {
        throw new ApiError(ApiErrorCode.LegalTeamNotAvailable);
      }
      const updated = await this.requests.update(queryRunner.manager, id, {
        legalTeamId: team.id,
        status: 'WITH_LEGAL_TEAM',
        ownerUserId: request.ownerUserId ?? actor.id,
      });
      emails = await this.notifications.notify(
        queryRunner.manager,
        (team.members ?? []).map((member) => ({
          userId: member.userId,
          type: 'request.forwarded',
          title: 'Nov zahtev kupca za pravni tim',
          body: 'Kupac je postavio pitanje koje je prosleđeno vašem timu. Rok za prvi odgovor je u zahtevu.',
          link: `/legal/requests/${id}`,
        })),
      );
      await this.audit.record(queryRunner.manager, {
        market: request.market,
        actorId: actor.id,
        action: 'request.forwarded',
        entityType: 'buyer_request',
        entityId: id,
        data: { legalTeamId: team.id },
      });
      await queryRunner.commitTransaction();
      response = toRequestResponse(updated, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
    await this.notifications.sendEmails(emails);
    return response;
  }

  /** Odgovor našeg tima: uvek opšta informacija, nikad pravni savet (F-35, P5 i P6). */
  async answer(actor: AuthUser, id: string, dto: AnswerRequestDto): Promise<RequestResponse> {
    return this.answerInternal(actor, id, dto.answer, 'INFORMATION', false);
  }

  /** Odgovor advokata iz tima kome je zahtev prosleđen. Saradnik (ASSOCIATE) ne odgovara. */
  async legalAnswer(actor: AuthUser, id: string, dto: LegalAnswerRequestDto): Promise<RequestResponse> {
    return this.answerInternal(actor, id, dto.answer, dto.answerScope, true);
  }

  async close(actor: AuthUser, id: string): Promise<RequestResponse> {
    return this.changeAsInternal(actor, id, 'request.closed', () => ({ status: 'CLOSED' }));
  }

  // ---- Pomoćno ----

  private async answerInternal(
    actor: AuthUser,
    id: string,
    answer: string,
    answerScope: BuyerRequest['answerScope'],
    asLawyer: boolean,
  ): Promise<RequestResponse> {
    let emails: EmailMessage[] = [];
    let response: RequestResponse;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      let request: BuyerRequest;
      if (asLawyer) {
        const found = await this.requests.findByIdForUpdate(manager, id);
        if (!found || !found.legalTeamId || !hasMarketAccess(actor, found.market) || !hasRole(actor, Role.Lawyer)) {
          throw new ApiError(ApiErrorCode.NotFound);
        }
        const teamRole = await this.legalTeams.memberRole(manager, found.legalTeamId, actor.id);
        if (!teamRole) throw new ApiError(ApiErrorCode.NotFound);
        if (teamRole === 'ASSOCIATE') throw new ApiError(ApiErrorCode.Forbidden);
        if (found.status !== 'WITH_LEGAL_TEAM') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        request = found;
      } else {
        request = await this.lockOpen(manager, actor, id);
      }

      const updated = await this.requests.update(manager, id, {
        answer: answer.trim(),
        answerScope,
        answeredById: actor.id,
        answeredAt: new Date(),
        status: 'ANSWERED',
      });
      emails = await this.notifications.notify(manager, [
        {
          userId: request.buyerId,
          type: 'request.answered',
          title: 'Stigao je odgovor na vaš zahtev',
          body: 'Odgovor možete pročitati u zahtevu na platformi.',
          link: `/requests/${id}`,
        },
      ]);
      await this.audit.record(manager, {
        market: request.market,
        actorId: actor.id,
        action: asLawyer ? 'request.answered.legal' : 'request.answered',
        entityType: 'buyer_request',
        entityId: id,
        data: { answerScope },
      });
      await queryRunner.commitTransaction();
      response = toRequestResponse(updated, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
    await this.notifications.sendEmails(emails);
    return response;
  }

  private async changeAsInternal(
    actor: AuthUser,
    id: string,
    action: string,
    changesFor: (request: BuyerRequest) => Partial<BuyerRequest>,
  ): Promise<RequestResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const request = await this.lockOpen(queryRunner.manager, actor, id);
      const changes = changesFor(request);
      const updated = await this.requests.update(queryRunner.manager, id, changes);
      await this.audit.record(queryRunner.manager, {
        market: request.market,
        actorId: actor.id,
        action,
        entityType: 'buyer_request',
        entityId: id,
        data: { previousStatus: request.status, status: updated.status },
      });
      await queryRunner.commitTransaction();
      return toRequestResponse(updated, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Zaključava zahtev koji još nije zatvoren ni pretvoren, i proverava da je korisnik naš tim na tržištu. */
  private async lockOpen(manager: EntityManager, actor: AuthUser, id: string): Promise<BuyerRequest> {
    const request = await this.requests.findByIdForUpdate(manager, id);
    if (!request || !isInternalOnMarket(actor, request.market)) throw new ApiError(ApiErrorCode.NotFound);
    if (request.status === 'CONVERTED' || request.status === 'CLOSED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
    return request;
  }

  private async isAssignedLawyer(manager: EntityManager, actor: AuthUser, request: BuyerRequest): Promise<boolean> {
    if (!request.legalTeamId || !hasRole(actor, Role.Lawyer) || !hasMarketAccess(actor, request.market)) return false;
    return (await this.legalTeams.memberRole(manager, request.legalTeamId, actor.id)) !== null;
  }

  /** Projekat i stan iz zahteva moraju biti objavljeni i na istom tržištu. */
  private async resolveCatalogLinks(
    manager: EntityManager,
    dto: CreateRequestDto,
  ): Promise<{ developer: Developer | null; project: Project | null; unitId: string | null }> {
    let project: Project | null = null;
    let unitId: string | null = null;
    if (dto.unitId) {
      const unit = await this.catalog.getUnit(manager, dto.unitId);
      if (dto.projectId && unit.projectId !== dto.projectId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['unitId'] });
      unitId = unit.id;
      project = await this.catalog.getProject(manager, unit.projectId);
    } else if (dto.projectId) {
      project = await this.catalog.getProject(manager, dto.projectId);
    }
    if (project && (project.market !== dto.market || project.status !== 'PUBLISHED')) throw new ApiError(ApiErrorCode.NotFound);

    let developer: Developer | null = project ? await this.catalog.getDeveloper(manager, project.developerId) : null;
    if (!developer && dto.registrationNumber) {
      developer = await this.catalog.findDeveloperByRegistration(manager, dto.market, dto.registrationNumber.trim());
    }
    return { developer, project, unitId };
  }

  private validateContent(dto: CreateRequestDto): void {
    if (dto.kind === 'QUESTION' && !dto.question?.trim()) {
      throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['question'] });
    }
    if (dto.kind === 'CHECK') {
      const hasTarget = [dto.registrationNumber, dto.parcelReference, dto.listingUrl, dto.developerName, dto.address, dto.projectId, dto.unitId].some(
        (value) => typeof value === 'string' && value.trim() !== '',
      );
      if (!hasTarget) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['registrationNumber', 'listingUrl', 'projectId'] });
    }
  }
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

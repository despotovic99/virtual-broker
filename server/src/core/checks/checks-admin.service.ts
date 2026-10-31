import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { toPage, type Page } from '../../common/pagination/pagination.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { CheckDefinition, Localized } from '../../markets/market-pack.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole, isInternalOnMarket } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { Developer } from '../catalog/entities/developer.entity.js';
import type { Project } from '../catalog/entities/project.entity.js';
import { ChecksRepository } from './checks.repository.js';
import { checkStatusChanges, ChecksService, SEMAPHORE_DISCLAIMER, type ProjectSemaphore } from './checks.service.js';
import type { CheckHistoryQueryDto, CheckTargetDto, ManualCheckDto } from './dto/checks.dto.js';
import type { Check } from './entities/check.entity.js';
import type { SemaphoreResult } from './semaphore.js';

export interface SemaphoreResponse extends SemaphoreResult {
  disclaimer: Localized;
}

export interface ProjectSemaphoreResponse extends ProjectSemaphore {
  disclaimer: Localized;
}

export interface CheckHistoryItem {
  id: string;
  definitionCode: string;
  status: Check['status'];
  summary: string;
  source: string;
  method: Check['method'];
  dummy: boolean;
  checkedAt: string;
  validUntil: string;
  checkedById: string | null;
  documentId: string | null;
}

export type CheckHistoryListResponse = Page<CheckHistoryItem>;

type Target = { kind: 'DEVELOPER'; developer: Developer } | { kind: 'PROJECT'; project: Project; developer: Developer };

/**
 * Pokretanje automatskih provera, ručni unos, semafor i istorija (F-05 – F-08).
 * Automatske provere: konekcija je otvorena (čitanje cilja), spoljni izvori
 * se zovu PRE transakcije, a rezultat se upisuje u jednoj transakciji.
 */
@Injectable()
export class ChecksAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly checksService: ChecksService,
    private readonly checks: ChecksRepository,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  async runAutomatic(actor: AuthUser, dto: CheckTargetDto): Promise<SemaphoreResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const target = await this.loadTarget(queryRunner.manager, dto);
      const market = this.marketOf(target);
      this.assertCanManage(actor, market);

      const subject = target.kind;
      const input =
        target.kind === 'DEVELOPER'
          ? { registrationNumber: target.developer.registrationNumber }
          : { registrationNumber: target.developer.registrationNumber, parcelReference: target.project.parcelReference };
      // Spoljni izvori: bez otvorene transakcije.
      const results = await this.checksService.fetchAutomatic(market, subject, input, { onlyFreeSemaphore: false });

      await queryRunner.startTransaction();
      const ids = this.targetIds(target);
      const changes = await this.checksService.recordAutomatic(queryRunner.manager, market, ids, results);
      await this.audit.record(queryRunner.manager, {
        market,
        actorId: actor.id,
        action: 'checks.automatic.run',
        entityType: target.kind === 'DEVELOPER' ? 'developer' : 'project',
        entityId: ids.developerId ?? ids.projectId,
        data: {
          ...this.relatedKeys(target),
          codes: results.map((item) => item.definition.code),
          dummy: results.some((item) => item.result.dummy),
          changes,
        },
      });
      const semaphore =
        target.kind === 'DEVELOPER'
          ? await this.checksService.developerSemaphore(queryRunner.manager, target.developer)
          : (await this.checksService.projectSemaphore(queryRunner.manager, target.project, target.developer)).project;
      await queryRunner.commitTransaction();
      return { ...semaphore, disclaimer: SEMAPHORE_DISCLAIMER };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Ručni unos provere. Analitičar: metode MANUAL i DOCUMENT. Advokat: metode
   * LAWYER i DOCUMENT. Za DOCUMENT je obavezan dokument istog vlasnika.
   */
  async recordManual(actor: AuthUser, dto: ManualCheckDto): Promise<CheckHistoryItem> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const target = await this.loadTarget(queryRunner.manager, dto);
      const market = this.marketOf(target);
      this.assertCanManage(actor, market);

      const definition = this.checksService
        .definitionsFor(market, target.kind)
        .find((candidate) => candidate.code === dto.definitionCode);
      if (!definition) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['definitionCode'] });
      this.assertMethodAllowed(actor, definition);

      const ids = this.targetIds(target);
      if (dto.documentId) {
        const document = await this.checks.findDocument(queryRunner.manager, dto.documentId);
        const belongs =
          document !== null &&
          document.market === market &&
          (target.kind === 'DEVELOPER' ? document.developerId === ids.developerId : document.projectId === ids.projectId);
        if (!belongs) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['documentId'] });
      } else if (definition.method === 'DOCUMENT' && dto.status !== 'GRAY') {
        throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['documentId'] });
      }

      const previous = await this.checksService.latestStatuses(queryRunner.manager, ids);
      const checkedAt = new Date();
      const check = await this.checks.insertOne(queryRunner.manager, {
        market,
        subjectType: target.kind,
        developerId: ids.developerId,
        projectId: ids.projectId,
        definitionCode: definition.code,
        status: dto.status,
        summary: dto.summary.trim(),
        source: this.manualSource(actor, definition),
        method: definition.method,
        dummy: false,
        checkedAt,
        validUntil: this.checksService.validUntil(definition, checkedAt),
        checkedById: actor.id,
        documentId: dto.documentId ?? null,
        data: null,
      });
      await this.audit.record(queryRunner.manager, {
        market,
        actorId: actor.id,
        action: 'checks.manual.recorded',
        entityType: target.kind === 'DEVELOPER' ? 'developer' : 'project',
        entityId: ids.developerId ?? ids.projectId,
        data: {
          ...this.relatedKeys(target),
          code: definition.code,
          status: dto.status,
          documentId: dto.documentId ?? null,
          changes: {
            ...checkStatusChanges(previous, [{ code: definition.code, status: dto.status }]),
            ...auditInitial(check, ['summary', 'documentId']),
          },
        },
      });
      await queryRunner.commitTransaction();
      return toHistoryItem(check);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Semafor investitora: samo naš tim i partneri na tržištu (kupac vidi semafor kroz projekat). */
  async developerSemaphore(actor: AuthUser, developerId: string): Promise<SemaphoreResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const developer = await this.catalog.getDeveloper(queryRunner.manager, developerId);
      if (!this.isStaffOn(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
      const semaphore = await this.checksService.developerSemaphore(queryRunner.manager, developer);
      return { ...semaphore, disclaimer: SEMAPHORE_DISCLAIMER };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Semafor projekta: kupac samo za objavljen projekat, tim i partneri na svom tržištu. */
  async projectSemaphore(actor: AuthUser, projectId: string): Promise<ProjectSemaphoreResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const project = await this.catalog.getProject(queryRunner.manager, projectId);
      if (project.status !== 'PUBLISHED' && !this.isStaffOn(actor, project.market)) throw new ApiError(ApiErrorCode.NotFound);
      const developer = await this.catalog.getDeveloper(queryRunner.manager, project.developerId);
      const semaphore = await this.checksService.projectSemaphore(queryRunner.manager, project, developer);
      return { ...semaphore, disclaimer: SEMAPHORE_DISCLAIMER };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Istorija provera: samo naš tim i advokati na tržištu. */
  async history(actor: AuthUser, query: CheckHistoryQueryDto): Promise<CheckHistoryListResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const target = await this.loadTarget(queryRunner.manager, query);
      const market = this.marketOf(target);
      if (!isInternalOnMarket(actor, market) && !(hasRole(actor, Role.Lawyer) && hasMarketAccess(actor, market))) {
        throw new ApiError(ApiErrorCode.NotFound);
      }
      const ids = this.targetIds(target);
      const filter = target.kind === 'DEVELOPER' ? { developerId: ids.developerId ?? undefined } : { projectId: ids.projectId ?? undefined };
      const [checks, total] = await this.checks.historyFor(queryRunner.manager, filter, query);
      return toPage(checks.map(toHistoryItem), total, query);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Pomoćno ----

  private async loadTarget(manager: EntityManager, dto: CheckTargetDto): Promise<Target> {
    if (Boolean(dto.developerId) === Boolean(dto.projectId)) {
      throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['developerId', 'projectId'] });
    }
    if (dto.developerId) return { kind: 'DEVELOPER', developer: await this.catalog.getDeveloper(manager, dto.developerId) };
    const project = await this.catalog.getProject(manager, dto.projectId as string);
    const developer = await this.catalog.getDeveloper(manager, project.developerId);
    return { kind: 'PROJECT', project, developer };
  }

  /** Veza traga sa nadređenim: provera projekta se vidi i u istoriji investitora. */
  private relatedKeys(target: Target): { developerId: string; projectId?: string } {
    return target.kind === 'DEVELOPER'
      ? { developerId: target.developer.id }
      : { developerId: target.developer.id, projectId: target.project.id };
  }

  private marketOf(target: Target): MarketCode {
    return target.kind === 'DEVELOPER' ? target.developer.market : target.project.market;
  }

  private targetIds(target: Target): { developerId: string | null; projectId: string | null } {
    return target.kind === 'DEVELOPER'
      ? { developerId: target.developer.id, projectId: null }
      : { developerId: null, projectId: target.project.id };
  }

  /** Provere unose analitičar, advokat i admin, samo na svom tržištu. Nepoznat cilj ostaje NOT_FOUND. */
  private assertCanManage(actor: AuthUser, market: MarketCode): void {
    if (!hasMarketAccess(actor, market) || !hasRole(actor, Role.Analyst, Role.Lawyer, Role.Admin)) throw new ApiError(ApiErrorCode.NotFound);
  }

  private assertMethodAllowed(actor: AuthUser, definition: CheckDefinition): void {
    const analystAllowed = hasRole(actor, Role.Analyst) && (definition.method === 'MANUAL' || definition.method === 'DOCUMENT');
    const lawyerAllowed = hasRole(actor, Role.Lawyer) && (definition.method === 'LAWYER' || definition.method === 'DOCUMENT');
    const adminAllowed = hasRole(actor, Role.Admin) && definition.method !== 'AUTOMATIC';
    if (!analystAllowed && !lawyerAllowed && !adminAllowed) throw new ApiError(ApiErrorCode.Forbidden);
  }

  private isStaffOn(actor: AuthUser, market: MarketCode): boolean {
    return (
      hasMarketAccess(actor, market) &&
      hasRole(actor, Role.Admin, Role.Analyst, Role.Coordinator, Role.Lawyer, Role.Engineer)
    );
  }

  private manualSource(actor: AuthUser, definition: CheckDefinition): string {
    if (definition.method === 'DOCUMENT') return 'Dokument iz trezora, pregledao naš tim ili advokat';
    if (definition.method === 'LAWYER' || hasRole(actor, Role.Lawyer)) return 'Provera advokata partnera';
    return 'Ručna provera analitičara';
  }
}

function toHistoryItem(check: Check): CheckHistoryItem {
  return {
    id: check.id,
    definitionCode: check.definitionCode,
    status: check.status,
    summary: check.summary,
    source: check.source,
    method: check.method,
    dummy: check.dummy,
    checkedAt: check.checkedAt.toISOString(),
    validUntil: check.validUntil.toISOString(),
    checkedById: check.checkedById,
    documentId: check.documentId,
  };
}

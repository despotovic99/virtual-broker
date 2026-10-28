import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { Localized } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole, isInternalOnMarket } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { Project } from '../catalog/entities/project.entity.js';
import { DocumentsService, toDocumentResponse, type DocumentResponse, type StoredFile } from '../documents/documents.service.js';
import { validateUploadedFile, type UploadedFileData } from '../documents/file-validation.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PurchaseAccessService } from '../purchases/purchase-access.service.js';
import { ConstructionRepository } from './construction.repository.js';
import type { CreateEngineerReportDto, UpdateConstructionPlanDto } from './dto/construction.dto.js';
import type { ConstructionPhase } from './entities/construction-phase.entity.js';
import type { EngineerReport } from './entities/engineer-report.entity.js';

export interface ConstructionPhaseResponse {
  phaseCode: string;
  title: Localized;
  position: number;
  defaultSharePercent: number;
  plannedDate: string | null;
  actualDate: string | null;
  status: ConstructionPhase['status'];
  confirmedAt: string | null;
  /** Planirani datum je prošao, a faza nije potvrđena (F-18). */
  late: boolean;
}

export interface ConstructionResponse {
  projectId: string;
  phases: ConstructionPhaseResponse[];
}

export interface EngineerReportResponse {
  id: string;
  projectId: string;
  phaseCode: string | null;
  engineerId: string;
  visitDate: string;
  summary: string;
  verdict: EngineerReport['verdict'];
  createdAt: string;
}

function toReportResponse(report: EngineerReport): EngineerReportResponse {
  return {
    id: report.id,
    projectId: report.projectId,
    phaseCode: report.phaseCode,
    engineerId: report.engineerId,
    visitDate: report.visitDate,
    summary: report.summary,
    verdict: report.verdict,
    createdAt: report.createdAt.toISOString(),
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Gradnja (F-17, F-18): plan i stvarno stanje faza i izveštaji nezavisnog
 * inženjera. Fazu potvrđuje samo inženjer; potvrda faze automatski otključava
 * rate vezane za tu fazu (PaymentsService.onPhaseConfirmed).
 */
@Injectable()
export class ConstructionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly construction: ConstructionRepository,
    private readonly markets: MarketRegistry,
    private readonly catalog: CatalogService,
    private readonly purchaseAccess: PurchaseAccessService,
    private readonly documents: DocumentsService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async getConstruction(actor: AuthUser, projectId: string): Promise<ConstructionResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const project = await this.visibleProject(queryRunner.manager, actor, projectId);
      const phases = await this.construction.phasesForProject(queryRunner.manager, project.id);
      return this.toConstruction(project, phases);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Plan faza (planirani datumi) unosi naš tim na tržištu projekta. */
  async updatePlan(actor: AuthUser, projectId: string, dto: UpdateConstructionPlanDto): Promise<ConstructionResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const project = await this.catalog.getProject(queryRunner.manager, projectId);
      if (!isInternalOnMarket(actor, project.market)) throw new ApiError(ApiErrorCode.NotFound);
      const definitions = this.markets.get(project.market).constructionPhases;
      const invalid = dto.phases
        .map((phase, index) => (definitions.some((definition) => definition.code === phase.phaseCode) ? null : `phases.${index}.phaseCode`))
        .filter((field): field is string => field !== null);
      if (invalid.length > 0) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: invalid });

      for (const item of dto.phases) {
        const existing = await this.construction.phaseForUpdate(queryRunner.manager, project.id, item.phaseCode);
        if (existing) {
          await this.construction.updatePhase(queryRunner.manager, existing.id, { plannedDate: item.plannedDate });
        } else {
          await this.construction.insertPhase(queryRunner.manager, {
            market: project.market,
            projectId: project.id,
            phaseCode: item.phaseCode,
            position: definitions.findIndex((definition) => definition.code === item.phaseCode) + 1,
            plannedDate: item.plannedDate,
          });
        }
      }
      await this.audit.record(queryRunner.manager, {
        market: project.market,
        actorId: actor.id,
        action: 'construction.plan.updated',
        entityType: 'project',
        entityId: project.id,
        data: { phases: dto.phases.map((phase) => phase.phaseCode) },
      });
      const phases = await this.construction.phasesForProject(queryRunner.manager, project.id);
      await queryRunner.commitTransaction();
      return this.toConstruction(project, phases);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Izveštaj inženjera sa obilaska. PHASE_CONFIRMED potvrđuje fazu i otključava rate te faze. */
  async createReport(actor: AuthUser, projectId: string, dto: CreateEngineerReportDto): Promise<EngineerReportResponse> {
    if (dto.visitDate > today()) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['visitDate'] });
    const decidesPhase = dto.verdict === 'PHASE_CONFIRMED' || dto.verdict === 'PHASE_REJECTED';
    if (decidesPhase && !dto.phaseCode) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['phaseCode'] });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const project = await this.catalog.getProject(queryRunner.manager, projectId);
      if (!hasRole(actor, Role.Engineer) || !hasMarketAccess(actor, project.market)) throw new ApiError(ApiErrorCode.NotFound);
      const definitions = this.markets.get(project.market).constructionPhases;
      const position = dto.phaseCode ? definitions.findIndex((definition) => definition.code === dto.phaseCode) + 1 : 0;
      if (dto.phaseCode && position === 0) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['phaseCode'] });

      const report = await this.construction.insertReport(queryRunner.manager, {
        market: project.market,
        projectId: project.id,
        phaseCode: dto.phaseCode ?? null,
        engineerId: actor.id,
        visitDate: dto.visitDate,
        summary: dto.summary.trim(),
        verdict: dto.verdict,
      });

      let drafts: NotificationDraft[] = [];
      if (dto.phaseCode) {
        let phase = await this.construction.phaseForUpdate(queryRunner.manager, project.id, dto.phaseCode);
        if (!phase) {
          await this.construction.insertPhase(queryRunner.manager, {
            market: project.market,
            projectId: project.id,
            phaseCode: dto.phaseCode,
            position,
            plannedDate: null,
          });
          phase = await this.construction.phaseForUpdate(queryRunner.manager, project.id, dto.phaseCode);
        }
        if (!phase) throw new ApiError(ApiErrorCode.InternalError);
        if (decidesPhase && phase.status === 'CONFIRMED') throw new ApiError(ApiErrorCode.InvalidStateTransition);

        if (dto.verdict === 'PHASE_CONFIRMED') {
          await this.construction.updatePhase(queryRunner.manager, phase.id, {
            status: 'CONFIRMED',
            actualDate: dto.visitDate,
            confirmedById: actor.id,
            confirmedAt: new Date(),
          });
          drafts = await this.payments.onPhaseConfirmed(queryRunner.manager, project.id, dto.phaseCode, actor.id);
        } else if (dto.verdict === 'PHASE_REJECTED') {
          await this.construction.updatePhase(queryRunner.manager, phase.id, { status: 'REJECTED' });
        } else if (phase.status === 'PLANNED') {
          await this.construction.updatePhase(queryRunner.manager, phase.id, { status: 'IN_PROGRESS' });
        }
      }

      await this.audit.record(queryRunner.manager, {
        market: project.market,
        actorId: actor.id,
        action: 'construction.report.created',
        entityType: 'engineer_report',
        entityId: report.id,
        data: { projectId: project.id, phaseCode: dto.phaseCode ?? null, verdict: dto.verdict },
      });
      const emails = await this.notifications.notify(queryRunner.manager, drafts);
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toReportResponse(report);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Fotografija ili PDF uz izveštaj. Otprema samo inženjer koji je napisao izveštaj. */
  async addReportFile(actor: AuthUser, reportId: string, upload: UploadedFileData | undefined): Promise<DocumentResponse> {
    const file = validateUploadedFile(upload);
    let stored: StoredFile | null = null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const report = await this.construction.findReport(queryRunner.manager, reportId);
      if (!report || report.engineerId !== actor.id || !hasMarketAccess(actor, report.market)) {
        throw new ApiError(ApiErrorCode.NotFound);
      }
      const typeCode = file.mimeType === 'application/pdf' ? 'REPORT_PDF' : 'REPORT_PHOTO';
      this.documents.assertTypeAllowed(report.market, 'REPORT', typeCode);
      stored = await this.documents.putFile(report.market, 'REPORT', file);

      await queryRunner.startTransaction();
      const document = await this.documents.insert(
        queryRunner.manager,
        { market: report.market, scope: 'REPORT', purchaseId: null, projectId: report.projectId, developerId: null, reportId: report.id },
        typeCode,
        stored,
        actor.id,
      );
      await queryRunner.commitTransaction();
      return toDocumentResponse(document);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      if (stored) await this.documents.discard(stored);
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Izveštaji projekta. Fotografije: GET /documents?projectId=…&reportId=… */
  async listReports(actor: AuthUser, projectId: string): Promise<EngineerReportResponse[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const project = await this.visibleProject(queryRunner.manager, actor, projectId);
      const reports = await this.construction.listReports(queryRunner.manager, project.id);
      return reports.map(toReportResponse);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  private async visibleProject(manager: Parameters<CatalogService['getProject']>[0], actor: AuthUser, projectId: string): Promise<Project> {
    const project = await this.catalog.getProject(manager, projectId);
    if (!(await this.purchaseAccess.canSeeProject(manager, actor, project.id, project.market))) {
      throw new ApiError(ApiErrorCode.NotFound);
    }
    return project;
  }

  private toConstruction(project: Project, phases: readonly ConstructionPhase[]): ConstructionResponse {
    const byCode = new Map(phases.map((phase) => [phase.phaseCode, phase]));
    const now = today();
    return {
      projectId: project.id,
      phases: this.markets.get(project.market).constructionPhases.map((definition, index) => {
        const phase = byCode.get(definition.code);
        const status = phase?.status ?? 'PLANNED';
        const plannedDate = phase?.plannedDate ?? null;
        return {
          phaseCode: definition.code,
          title: definition.title,
          position: index + 1,
          defaultSharePercent: definition.defaultSharePercent,
          plannedDate,
          actualDate: phase?.actualDate ?? null,
          status,
          confirmedAt: phase?.confirmedAt ? phase.confirmedAt.toISOString() : null,
          late: plannedDate !== null && plannedDate < now && status !== 'CONFIRMED',
        };
      }),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { AuthUser } from '../access/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import type { Purchase } from '../purchases/entities/purchase.entity.js';
import { PurchaseAccessService } from '../purchases/purchase-access.service.js';
import type { CreateDefectDto, RecordHandoverDto, UpdateDefectDto } from './dto/handover.dto.js';
import type { Defect } from './entities/defect.entity.js';
import type { Handover } from './entities/handover.entity.js';
import { HandoverRepository } from './handover.repository.js';

export interface HandoverResponse {
  purchaseId: string;
  engineerId: string;
  inspectedAt: string;
  contractArea: number;
  measuredArea: number;
  /** Izmereno minus ugovoreno, u m². Negativno: stan je manji od ugovorenog. */
  areaDifference: number;
  /** Razlika u procentima ugovorene površine. */
  areaDifferencePercent: number;
  notes: string | null;
  keysHandedAt: string | null;
}

export interface DefectResponse {
  id: string;
  description: string;
  severity: Defect['severity'];
  dueDate: string | null;
  status: Defect['status'];
  reportedById: string;
  fixedAt: string | null;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toHandoverResponse(handover: Handover): HandoverResponse {
  const difference = handover.measuredArea - handover.contractArea;
  return {
    purchaseId: handover.purchaseId,
    engineerId: handover.engineerId,
    inspectedAt: handover.inspectedAt.toISOString(),
    contractArea: handover.contractArea,
    measuredArea: handover.measuredArea,
    areaDifference: round2(difference),
    areaDifferencePercent: handover.contractArea > 0 ? round2((difference / handover.contractArea) * 100) : 0,
    notes: handover.notes,
    keysHandedAt: handover.keysHandedAt ? handover.keysHandedAt.toISOString() : null,
  };
}

function toDefectResponse(defect: Defect): DefectResponse {
  return {
    id: defect.id,
    description: defect.description,
    severity: defect.severity,
    dueDate: defect.dueDate,
    status: defect.status,
    reportedById: defect.reportedById,
    fixedAt: defect.fixedAt ? defect.fixedAt.toISOString() : null,
    confirmedById: defect.confirmedById,
    confirmedAt: defect.confirmedAt ? defect.confirmedAt.toISOString() : null,
    createdAt: defect.createdAt.toISOString(),
  };
}

/** Primopredaja, merenje površine i zapisnik o nedostacima (F-20, F-21). */
@Injectable()
export class HandoverService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly handovers: HandoverRepository,
    private readonly purchaseAccess: PurchaseAccessService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async getHandover(actor: AuthUser, purchaseId: string): Promise<{ handover: HandoverResponse | null; defects: DefectResponse[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const { purchase } = await this.purchaseAccess.get(queryRunner.manager, purchaseId, actor);
      const handover = await this.handovers.findHandover(queryRunner.manager, purchase.id);
      const defects = await this.handovers.listDefects(queryRunner.manager, purchase.id);
      return { handover: handover ? toHandoverResponse(handover) : null, defects: defects.map(toDefectResponse) };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Pregled i merenje stana. Upisuje inženjer kupovine; može da se ispravi dok ključevi nisu predati. */
  async recordHandover(actor: AuthUser, purchaseId: string, dto: RecordHandoverDto): Promise<HandoverResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const access = await this.purchaseAccess.getForUpdate(queryRunner.manager, purchaseId, actor);
      this.purchaseAccess.require(access, 'ENGINEER');
      const { purchase } = access;
      this.assertActive(purchase);

      const existing = await this.handovers.findHandoverForUpdate(queryRunner.manager, purchase.id);
      if (existing?.keysHandedAt) throw new ApiError(ApiErrorCode.InvalidStateTransition);
      const data = {
        engineerId: actor.id,
        inspectedAt: new Date(dto.inspectedAt),
        contractArea: dto.contractArea,
        measuredArea: dto.measuredArea,
        notes: dto.notes?.trim() || null,
      };
      if (existing) await this.handovers.updateHandover(queryRunner.manager, existing.id, data);
      else await this.handovers.insertHandover(queryRunner.manager, { market: purchase.market, purchaseId: purchase.id, ...data });

      const handover = await this.handovers.findHandover(queryRunner.manager, purchase.id);
      if (!handover) throw new ApiError(ApiErrorCode.InternalError);
      const response = toHandoverResponse(handover);
      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'handover.recorded',
        entityType: 'purchase',
        entityId: purchase.id,
        data: { contractArea: dto.contractArea, measuredArea: dto.measuredArea, differencePercent: response.areaDifferencePercent },
      });
      const emails = await this.notifications.notify(
        queryRunner.manager,
        this.recipients(purchase, actor.id, {
          type: 'handover.recorded',
          title: 'Stan je pregledan i izmeren',
          body: `Izmerena površina je ${dto.measuredArea} m² (ugovoreno ${dto.contractArea} m²).`,
        }),
      );
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return response;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Predaja ključeva (koordinator, naš tim ili inženjer). Pre toga mora postojati zapisnik o pregledu. */
  async handOverKeys(actor: AuthUser, purchaseId: string): Promise<HandoverResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const access = await this.purchaseAccess.getForUpdate(queryRunner.manager, purchaseId, actor);
      this.purchaseAccess.require(access, 'COORDINATOR', 'INTERNAL', 'ENGINEER');
      const { purchase } = access;
      this.assertActive(purchase);

      const handover = await this.handovers.findHandoverForUpdate(queryRunner.manager, purchase.id);
      if (!handover || handover.keysHandedAt) throw new ApiError(ApiErrorCode.InvalidStateTransition);
      const now = new Date();
      await this.handovers.updateHandover(queryRunner.manager, handover.id, { keysHandedAt: now });
      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'handover.keys',
        entityType: 'purchase',
        entityId: purchase.id,
        data: null,
      });
      const emails = await this.notifications.notify(
        queryRunner.manager,
        this.recipients(purchase, actor.id, {
          type: 'handover.keys',
          title: 'Ključevi su predati',
          body: 'Primopredaja stana je završena. Sledeći korak je upis vlasništva.',
        }),
      );
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toHandoverResponse({ ...handover, keysHandedAt: now });
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createDefect(actor: AuthUser, purchaseId: string, dto: CreateDefectDto): Promise<DefectResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const access = await this.purchaseAccess.get(queryRunner.manager, purchaseId, actor);
      this.purchaseAccess.require(access, 'BUYER', 'COORDINATOR', 'INTERNAL', 'ENGINEER');
      const { purchase } = access;
      this.assertActive(purchase);

      const defect = await this.handovers.insertDefect(queryRunner.manager, {
        market: purchase.market,
        purchaseId: purchase.id,
        description: dto.description.trim(),
        severity: dto.severity,
        dueDate: dto.dueDate ?? null,
        reportedById: actor.id,
      });
      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'defect.created',
        entityType: 'defect',
        entityId: defect.id,
        data: { purchaseId: purchase.id, severity: dto.severity },
      });
      const emails = await this.notifications.notify(
        queryRunner.manager,
        this.recipients(purchase, actor.id, {
          type: 'defect.created',
          title: 'Upisan je nedostatak',
          body: 'U zapisnik o nedostacima dodat je nov nedostatak.',
        }),
      );
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toDefectResponse(defect);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** OPEN → FIXED (koordinator ili naš tim beleži da je investitor otklonio) → CONFIRMED (kupac ili inženjer). */
  async updateDefect(actor: AuthUser, defectId: string, dto: UpdateDefectDto): Promise<DefectResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const defect = await this.handovers.findDefectForUpdate(queryRunner.manager, defectId);
      if (!defect) throw new ApiError(ApiErrorCode.NotFound);
      const access = await this.purchaseAccess.get(queryRunner.manager, defect.purchaseId, actor);
      const { purchase } = access;

      const now = new Date();
      let updated: Defect;
      if (dto.status === 'FIXED') {
        this.purchaseAccess.require(access, 'COORDINATOR', 'INTERNAL');
        if (defect.status !== 'OPEN') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.handovers.updateDefect(queryRunner.manager, defect.id, { status: 'FIXED', fixedAt: now });
        updated = { ...defect, status: 'FIXED', fixedAt: now };
      } else {
        this.purchaseAccess.require(access, 'BUYER', 'ENGINEER');
        if (defect.status !== 'FIXED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
        await this.handovers.updateDefect(queryRunner.manager, defect.id, { status: 'CONFIRMED', confirmedById: actor.id, confirmedAt: now });
        updated = { ...defect, status: 'CONFIRMED', confirmedById: actor.id, confirmedAt: now };
      }
      await this.audit.record(queryRunner.manager, {
        market: purchase.market,
        actorId: actor.id,
        action: dto.status === 'FIXED' ? 'defect.fixed' : 'defect.confirmed',
        entityType: 'defect',
        entityId: defect.id,
        data: { purchaseId: purchase.id },
      });
      const emails = await this.notifications.notify(
        queryRunner.manager,
        this.recipients(purchase, actor.id, {
          type: dto.status === 'FIXED' ? 'defect.fixed' : 'defect.confirmed',
          title: dto.status === 'FIXED' ? 'Nedostatak je otklonjen' : 'Otklanjanje nedostatka je potvrđeno',
          body: dto.status === 'FIXED' ? 'Investitor je otklonio nedostatak. Proverite i potvrdite.' : 'Nedostatak je zatvoren.',
        }),
      );
      await queryRunner.commitTransaction();
      await this.notifications.sendEmails(emails);
      return toDefectResponse(updated);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Kupac, koordinator i inženjer kupovine, osim onoga ko je uradio radnju. */
  private recipients(purchase: Purchase, actorId: string, content: Omit<NotificationDraft, 'userId' | 'link'>): NotificationDraft[] {
    const ids = new Set([purchase.buyerId, purchase.coordinatorId, purchase.engineerId].filter((id): id is string => !!id && id !== actorId));
    return [...ids].map((userId) => ({ ...content, userId, link: `/purchases/${purchase.id}` }));
  }

  private assertActive(purchase: Purchase): void {
    if (purchase.status !== 'ACTIVE') throw new ApiError(ApiErrorCode.InvalidStateTransition);
  }
}

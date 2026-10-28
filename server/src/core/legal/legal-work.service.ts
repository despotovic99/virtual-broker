import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { EmailMessage } from '../../integrations/dummy/dummy-email.sender.js';
import type { AuthUser } from '../access/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service.js';
import { PurchaseAccessService } from '../purchases/purchase-access.service.js';
import type {
  CreateLegalOpinionDto,
  CreatePowerOfAttorneyDto,
  LegalOpinionDto,
  PowerOfAttorneyDto,
} from './dto/legal-work.dto.js';
import type { LegalOpinion } from './entities/legal-opinion.entity.js';
import type { PowerOfAttorney } from './entities/power-of-attorney.entity.js';
import { LegalWorkRepository } from './legal-work.repository.js';

function toPowerOfAttorneyDto(poa: PowerOfAttorney, today: string): PowerOfAttorneyDto {
  return {
    id: poa.id,
    purchaseId: poa.purchaseId,
    documentId: poa.documentId,
    scope: [...poa.scope],
    validUntil: poa.validUntil,
    revokedAt: poa.revokedAt ? poa.revokedAt.toISOString() : null,
    createdById: poa.createdById,
    createdAt: poa.createdAt.toISOString(),
    valid: !poa.revokedAt && (!poa.validUntil || poa.validUntil >= today),
  };
}

function toOpinionDto(opinion: LegalOpinion): LegalOpinionDto {
  return {
    id: opinion.id,
    purchaseId: opinion.purchaseId,
    conclusion: opinion.conclusion,
    reasoning: opinion.reasoning,
    conditions: opinion.conditions,
    documentId: opinion.documentId,
    authorId: opinion.authorId,
    createdAt: opinion.createdAt.toISOString(),
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rad pravnog tima na kupovini (F-12, F-13): punomoćje kupca i pravno
 * mišljenje pre potpisa. Dokumenti se potpisuju van platforme i otpremaju
 * kao PDF (kvalifikovani e-potpis je integracija za kasnije).
 */
@Injectable()
export class LegalWorkService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly legal: LegalWorkRepository,
    private readonly access: PurchaseAccessService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async createPowerOfAttorney(actor: AuthUser, purchaseId: string, dto: CreatePowerOfAttorneyDto): Promise<PowerOfAttorneyDto> {
    let emails: EmailMessage[] = [];
    let result: PowerOfAttorneyDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.get(manager, purchaseId, actor);
      this.access.require(access, 'BUYER', 'LAWYER');
      const { purchase } = access;
      if (purchase.status === 'CANCELLED' || purchase.status === 'COMPLETED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
      if (dto.validUntil && dto.validUntil < today()) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['validUntil'] });

      const document = await this.documents.assertBelongsToPurchase(manager, dto.documentId, purchase.id);
      if (document.typeCode !== 'POWER_OF_ATTORNEY') throw new ApiError(ApiErrorCode.DocumentTypeNotAllowed);

      const poa = await this.legal.insertPowerOfAttorney(manager, {
        market: purchase.market,
        purchaseId: purchase.id,
        documentId: document.id,
        scope: [...dto.scope],
        validUntil: dto.validUntil ?? null,
        createdById: actor.id,
      });
      await this.audit.record(manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'power-of-attorney.created',
        entityType: 'power_of_attorney',
        entityId: poa.id,
        data: { purchaseId: purchase.id, scope: [...dto.scope], validUntil: dto.validUntil ?? null },
      });

      const drafts: NotificationDraft[] = [];
      const recipients = [purchase.lawyerId, purchase.coordinatorId, purchase.buyerId].filter(
        (id): id is string => id !== null && id !== actor.id,
      );
      for (const userId of new Set(recipients)) {
        drafts.push({
          userId,
          type: 'power-of-attorney.created',
          title: 'Punomoćje je otpremljeno',
          body: 'Na kupovini je otpremljeno punomoćje advokatu.',
          link: `/purchases/${purchase.id}`,
        });
      }
      emails = await this.notifications.notify(manager, drafts);
      result = toPowerOfAttorneyDto(poa, today());
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

  /** Opoziv punomoćja radi samo kupac (F-13 P10). */
  async revokePowerOfAttorney(actor: AuthUser, poaId: string): Promise<void> {
    let emails: EmailMessage[] = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const poa = await this.legal.findPowerOfAttorneyForUpdate(manager, poaId);
      if (!poa) throw new ApiError(ApiErrorCode.NotFound);
      const access = await this.access.get(manager, poa.purchaseId, actor);
      this.access.require(access, 'BUYER');
      if (!(await this.legal.revokePowerOfAttorney(manager, poa.id, new Date()))) {
        throw new ApiError(ApiErrorCode.InvalidStateTransition);
      }
      await this.audit.record(manager, {
        market: poa.market,
        actorId: actor.id,
        action: 'power-of-attorney.revoked',
        entityType: 'power_of_attorney',
        entityId: poa.id,
        data: { purchaseId: poa.purchaseId },
      });
      const { purchase } = access;
      const recipients = [purchase.lawyerId, purchase.coordinatorId].filter((id): id is string => id !== null);
      emails = await this.notifications.notify(
        manager,
        [...new Set(recipients)].map((userId) => ({
          userId,
          type: 'power-of-attorney.revoked',
          title: 'Punomoćje je opozvano',
          body: 'Kupac je opozvao punomoćje. Zadaci koji ga traže su zaustavljeni.',
          link: `/purchases/${purchase.id}`,
        })),
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    await this.notifications.sendEmails(emails);
  }

  async listPowersOfAttorney(actor: AuthUser, purchaseId: string): Promise<PowerOfAttorneyDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await this.access.get(queryRunner.manager, purchaseId, actor);
      const items = await this.legal.listPowersOfAttorney(queryRunner.manager, purchaseId);
      const date = today();
      return items.map((poa) => toPowerOfAttorneyDto(poa, date));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Mišljenje potpisuje samo advokat tima kupovine sa ulogom LEAD ili LAWYER (saradnik ne sme). */
  async createOpinion(actor: AuthUser, purchaseId: string, dto: CreateLegalOpinionDto): Promise<LegalOpinionDto> {
    let emails: EmailMessage[] = [];
    let result: LegalOpinionDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const access = await this.access.get(manager, purchaseId, actor);
      if (!access.relations.has('LAWYER') || (access.legalTeamRole !== 'LEAD' && access.legalTeamRole !== 'LAWYER')) {
        throw new ApiError(ApiErrorCode.Forbidden);
      }
      const { purchase } = access;
      if (purchase.status !== 'ACTIVE') throw new ApiError(ApiErrorCode.InvalidStateTransition);

      const document = await this.documents.assertBelongsToPurchase(manager, dto.documentId, purchase.id);
      if (document.typeCode !== 'LEGAL_OPINION') throw new ApiError(ApiErrorCode.DocumentTypeNotAllowed);

      const opinion = await this.legal.insertOpinion(manager, {
        market: purchase.market,
        purchaseId: purchase.id,
        conclusion: dto.conclusion,
        reasoning: dto.reasoning.trim(),
        conditions: dto.conditions?.trim() ?? null,
        documentId: document.id,
        authorId: actor.id,
      });
      await this.audit.record(manager, {
        market: purchase.market,
        actorId: actor.id,
        action: 'legal-opinion.created',
        entityType: 'legal_opinion',
        entityId: opinion.id,
        data: { purchaseId: purchase.id, conclusion: dto.conclusion, documentId: document.id },
      });

      const labels = { SIGN: 'potpisati', SIGN_WITH_CONDITIONS: 'potpisati uz uslove', DO_NOT_SIGN: 'ne potpisati' };
      const recipients = [purchase.buyerId, purchase.coordinatorId].filter((id): id is string => id !== null && id !== actor.id);
      emails = await this.notifications.notify(
        manager,
        [...new Set(recipients)].map((userId) => ({
          userId,
          type: 'legal-opinion.created',
          title: 'Pravno mišljenje je spremno',
          body: `Advokat je dao pravno mišljenje: ${labels[dto.conclusion]}.`,
          link: `/purchases/${purchase.id}`,
        })),
      );
      result = toOpinionDto(opinion);
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

  async listOpinions(actor: AuthUser, purchaseId: string): Promise<LegalOpinionDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await this.access.get(queryRunner.manager, purchaseId, actor);
      const items = await this.legal.listOpinions(queryRunner.manager, purchaseId);
      return items.map(toOpinionDto);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}

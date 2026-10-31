import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { toPage, type Page } from '../../common/pagination/pagination.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { DocumentScope } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import { StorageService } from '../../storage/storage.service.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole, isInternalOnMarket } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PurchaseAccessService } from '../purchases/purchase-access.service.js';
import type { ListDocumentsQueryDto, UploadDocumentDto } from './dto/upload-document.dto.js';
import { DocumentsRepository, type DocumentOwnerFilter } from './documents.repository.js';
import type { Document } from './entities/document.entity.js';
import { validateUploadedFile, type UploadedFileData, type ValidatedFile } from './file-validation.js';

export interface DocumentResponse {
  id: string;
  scope: Document['scope'];
  typeCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedById: string;
  createdAt: string;
}

export interface DocumentDownload {
  stream: Readable;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Fajl smešten u S3, pre upisa u bazu. */
export interface StoredFile {
  storageKey: string;
  sha256: string;
  file: ValidatedFile;
}

interface DocumentOwner {
  market: MarketCode;
  scope: Document['scope'];
  purchaseId: string | null;
  projectId: string | null;
  developerId: string | null;
  reportId: string | null;
}

export type DocumentListResponse = Page<DocumentResponse>;

export function toDocumentResponse(document: Document): DocumentResponse {
  return {
    id: document.id,
    scope: document.scope,
    typeCode: document.typeCode,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    uploadedById: document.uploadedById,
    createdAt: document.createdAt.toISOString(),
  };
}

/**
 * Trezor dokumenata (F-02). Fajl ide u S3 dok je konekcija otvorena, ali pre
 * transakcije; ako upis u bazu ne uspe, objekat se briše posle rollback-a.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly documents: DocumentsRepository,
    private readonly storage: StorageService,
    private readonly markets: MarketRegistry,
    private readonly purchaseAccess: PurchaseAccessService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  async upload(actor: AuthUser, dto: UploadDocumentDto, upload: UploadedFileData | undefined): Promise<DocumentResponse> {
    const file = validateUploadedFile(upload);
    let stored: StoredFile | null = null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const owner = await this.resolveOwnerForUpload(queryRunner.manager, actor, dto);
      this.assertTypeAllowed(owner.market, owner.scope, dto.typeCode);
      stored = await this.putFile(owner.market, owner.scope, file);

      await queryRunner.startTransaction();
      const document = await this.insert(queryRunner.manager, owner, dto.typeCode, stored, actor.id);
      await queryRunner.commitTransaction();
      return toDocumentResponse(document);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      if (stored) await this.discard(stored);
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async list(actor: AuthUser, query: ListDocumentsQueryDto): Promise<DocumentListResponse> {
    const filter: DocumentOwnerFilter = {};
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      if (query.purchaseId) {
        await this.purchaseAccess.get(queryRunner.manager, query.purchaseId, actor);
        filter.purchaseId = query.purchaseId;
      } else if (query.projectId || query.reportId) {
        if (!query.projectId) throw new ApiError(ApiErrorCode.InvalidRequest);
        const project = await this.catalog.getProject(queryRunner.manager, query.projectId);
        if (!(await this.purchaseAccess.canSeeProject(queryRunner.manager, actor, project.id, project.market))) {
          throw new ApiError(ApiErrorCode.NotFound);
        }
        filter.projectId = query.projectId;
        if (query.reportId) filter.reportId = query.reportId;
      } else if (query.developerId) {
        const developer = await this.catalog.getDeveloper(queryRunner.manager, query.developerId);
        if (!this.canSeeDeveloperDocuments(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
        filter.developerId = query.developerId;
      } else {
        throw new ApiError(ApiErrorCode.InvalidRequest);
      }
      const [documents, total] = await this.documents.list(queryRunner.manager, filter, query);
      return toPage(documents.map(toDocumentResponse), total, query);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async download(actor: AuthUser, id: string): Promise<DocumentDownload> {
    let document: Document;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const found = await this.documents.findById(queryRunner.manager, id);
      if (!found || !(await this.canRead(queryRunner.manager, actor, found))) throw new ApiError(ApiErrorCode.NotFound);
      document = found;
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    // Čitanje iz S3 posle oslobađanja konekcije.
    try {
      const stream = await this.storage.getObjectStream(document.storageKey);
      return { stream, fileName: document.fileName, mimeType: document.mimeType, sizeBytes: document.sizeBytes };
    } catch (error) {
      throwApiError(error);
    }
  }

  // ---- Metodi za druge module (učestvuju u tuđoj konekciji) ----

  /** Proverava da dokument postoji i pripada kupovini. Inače NOT_FOUND. */
  async assertBelongsToPurchase(manager: EntityManager, documentId: string, purchaseId: string): Promise<Document> {
    const document = await this.documents.findById(manager, documentId);
    if (!document || document.purchaseId !== purchaseId) throw new ApiError(ApiErrorCode.NotFound);
    return document;
  }

  /** Validira i smešta fajl u S3. Zove se pre transakcije. */
  async putFile(market: MarketCode, scope: Document['scope'], file: ValidatedFile): Promise<StoredFile> {
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `${market.toLowerCase()}/${scope.toLowerCase()}/${randomUUID()}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimeType, sha256);
    return { storageKey, sha256, file };
  }

  /** Upisuje dokument u bazu u transakciji vlasnika operacije. */
  async insert(
    manager: EntityManager,
    owner: DocumentOwner,
    typeCode: string,
    stored: StoredFile,
    uploadedById: string,
  ): Promise<Document> {
    const document = await this.documents.insert(manager, {
      ...owner,
      typeCode,
      fileName: stored.file.fileName,
      mimeType: stored.file.mimeType,
      sizeBytes: stored.file.buffer.length,
      sha256: stored.sha256,
      storageKey: stored.storageKey,
      uploadedById,
    });
    await this.audit.record(manager, {
      market: owner.market,
      actorId: uploadedById,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: document.id,
      data: {
        scope: owner.scope,
        typeCode,
        purchaseId: owner.purchaseId,
        projectId: owner.projectId,
        developerId: owner.developerId,
        reportId: owner.reportId,
        // Samo naziv i vrsta fajla, nikad sadržaj.
        changes: auditInitial(document, ['typeCode', 'fileName']),
      },
    });
    return document;
  }

  /** Briše fajl iz S3 posle neuspelog upisa (najbolji pokušaj, greška ide samo u log). */
  async discard(stored: StoredFile): Promise<void> {
    try {
      await this.storage.deleteObject(stored.storageKey);
    } catch (error) {
      this.logger.warn(`Fajl ${stored.storageKey} nije obrisan posle neuspelog upisa.`, error instanceof Error ? error.stack : undefined);
    }
  }

  assertTypeAllowed(market: MarketCode, scope: DocumentScope, typeCode: string): void {
    const type = this.markets.get(market).documentTypes.find((definition) => definition.code === typeCode);
    if (!type || !type.scopes.includes(scope)) throw new ApiError(ApiErrorCode.DocumentTypeNotAllowed);
  }

  // ---- Pristup ----

  private async resolveOwnerForUpload(manager: EntityManager, actor: AuthUser, dto: UploadDocumentDto): Promise<DocumentOwner> {
    if (dto.scope === 'PURCHASE') {
      if (!dto.purchaseId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['purchaseId'] });
      const access = await this.purchaseAccess.get(manager, dto.purchaseId, actor);
      const { purchase } = access;
      return { market: purchase.market, scope: 'PURCHASE', purchaseId: purchase.id, projectId: null, developerId: null, reportId: null };
    }
    if (dto.scope === 'PROJECT') {
      if (!dto.projectId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['projectId'] });
      const project = await this.catalog.getProject(manager, dto.projectId);
      if (!this.canManageCatalogDocuments(actor, project.market)) throw new ApiError(ApiErrorCode.NotFound);
      return { market: project.market, scope: 'PROJECT', purchaseId: null, projectId: project.id, developerId: null, reportId: null };
    }
    if (!dto.developerId) throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['developerId'] });
    const developer = await this.catalog.getDeveloper(manager, dto.developerId);
    if (!this.canManageCatalogDocuments(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
    return { market: developer.market, scope: 'DEVELOPER', purchaseId: null, projectId: null, developerId: developer.id, reportId: null };
  }

  private async canRead(manager: EntityManager, actor: AuthUser, document: Document): Promise<boolean> {
    if (document.purchaseId) {
      try {
        await this.purchaseAccess.get(manager, document.purchaseId, actor);
        return true;
      } catch {
        return false;
      }
    }
    if (document.projectId) return this.purchaseAccess.canSeeProject(manager, actor, document.projectId, document.market);
    return this.canSeeDeveloperDocuments(actor, document.market);
  }

  /** Dokumenta projekta i investitora otpremaju naš tim i advokati na tržištu. */
  private canManageCatalogDocuments(actor: AuthUser, market: MarketCode): boolean {
    return isInternalOnMarket(actor, market) || (hasRole(actor, Role.Lawyer) && hasMarketAccess(actor, market));
  }

  private canSeeDeveloperDocuments(actor: AuthUser, market: MarketCode): boolean {
    return this.canManageCatalogDocuments(actor, market);
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { expectError, throwApiError } from '../../common/errors/throw-api-error.js';
import { isUniqueViolation } from '../../common/utils/db-error.util.js';
import type { AuthUser } from '../access/auth-user.js';
import { assertMarketAccess } from '../access/market-access.js';
import { AuditService } from '../audit/audit.service.js';
import { CatalogAdminRepository } from './catalog-admin.repository.js';
import {
  toBankAccountResponse,
  toDeveloperResponse,
  toProjectResponse,
  toUnitResponse,
  type BankAccountResponse,
  type DeveloperResponse,
  type ProjectResponse,
  type UnitResponse,
} from './catalog.mapper.js';
import { canSeeFullIban, catalogStaffMarkets, isCatalogStaffOn } from './catalog-scope.js';
import type {
  CreateBankAccountDto,
  CreateDeveloperDto,
  CreateProjectDto,
  CreateUnitDto,
  ListDevelopersQueryDto,
  ListProjectsQueryDto,
  UpdateDeveloperDto,
  UpdateProjectDto,
  UpdateUnitDto,
  VerifyBankAccountDto,
} from './dto/catalog.dto.js';
import type { Developer } from './entities/developer.entity.js';
import type { Project } from './entities/project.entity.js';
import type { Unit } from './entities/unit.entity.js';

export interface ProjectListResponse {
  items: ProjectResponse[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Katalog (F-04, F-32): unos investitora, projekata, stanova i računa (naš
 * tim, jer investitorska platforma nije u MVP-u) i pretraga projekata.
 * Unos radi analitičar na svom tržištu (capability catalog:manage).
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogAdminRepository,
    private readonly audit: AuditService,
  ) {}

  // ---- Investitori ----

  async listDevelopers(actor: AuthUser, query: ListDevelopersQueryDto): Promise<DeveloperResponse[]> {
    const markets = catalogStaffMarkets(actor).filter((market) => !query.market || market === query.market);
    if (markets.length === 0) throw new ApiError(ApiErrorCode.Forbidden);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const developers = await this.catalog.listDevelopers(queryRunner.manager, markets, query.search?.trim() || undefined);
      return developers.map(toDeveloperResponse);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async getDeveloper(actor: AuthUser, id: string): Promise<DeveloperResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const developer = await this.catalog.findDeveloper(queryRunner.manager, id);
      if (!developer || !isCatalogStaffOn(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
      return toDeveloperResponse(developer);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createDeveloper(actor: AuthUser, dto: CreateDeveloperDto): Promise<DeveloperResponse> {
    assertMarketAccess(actor, dto.market);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const developer = await this.catalog.insertDeveloper(queryRunner.manager, {
        market: dto.market,
        name: dto.name.trim(),
        registrationNumber: dto.registrationNumber.trim(),
        taxNumber: dto.taxNumber?.trim() ?? null,
        address: dto.address?.trim() || null,
        website: dto.website ?? null,
        createdById: actor.id,
      });
      await this.audit.record(queryRunner.manager, {
        market: developer.market,
        actorId: actor.id,
        action: 'catalog.developer.created',
        entityType: 'developer',
        entityId: developer.id,
        data: { name: developer.name, registrationNumber: developer.registrationNumber },
      });
      await queryRunner.commitTransaction();
      return toDeveloperResponse(developer);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.DeveloperDuplicate)]);
    } finally {
      await queryRunner.release();
    }
  }

  async updateDeveloper(actor: AuthUser, id: string, dto: UpdateDeveloperDto): Promise<DeveloperResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await this.loadDeveloperForUpdate(queryRunner.manager, actor, id);
      const changes: Partial<Developer> = {};
      if (dto.name !== undefined) changes.name = dto.name.trim();
      if (dto.taxNumber !== undefined) changes.taxNumber = dto.taxNumber.trim() || null;
      if (dto.address !== undefined) changes.address = dto.address.trim() || null;
      if (dto.website !== undefined) changes.website = dto.website || null;
      const developer = await this.catalog.updateDeveloper(queryRunner.manager, id, changes);
      await this.audit.record(queryRunner.manager, {
        market: existing.market,
        actorId: actor.id,
        action: 'catalog.developer.updated',
        entityType: 'developer',
        entityId: id,
        data: { fields: Object.keys(changes) },
      });
      await queryRunner.commitTransaction();
      return toDeveloperResponse(developer);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Računi investitora (F-16) ----

  async listBankAccounts(actor: AuthUser, developerId: string): Promise<BankAccountResponse[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const developer = await this.catalog.findDeveloper(queryRunner.manager, developerId);
      if (!developer || !isCatalogStaffOn(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
      const accounts = await this.catalog.listBankAccounts(queryRunner.manager, developerId);
      const full = canSeeFullIban(actor, developer.market);
      return accounts.map((account) => toBankAccountResponse(account, full));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Nov račun je uvek neproveren. Promena IBAN-a = nov zapis i nova provera. */
  async addBankAccount(actor: AuthUser, developerId: string, dto: CreateBankAccountDto): Promise<BankAccountResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const developer = await this.loadDeveloperForUpdate(queryRunner.manager, actor, developerId);
      const account = await this.catalog.insertBankAccount(queryRunner.manager, {
        market: developer.market,
        developerId: developer.id,
        iban: dto.iban,
        bankName: dto.bankName.trim(),
        holderName: dto.holderName.trim(),
        verifiedAt: null,
        verifiedById: null,
        verificationNote: null,
        createdById: actor.id,
      });
      await this.audit.record(queryRunner.manager, {
        market: developer.market,
        actorId: actor.id,
        action: 'catalog.bank_account.added',
        entityType: 'developer_bank_account',
        entityId: account.id,
        data: { developerId: developer.id, ibanLast4: account.iban.slice(-4) },
      });
      await queryRunner.commitTransaction();
      return toBankAccountResponse(account, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Proveru računa radi druga osoba, ne ona koja je račun unela (četiri oka). */
  async verifyBankAccount(actor: AuthUser, accountId: string, dto: VerifyBankAccountDto): Promise<BankAccountResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const account = await this.catalog.findBankAccountForUpdate(queryRunner.manager, accountId);
      if (!account || !isCatalogStaffOn(actor, account.market)) throw new ApiError(ApiErrorCode.NotFound);
      assertMarketAccess(actor, account.market);
      if (account.verifiedAt) throw new ApiError(ApiErrorCode.InvalidStateTransition);
      if (account.createdById === actor.id) throw new ApiError(ApiErrorCode.BankAccountSameVerifier);
      const verified = await this.catalog.markBankAccountVerified(queryRunner.manager, accountId, actor.id, dto.note.trim(), new Date());
      await this.audit.record(queryRunner.manager, {
        market: account.market,
        actorId: actor.id,
        action: 'catalog.bank_account.verified',
        entityType: 'developer_bank_account',
        entityId: account.id,
        data: { developerId: account.developerId, ibanLast4: account.iban.slice(-4) },
      });
      await queryRunner.commitTransaction();
      return toBankAccountResponse(verified, true);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Projekti ----

  async searchProjects(actor: AuthUser, query: ListProjectsQueryDto): Promise<ProjectListResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [projects, total] = await this.catalog.searchProjects(queryRunner.manager, {
        fullAccessMarkets: catalogStaffMarkets(actor),
        market: query.market,
        city: query.city?.trim() || undefined,
        developerId: query.developerId,
        maxPrice: query.maxPrice,
        minRooms: query.minRooms,
        limit: query.limit,
        offset: query.offset,
      });
      return { items: projects.map((project) => toProjectResponse(project)), total, limit: query.limit, offset: query.offset };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async createProject(actor: AuthUser, dto: CreateProjectDto): Promise<ProjectResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const developer = await this.loadDeveloperForUpdate(queryRunner.manager, actor, dto.developerId);
      const project = await this.catalog.insertProject(queryRunner.manager, {
        market: developer.market,
        developerId: developer.id,
        name: dto.name.trim(),
        city: dto.city.trim(),
        address: dto.address.trim(),
        parcelReference: dto.parcelReference?.trim() || null,
        description: dto.description?.trim() || null,
        expectedCompletion: dto.expectedCompletion ?? null,
        status: 'DRAFT',
        createdById: actor.id,
      });
      await this.audit.record(queryRunner.manager, {
        market: project.market,
        actorId: actor.id,
        action: 'catalog.project.created',
        entityType: 'project',
        entityId: project.id,
        data: { developerId: developer.id, name: project.name },
      });
      await queryRunner.commitTransaction();
      return toProjectResponse(project);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async updateProject(actor: AuthUser, id: string, dto: UpdateProjectDto): Promise<ProjectResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await this.loadProjectForUpdate(queryRunner.manager, actor, id);
      const changes: Partial<Project> = {};
      if (dto.name !== undefined) changes.name = dto.name.trim();
      if (dto.city !== undefined) changes.city = dto.city.trim();
      if (dto.address !== undefined) changes.address = dto.address.trim();
      if (dto.parcelReference !== undefined) changes.parcelReference = dto.parcelReference.trim() || null;
      if (dto.description !== undefined) changes.description = dto.description.trim() || null;
      if (dto.expectedCompletion !== undefined) changes.expectedCompletion = dto.expectedCompletion;
      if (dto.status !== undefined) changes.status = dto.status;
      const project = await this.catalog.updateProject(queryRunner.manager, id, changes);
      await this.audit.record(queryRunner.manager, {
        market: existing.market,
        actorId: actor.id,
        action: dto.status && dto.status !== existing.status ? `catalog.project.${dto.status.toLowerCase()}` : 'catalog.project.updated',
        entityType: 'project',
        entityId: id,
        data: { fields: Object.keys(changes), previousStatus: existing.status },
      });
      await queryRunner.commitTransaction();
      return toProjectResponse(project);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Stanovi ----

  async createUnit(actor: AuthUser, projectId: string, dto: CreateUnitDto): Promise<UnitResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const project = await this.loadProjectForUpdate(queryRunner.manager, actor, projectId);
      const unit = await this.catalog.insertUnit(queryRunner.manager, {
        market: project.market,
        projectId: project.id,
        label: dto.label.trim(),
        floor: dto.floor ?? null,
        rooms: dto.rooms ?? null,
        area: dto.area,
        price: dto.price,
        status: 'AVAILABLE',
      });
      await this.audit.record(queryRunner.manager, {
        market: project.market,
        actorId: actor.id,
        action: 'catalog.unit.created',
        entityType: 'unit',
        entityId: unit.id,
        data: { projectId: project.id, label: unit.label, price: unit.price },
      });
      await queryRunner.commitTransaction();
      return toUnitResponse(unit);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UnitLabelTaken)]);
    } finally {
      await queryRunner.release();
    }
  }

  async updateUnit(actor: AuthUser, unitId: string, dto: UpdateUnitDto): Promise<UnitResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await this.catalog.findUnitForUpdate(queryRunner.manager, unitId);
      if (!existing || !isCatalogStaffOn(actor, existing.market)) throw new ApiError(ApiErrorCode.NotFound);
      assertMarketAccess(actor, existing.market);
      // Rezervaciju postavlja i skida samo kupovina; ručno se ne menja.
      if (dto.status !== undefined && (dto.status === 'RESERVED' || existing.status === 'RESERVED')) {
        throw new ApiError(ApiErrorCode.InvalidStateTransition);
      }
      const changes: Partial<Unit> = {};
      if (dto.label !== undefined) changes.label = dto.label.trim();
      if (dto.floor !== undefined) changes.floor = dto.floor;
      if (dto.rooms !== undefined) changes.rooms = dto.rooms;
      if (dto.area !== undefined) changes.area = dto.area;
      if (dto.price !== undefined) changes.price = dto.price;
      if (dto.status !== undefined) changes.status = dto.status;
      const unit = await this.catalog.updateUnit(queryRunner.manager, unitId, changes);
      await this.audit.record(queryRunner.manager, {
        market: existing.market,
        actorId: actor.id,
        action: 'catalog.unit.updated',
        entityType: 'unit',
        entityId: unitId,
        data: { fields: Object.keys(changes), previousPrice: existing.price, previousStatus: existing.status },
      });
      await queryRunner.commitTransaction();
      return toUnitResponse(unit);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UnitLabelTaken)]);
    } finally {
      await queryRunner.release();
    }
  }

  // ---- Pomoćno (u okviru konekcije vlasnika) ----

  private async loadDeveloperForUpdate(manager: EntityManager, actor: AuthUser, id: string): Promise<Developer> {
    const developer = await this.catalog.findDeveloperForUpdate(manager, id);
    if (!developer || !isCatalogStaffOn(actor, developer.market)) throw new ApiError(ApiErrorCode.NotFound);
    assertMarketAccess(actor, developer.market);
    return developer;
  }

  private async loadProjectForUpdate(manager: EntityManager, actor: AuthUser, id: string): Promise<Project> {
    const project = await this.catalog.findProjectForUpdate(manager, id);
    if (!project || !isCatalogStaffOn(actor, project.market)) throw new ApiError(ApiErrorCode.NotFound);
    assertMarketAccess(actor, project.market);
    return project;
  }
}

import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { CatalogRepository } from './catalog.repository.js';
import type { DeveloperBankAccount } from './entities/developer-bank-account.entity.js';
import type { Developer } from './entities/developer.entity.js';
import type { Project } from './entities/project.entity.js';
import type { Unit } from './entities/unit.entity.js';

/**
 * Metodi kataloga koje koriste drugi moduli. Svi učestvuju u tuđoj
 * konekciji (primaju EntityManager). Nepostojeći zapis je NOT_FOUND.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  async getDeveloper(manager: EntityManager, id: string): Promise<Developer> {
    const developer = await this.catalog.findDeveloper(manager, id);
    if (!developer) throw new ApiError(ApiErrorCode.NotFound);
    return developer;
  }

  async getProject(manager: EntityManager, id: string): Promise<Project> {
    const project = await this.catalog.findProject(manager, id);
    if (!project) throw new ApiError(ApiErrorCode.NotFound);
    return project;
  }

  async getUnit(manager: EntityManager, id: string): Promise<Unit> {
    const unit = await this.catalog.findUnit(manager, id);
    if (!unit) throw new ApiError(ApiErrorCode.NotFound);
    return unit;
  }

  /**
   * Rezerviše stan za kupovinu (u transakciji vlasnika, sa lock-om).
   * Samo slobodan stan može da se rezerviše.
   */
  async reserveUnit(manager: EntityManager, unitId: string): Promise<Unit> {
    const unit = await this.catalog.findUnitForUpdate(manager, unitId);
    if (!unit) throw new ApiError(ApiErrorCode.NotFound);
    if (unit.status !== 'AVAILABLE') throw new ApiError(ApiErrorCode.UnitNotAvailable);
    await this.catalog.updateUnitStatus(manager, unitId, 'RESERVED');
    return { ...unit, status: 'RESERVED' };
  }

  listUnits(manager: EntityManager, projectId: string): Promise<Unit[]> {
    return this.catalog.listUnits(manager, projectId);
  }

  /** Investitor iz kataloga po matičnom/HE broju na tržištu, ili null. */
  findDeveloperByRegistration(manager: EntityManager, market: Developer['market'], registrationNumber: string): Promise<Developer | null> {
    return this.catalog.findDeveloperByRegistration(manager, market, registrationNumber);
  }

  async releaseUnit(manager: EntityManager, unitId: string): Promise<void> {
    await this.catalog.updateUnitStatus(manager, unitId, 'AVAILABLE');
  }

  async markUnitSold(manager: EntityManager, unitId: string): Promise<void> {
    await this.catalog.updateUnitStatus(manager, unitId, 'SOLD');
  }

  async getBankAccount(manager: EntityManager, id: string): Promise<DeveloperBankAccount> {
    const account = await this.catalog.findBankAccount(manager, id);
    if (!account) throw new ApiError(ApiErrorCode.NotFound);
    return account;
  }

  findLatestVerifiedAccount(manager: EntityManager, developerId: string): Promise<DeveloperBankAccount | null> {
    return this.catalog.findLatestVerifiedAccount(manager, developerId);
  }
}

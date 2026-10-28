import { Injectable } from '@nestjs/common';
import { Brackets, type EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import { DeveloperBankAccount } from './entities/developer-bank-account.entity.js';
import { Developer } from './entities/developer.entity.js';
import { Project } from './entities/project.entity.js';
import { Unit } from './entities/unit.entity.js';

export interface ProjectSearch {
  /** Tržišta na kojima korisnik vidi sve projekte (svi statusi). */
  fullAccessMarkets: readonly MarketCode[];
  market?: MarketCode;
  city?: string;
  developerId?: string;
  maxPrice?: number;
  minRooms?: number;
  limit: number;
  offset: number;
}

/** Unos i pretraga kataloga (back-office i kupac). Svaki metod prima EntityManager. */
@Injectable()
export class CatalogAdminRepository {
  // ---- Investitori ----

  async insertDeveloper(manager: EntityManager, data: Partial<Developer>): Promise<Developer> {
    const repository = manager.getRepository(Developer);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findDeveloper(manager: EntityManager, id: string): Promise<Developer | null> {
    return manager.getRepository(Developer).findOne({ where: { id } });
  }

  findDeveloperForUpdate(manager: EntityManager, id: string): Promise<Developer | null> {
    return manager.getRepository(Developer).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async updateDeveloper(manager: EntityManager, id: string, data: Partial<Developer>): Promise<Developer> {
    const repository = manager.getRepository(Developer);
    await repository.update({ id }, data);
    return repository.findOneOrFail({ where: { id } });
  }

  listDevelopers(manager: EntityManager, markets: readonly MarketCode[], search: string | undefined): Promise<Developer[]> {
    if (markets.length === 0) return Promise.resolve([]);
    const query = manager
      .getRepository(Developer)
      .createQueryBuilder('developer')
      .where('developer.market IN (:...markets)', { markets: [...markets] })
      .orderBy('developer.name', 'ASC')
      .take(200);
    if (search) {
      query.andWhere(
        new Brackets((where) => {
          where
            .where('developer.name ILIKE :search', { search: `%${escapeLike(search)}%` })
            .orWhere('developer.registrationNumber = :exact', { exact: search });
        }),
      );
    }
    return query.getMany();
  }

  findDeveloperByRegistration(manager: EntityManager, market: MarketCode, registrationNumber: string): Promise<Developer | null> {
    return manager.getRepository(Developer).findOne({ where: { market, registrationNumber } });
  }

  // ---- Računi ----

  async insertBankAccount(manager: EntityManager, data: Partial<DeveloperBankAccount>): Promise<DeveloperBankAccount> {
    const repository = manager.getRepository(DeveloperBankAccount);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findBankAccountForUpdate(manager: EntityManager, id: string): Promise<DeveloperBankAccount | null> {
    return manager.getRepository(DeveloperBankAccount).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async markBankAccountVerified(manager: EntityManager, id: string, userId: string, note: string, at: Date): Promise<DeveloperBankAccount> {
    const repository = manager.getRepository(DeveloperBankAccount);
    await repository.update({ id }, { verifiedAt: at, verifiedById: userId, verificationNote: note });
    return repository.findOneOrFail({ where: { id } });
  }

  listBankAccounts(manager: EntityManager, developerId: string): Promise<DeveloperBankAccount[]> {
    return manager.getRepository(DeveloperBankAccount).find({ where: { developerId }, order: { createdAt: 'DESC' } });
  }

  // ---- Projekti ----

  async insertProject(manager: EntityManager, data: Partial<Project>): Promise<Project> {
    const repository = manager.getRepository(Project);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id }, relations: { developer: true } });
  }

  findProjectForUpdate(manager: EntityManager, id: string): Promise<Project | null> {
    return manager.getRepository(Project).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async updateProject(manager: EntityManager, id: string, data: Partial<Project>): Promise<Project> {
    const repository = manager.getRepository(Project);
    await repository.update({ id }, data);
    return repository.findOneOrFail({ where: { id }, relations: { developer: true } });
  }

  /**
   * Kupac i svi ostali vide objavljene projekte; korisnik sa tržištem vidi i
   * neobjavljene na svojim tržištima. Filteri cene i soba gledaju slobodne stanove.
   */
  async searchProjects(manager: EntityManager, search: ProjectSearch): Promise<[Project[], number]> {
    const query = manager
      .getRepository(Project)
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.developer', 'developer')
      .where(
        new Brackets((where) => {
          where.where('project.status = :published', { published: 'PUBLISHED' });
          if (search.fullAccessMarkets.length > 0) {
            where.orWhere('project.market IN (:...fullAccessMarkets)', { fullAccessMarkets: [...search.fullAccessMarkets] });
          }
        }),
      )
      .orderBy('project.createdAt', 'DESC')
      .addOrderBy('project.id', 'ASC')
      .take(search.limit)
      .skip(search.offset);

    if (search.market) query.andWhere('project.market = :market', { market: search.market });
    if (search.city) query.andWhere('LOWER(project.city) = LOWER(:city)', { city: search.city });
    if (search.developerId) query.andWhere('project.developerId = :developerId', { developerId: search.developerId });
    if (search.maxPrice !== undefined || search.minRooms !== undefined) {
      const unitQuery = manager
        .getRepository(Unit)
        .createQueryBuilder('unit')
        .select('1')
        .where('unit.projectId = project.id')
        .andWhere('unit.status = :available');
      if (search.maxPrice !== undefined) unitQuery.andWhere('unit.price <= :maxPrice');
      if (search.minRooms !== undefined) unitQuery.andWhere('unit.rooms >= :minRooms');
      query.andWhere(`EXISTS (${unitQuery.getQuery()})`, {
        available: 'AVAILABLE',
        ...(search.maxPrice !== undefined ? { maxPrice: search.maxPrice } : {}),
        ...(search.minRooms !== undefined ? { minRooms: search.minRooms } : {}),
      });
    }
    return query.getManyAndCount();
  }

  // ---- Stanovi ----

  async insertUnit(manager: EntityManager, data: Partial<Unit>): Promise<Unit> {
    const repository = manager.getRepository(Unit);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findUnitForUpdate(manager: EntityManager, id: string): Promise<Unit | null> {
    return manager.getRepository(Unit).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async updateUnit(manager: EntityManager, id: string, data: Partial<Unit>): Promise<Unit> {
    const repository = manager.getRepository(Unit);
    await repository.update({ id }, data);
    return repository.findOneOrFail({ where: { id } });
  }

  listUnits(manager: EntityManager, projectId: string): Promise<Unit[]> {
    return manager.getRepository(Unit).find({ where: { projectId }, order: { label: 'ASC' } });
  }
}

/** Escape za ILIKE: % i _ iz unosa se traže doslovno. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

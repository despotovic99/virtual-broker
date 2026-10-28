import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DeveloperBankAccount } from './entities/developer-bank-account.entity.js';
import { Developer } from './entities/developer.entity.js';
import { Project } from './entities/project.entity.js';
import { Unit, type UnitStatus } from './entities/unit.entity.js';

/**
 * Osnovni pristup katalogu (investitori, projekti, stanovi, računi).
 * Pretragu i unos za back-office dodaje CatalogAdminService.
 */
@Injectable()
export class CatalogRepository {
  findDeveloper(manager: EntityManager, id: string): Promise<Developer | null> {
    return manager.getRepository(Developer).findOne({ where: { id } });
  }

  findProject(manager: EntityManager, id: string): Promise<Project | null> {
    return manager.getRepository(Project).findOne({ where: { id } });
  }

  findUnit(manager: EntityManager, id: string): Promise<Unit | null> {
    return manager.getRepository(Unit).findOne({ where: { id }, relations: { project: true } });
  }

  /** Za rezervaciju: zaključava red stana do kraja transakcije. */
  findUnitForUpdate(manager: EntityManager, id: string): Promise<Unit | null> {
    return manager.getRepository(Unit).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  listUnits(manager: EntityManager, projectId: string): Promise<Unit[]> {
    return manager.getRepository(Unit).find({ where: { projectId }, order: { label: 'ASC' } });
  }

  findDeveloperByRegistration(manager: EntityManager, market: Developer['market'], registrationNumber: string): Promise<Developer | null> {
    return manager.getRepository(Developer).findOne({ where: { market, registrationNumber } });
  }

  async updateUnitStatus(manager: EntityManager, id: string, status: UnitStatus): Promise<void> {
    await manager.getRepository(Unit).update({ id }, { status });
  }

  findBankAccount(manager: EntityManager, id: string): Promise<DeveloperBankAccount | null> {
    return manager.getRepository(DeveloperBankAccount).findOne({ where: { id } });
  }

  /** Najnoviji proveren račun investitora. */
  findLatestVerifiedAccount(manager: EntityManager, developerId: string): Promise<DeveloperBankAccount | null> {
    return manager
      .getRepository(DeveloperBankAccount)
      .createQueryBuilder('account')
      .where('account.developerId = :developerId', { developerId })
      .andWhere('account.verifiedAt IS NOT NULL')
      .orderBy('account.verifiedAt', 'DESC')
      .getOne();
  }
}

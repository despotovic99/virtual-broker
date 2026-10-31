import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Document } from '../documents/entities/document.entity.js';
import { Check } from './entities/check.entity.js';

export type NewCheck = Omit<Check, 'id' | 'createdAt'>;

@Injectable()
export class ChecksRepository {
  async insertMany(manager: EntityManager, checks: readonly NewCheck[]): Promise<void> {
    if (checks.length === 0) return;
    await manager.getRepository(Check).insert([...checks]);
  }

  async insertOne(manager: EntityManager, check: NewCheck): Promise<Check> {
    const repository = manager.getRepository(Check);
    const result = await repository.insert(check);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  /** Poslednja provera po kodu za investitora (najnovija po checkedAt). */
  latestForDeveloper(manager: EntityManager, developerId: string): Promise<Check[]> {
    return manager
      .getRepository(Check)
      .createQueryBuilder('check')
      .distinctOn(['check.definitionCode'])
      .where('check.developerId = :developerId', { developerId })
      .orderBy('check.definitionCode', 'ASC')
      .addOrderBy('check.checkedAt', 'DESC')
      .getMany();
  }

  /** Poslednja provera po kodu za projekat (najnovija po checkedAt). */
  latestForProject(manager: EntityManager, projectId: string): Promise<Check[]> {
    return manager
      .getRepository(Check)
      .createQueryBuilder('check')
      .distinctOn(['check.definitionCode'])
      .where('check.projectId = :projectId', { projectId })
      .orderBy('check.definitionCode', 'ASC')
      .addOrderBy('check.checkedAt', 'DESC')
      .getMany();
  }

  historyFor(
    manager: EntityManager,
    filter: { developerId?: string; projectId?: string },
    page: { limit: number; offset: number },
  ): Promise<[Check[], number]> {
    return manager.getRepository(Check).findAndCount({
      where: { ...filter },
      order: { checkedAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  /**
   * Dokument koji dokazuje ručnu proveru. Čita se direktno (bez DocumentsModule,
   * da ne nastane ciklus modula); proverava se samo vlasnik dokumenta.
   */
  findDocument(manager: EntityManager, id: string): Promise<Document | null> {
    return manager.getRepository(Document).findOne({ where: { id } });
  }
}

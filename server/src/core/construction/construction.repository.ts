import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ConstructionPhase } from './entities/construction-phase.entity.js';
import { EngineerReport } from './entities/engineer-report.entity.js';

/** Jedini sloj koji priča sa bazom za faze gradnje i izveštaje inženjera. */
@Injectable()
export class ConstructionRepository {
  phasesForProject(manager: EntityManager, projectId: string): Promise<ConstructionPhase[]> {
    return manager.getRepository(ConstructionPhase).find({ where: { projectId }, order: { position: 'ASC' } });
  }

  phaseForUpdate(manager: EntityManager, projectId: string, phaseCode: string): Promise<ConstructionPhase | null> {
    return manager
      .getRepository(ConstructionPhase)
      .findOne({ where: { projectId, phaseCode }, lock: { mode: 'pessimistic_write' } });
  }

  async insertPhase(
    manager: EntityManager,
    data: Pick<ConstructionPhase, 'market' | 'projectId' | 'phaseCode' | 'position' | 'plannedDate'>,
  ): Promise<void> {
    await manager.getRepository(ConstructionPhase).insert({ ...data, status: 'PLANNED' });
  }

  async updatePhase(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<ConstructionPhase, 'plannedDate' | 'actualDate' | 'status' | 'confirmedById' | 'confirmedAt'>>,
  ): Promise<void> {
    await manager.getRepository(ConstructionPhase).update({ id }, data);
  }

  async insertReport(
    manager: EntityManager,
    data: Pick<EngineerReport, 'market' | 'projectId' | 'phaseCode' | 'engineerId' | 'visitDate' | 'summary' | 'verdict'>,
  ): Promise<EngineerReport> {
    const repository = manager.getRepository(EngineerReport);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findReport(manager: EntityManager, id: string): Promise<EngineerReport | null> {
    return manager.getRepository(EngineerReport).findOne({ where: { id } });
  }

  listReports(manager: EntityManager, projectId: string, page: { limit: number; offset: number }): Promise<[EngineerReport[], number]> {
    return manager.getRepository(EngineerReport).findAndCount({
      where: { projectId },
      order: { visitDate: 'DESC', createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }
}

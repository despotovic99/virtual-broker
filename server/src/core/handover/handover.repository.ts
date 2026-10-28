import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Defect } from './entities/defect.entity.js';
import { Handover } from './entities/handover.entity.js';

/** Jedini sloj koji priča sa bazom za primopredaju i nedostatke. */
@Injectable()
export class HandoverRepository {
  findHandover(manager: EntityManager, purchaseId: string): Promise<Handover | null> {
    return manager.getRepository(Handover).findOne({ where: { purchaseId } });
  }

  findHandoverForUpdate(manager: EntityManager, purchaseId: string): Promise<Handover | null> {
    return manager.getRepository(Handover).findOne({ where: { purchaseId }, lock: { mode: 'pessimistic_write' } });
  }

  async insertHandover(
    manager: EntityManager,
    data: Pick<Handover, 'market' | 'purchaseId' | 'engineerId' | 'inspectedAt' | 'contractArea' | 'measuredArea' | 'notes'>,
  ): Promise<void> {
    await manager.getRepository(Handover).insert(data);
  }

  async updateHandover(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<Handover, 'engineerId' | 'inspectedAt' | 'contractArea' | 'measuredArea' | 'notes' | 'keysHandedAt'>>,
  ): Promise<void> {
    await manager.getRepository(Handover).update({ id }, data);
  }

  listDefects(manager: EntityManager, purchaseId: string): Promise<Defect[]> {
    return manager.getRepository(Defect).find({ where: { purchaseId }, order: { createdAt: 'ASC' } });
  }

  async insertDefect(
    manager: EntityManager,
    data: Pick<Defect, 'market' | 'purchaseId' | 'description' | 'severity' | 'dueDate' | 'reportedById'>,
  ): Promise<Defect> {
    const repository = manager.getRepository(Defect);
    const result = await repository.insert({ ...data, status: 'OPEN' });
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findDefectForUpdate(manager: EntityManager, id: string): Promise<Defect | null> {
    return manager.getRepository(Defect).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async updateDefect(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<Defect, 'status' | 'fixedAt' | 'confirmedById' | 'confirmedAt'>>,
  ): Promise<void> {
    await manager.getRepository(Defect).update({ id }, data);
  }
}

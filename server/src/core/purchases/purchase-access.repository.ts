import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Purchase } from './entities/purchase.entity.js';

@Injectable()
export class PurchaseAccessRepository {
  findById(manager: EntityManager, id: string): Promise<Purchase | null> {
    return manager.getRepository(Purchase).findOne({ where: { id } });
  }

  findByIdForUpdate(manager: EntityManager, id: string): Promise<Purchase | null> {
    return manager.getRepository(Purchase).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async buyerHasPurchaseInProject(manager: EntityManager, buyerId: string, projectId: string): Promise<boolean> {
    const count = await manager.getRepository(Purchase).count({ where: { buyerId, projectId } });
    return count > 0;
  }

  async engineerAssignedToProject(manager: EntityManager, engineerId: string, projectId: string): Promise<boolean> {
    const count = await manager.getRepository(Purchase).count({ where: { engineerId, projectId } });
    return count > 0;
  }
}

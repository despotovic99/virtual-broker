import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { BuyerProfile } from '../users/entities/buyer-profile.entity.js';

@Injectable()
export class BuyerProfileRepository {
  find(manager: EntityManager, userId: string): Promise<BuyerProfile | null> {
    return manager.getRepository(BuyerProfile).findOne({ where: { userId } });
  }

  async upsert(manager: EntityManager, data: Omit<BuyerProfile, 'updatedAt' | 'user'>): Promise<BuyerProfile> {
    const repository = manager.getRepository(BuyerProfile);
    await repository.upsert(data, ['userId']);
    return repository.findOneOrFail({ where: { userId: data.userId } });
  }
}

import { Injectable } from '@nestjs/common';
import { IsNull, type EntityManager } from 'typeorm';
import { LegalOpinion } from './entities/legal-opinion.entity.js';
import { PowerOfAttorney } from './entities/power-of-attorney.entity.js';

@Injectable()
export class LegalWorkRepository {
  async insertPowerOfAttorney(
    manager: EntityManager,
    data: Pick<PowerOfAttorney, 'market' | 'purchaseId' | 'documentId' | 'scope' | 'validUntil' | 'createdById'>,
  ): Promise<PowerOfAttorney> {
    const repository = manager.getRepository(PowerOfAttorney);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  findPowerOfAttorneyForUpdate(manager: EntityManager, id: string): Promise<PowerOfAttorney | null> {
    return manager.getRepository(PowerOfAttorney).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async revokePowerOfAttorney(manager: EntityManager, id: string, at: Date): Promise<boolean> {
    const result = await manager.getRepository(PowerOfAttorney).update({ id, revokedAt: IsNull() }, { revokedAt: at });
    return (result.affected ?? 0) > 0;
  }

  listPowersOfAttorney(manager: EntityManager, purchaseId: string): Promise<PowerOfAttorney[]> {
    return manager.getRepository(PowerOfAttorney).find({ where: { purchaseId }, order: { createdAt: 'DESC' } });
  }

  async insertOpinion(
    manager: EntityManager,
    data: Pick<LegalOpinion, 'market' | 'purchaseId' | 'conclusion' | 'reasoning' | 'conditions' | 'documentId' | 'authorId'>,
  ): Promise<LegalOpinion> {
    const repository = manager.getRepository(LegalOpinion);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  listOpinions(manager: EntityManager, purchaseId: string): Promise<LegalOpinion[]> {
    return manager.getRepository(LegalOpinion).find({ where: { purchaseId }, order: { createdAt: 'DESC' } });
  }
}

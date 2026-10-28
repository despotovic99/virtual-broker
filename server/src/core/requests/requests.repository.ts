import { Injectable } from '@nestjs/common';
import { In, MoreThanOrEqual, type EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import { BuyerRequest, type RequestStatus } from './entities/buyer-request.entity.js';

@Injectable()
export class RequestsRepository {
  findById(manager: EntityManager, id: string): Promise<BuyerRequest | null> {
    return manager.getRepository(BuyerRequest).findOne({ where: { id } });
  }

  findByIdForUpdate(manager: EntityManager, id: string): Promise<BuyerRequest | null> {
    return manager.getRepository(BuyerRequest).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async markConverted(manager: EntityManager, id: string, purchaseId: string): Promise<void> {
    await manager.getRepository(BuyerRequest).update({ id }, { status: 'CONVERTED', purchaseId });
  }

  async insert(manager: EntityManager, data: Partial<BuyerRequest>): Promise<BuyerRequest> {
    const repository = manager.getRepository(BuyerRequest);
    const result = await repository.insert(data);
    return repository.findOneOrFail({ where: { id: (result.identifiers[0] as { id: string }).id } });
  }

  async update(manager: EntityManager, id: string, data: Partial<BuyerRequest>): Promise<BuyerRequest> {
    const repository = manager.getRepository(BuyerRequest);
    await repository.update({ id }, data);
    return repository.findOneOrFail({ where: { id } });
  }

  /** Broj zahteva date vrste od početka perioda (kvota besplatnih provera). */
  countSince(manager: EntityManager, buyerId: string, kind: BuyerRequest['kind'], since: Date): Promise<number> {
    return manager.getRepository(BuyerRequest).count({ where: { buyerId, kind, createdAt: MoreThanOrEqual(since) } });
  }

  listForBuyer(manager: EntityManager, buyerId: string): Promise<BuyerRequest[]> {
    return manager.getRepository(BuyerRequest).find({ where: { buyerId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  listQueue(manager: EntityManager, markets: readonly MarketCode[], status: RequestStatus | undefined): Promise<BuyerRequest[]> {
    if (markets.length === 0) return Promise.resolve([]);
    return manager.getRepository(BuyerRequest).find({
      where: { market: In([...markets]), ...(status ? { status } : { status: In(['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM']) }) },
      order: { firstResponseDueAt: 'ASC' },
      take: 200,
    });
  }

  listForLegalTeams(manager: EntityManager, teamIds: readonly string[]): Promise<BuyerRequest[]> {
    if (teamIds.length === 0) return Promise.resolve([]);
    return manager.getRepository(BuyerRequest).find({
      where: { legalTeamId: In([...teamIds]), status: In(['WITH_LEGAL_TEAM', 'ANSWERED']) },
      order: { firstResponseDueAt: 'ASC' },
      take: 200,
    });
  }
}

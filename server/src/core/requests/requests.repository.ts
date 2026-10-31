import { Injectable } from '@nestjs/common';
import { In, MoreThanOrEqual, type EntityManager } from 'typeorm';
import type { PaginationQueryDto } from '../../common/pagination/pagination.js';
import type { MarketCode } from '../../markets/market-code.js';
import { BuyerRequest, type RequestStatus } from './entities/buyer-request.entity.js';

type PageWindow = Pick<PaginationQueryDto, 'limit' | 'offset'>;

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

  listForBuyer(manager: EntityManager, buyerId: string, page: PageWindow): Promise<[BuyerRequest[], number]> {
    return manager.getRepository(BuyerRequest).findAndCount({
      where: { buyerId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  listQueue(
    manager: EntityManager,
    markets: readonly MarketCode[],
    status: RequestStatus | undefined,
    page: PageWindow,
  ): Promise<[BuyerRequest[], number]> {
    if (markets.length === 0) return Promise.resolve([[], 0]);
    return manager.getRepository(BuyerRequest).findAndCount({
      where: { market: In([...markets]), ...(status ? { status } : { status: In(['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM']) }) },
      order: { firstResponseDueAt: 'ASC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }

  /** Zahtevi prosleđeni datim pravnim timovima, samo na tržištima korisnika (filter u SQL-u, da `total` bude tačan). */
  listForLegalTeams(
    manager: EntityManager,
    teamIds: readonly string[],
    markets: readonly MarketCode[],
    page: PageWindow,
  ): Promise<[BuyerRequest[], number]> {
    if (teamIds.length === 0 || markets.length === 0) return Promise.resolve([[], 0]);
    return manager.getRepository(BuyerRequest).findAndCount({
      where: { legalTeamId: In([...teamIds]), market: In([...markets]), status: In(['WITH_LEGAL_TEAM', 'ANSWERED']) },
      order: { firstResponseDueAt: 'ASC', id: 'ASC' },
      take: page.limit,
      skip: page.offset,
    });
  }
}

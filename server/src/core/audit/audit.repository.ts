import { Injectable } from '@nestjs/common';
import { Brackets, type EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuditInput } from './audit.service.js';
import { AuditEvent } from './entities/audit-event.entity.js';

@Injectable()
export class AuditRepository {
  async insert(manager: EntityManager, input: AuditInput): Promise<void> {
    await manager.getRepository(AuditEvent).insert({
      market: input.market,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data ?? null,
    });
  }

  list(
    manager: EntityManager,
    filter: { entityType?: string; entityId?: string; markets: readonly MarketCode[] },
    limit: number,
  ): Promise<AuditEvent[]> {
    const query = manager
      .getRepository(AuditEvent)
      .createQueryBuilder('event')
      .where(
        new Brackets((where) => {
          where.where('event.market IS NULL');
          if (filter.markets.length > 0) where.orWhere('event.market IN (:...markets)', { markets: [...filter.markets] });
        }),
      )
      .orderBy('event.createdAt', 'DESC')
      .take(limit);
    if (filter.entityType) query.andWhere('event.entityType = :entityType', { entityType: filter.entityType });
    if (filter.entityId) query.andWhere('event.entityId = :entityId', { entityId: filter.entityId });
    return query.getMany();
  }
}

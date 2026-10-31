import { Injectable } from '@nestjs/common';
import { Brackets, In, type EntityManager } from 'typeorm';
import { currentRequest } from '../../common/request-context/request-context.js';
import type { MarketCode } from '../../markets/market-code.js';
import { User } from '../users/entities/user.entity.js';
import type { AuditInput } from './audit.service.js';
import { AuditEvent } from './entities/audit-event.entity.js';

/** Ključevi u `data` koji vezuju trag za nadređeni entitet (za istoriju „sa svim što mu pripada”). */
const RELATED_KEYS = ['purchaseId', 'projectId', 'developerId', 'teamId', 'requestId', 'userId'] as const;

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
      // IP tekućeg HTTP zahteva (null za sistemske radnje).
      ip: currentRequest()?.ip ?? null,
    });
  }

  list(
    manager: EntityManager,
    filter: { entityType?: string; entityId?: string; relatedTo?: string; markets: readonly MarketCode[] },
    page: { limit: number; offset: number },
  ): Promise<[AuditEvent[], number]> {
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
      .addOrderBy('event.id', 'ASC')
      .take(page.limit)
      .skip(page.offset);
    if (filter.entityType) query.andWhere('event.entityType = :entityType', { entityType: filter.entityType });
    if (filter.entityId) query.andWhere('event.entityId = :entityId', { entityId: filter.entityId });
    if (filter.relatedTo) {
      // Entitet i sve što mu pripada: npr. stanovi projekta, rate i mišljenja kupovine, računi investitora.
      query.andWhere(
        new Brackets((where) => {
          // Dva parametra iste vrednosti: entity_id je uuid, a data ->> 'kljuc' je text
          // (jedan parametar bi Postgres vezao za uuid, pa „text = uuid” puca).
          where.where('event.entityId = :relatedId', { relatedId: filter.relatedTo });
          for (const key of RELATED_KEYS) where.orWhere(`event.data ->> '${key}' = :relatedText`, { relatedText: filter.relatedTo });
        }),
      );
    }
    return query.getManyAndCount();
  }

  /** Imena i email-ovi naloga koji su uradili radnje (za prikaz istorije). */
  actors(manager: EntityManager, ids: readonly string[]): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return manager.getRepository(User).find({ select: { id: true, firstName: true, lastName: true, email: true }, where: { id: In([...ids]) } });
  }
}

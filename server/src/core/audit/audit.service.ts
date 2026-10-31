import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { toPage, type Page, type PaginationQueryDto } from '../../common/pagination/pagination.js';
import type { MarketCode } from '../../markets/market-code.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditData } from './entities/audit-event.entity.js';

export interface AuditInput {
  market: MarketCode | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data?: AuditData | null;
}

export interface AuditActor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditEventResponse {
  id: string;
  market: MarketCode | null;
  actorId: string | null;
  /** Nalog koji je uradio radnju; null za sistem. */
  actor: AuditActor | null;
  /** IP adresa zahteva; null za sistemske radnje i tragove pre uvođenja IP-a. */
  ip: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data: AuditData | null;
  createdAt: string;
}

export type AuditEventListResponse = Page<AuditEventResponse>;

@Injectable()
export class AuditService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditRepository,
  ) {}

  /** Učestvuje u tuđoj transakciji: trag se upisuje zajedno sa promenom. */
  record(manager: EntityManager, input: AuditInput): Promise<void> {
    return this.audit.insert(manager, input);
  }

  async list(
    filter: { entityType?: string; entityId?: string; relatedTo?: string; markets: readonly MarketCode[] },
    page: Pick<PaginationQueryDto, 'limit' | 'offset'>,
  ): Promise<AuditEventListResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [events, total] = await this.audit.list(queryRunner.manager, filter, page);
      const actorIds = [...new Set(events.map((event) => event.actorId).filter((id): id is string => id !== null))];
      const actors = new Map((await this.audit.actors(queryRunner.manager, actorIds)).map((actor) => [actor.id, actor]));
      const items: AuditEventResponse[] = events.map((event) => ({
        id: event.id,
        market: event.market,
        actorId: event.actorId,
        actor: event.actorId ? (actors.get(event.actorId) ?? null) : null,
        ip: event.ip,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        data: event.data,
        createdAt: event.createdAt.toISOString(),
      }));
      return toPage(items, total, page);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}

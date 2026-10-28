import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { throwApiError } from '../../common/errors/throw-api-error.js';
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

export interface AuditEventResponse {
  id: string;
  market: MarketCode | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data: AuditData | null;
  createdAt: string;
}

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

  async list(filter: { entityType?: string; entityId?: string; markets: readonly MarketCode[] }, limit: number): Promise<AuditEventResponse[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const events = await this.audit.list(queryRunner.manager, filter, limit);
      return events.map((event) => ({
        id: event.id,
        market: event.market,
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        data: event.data,
        createdAt: event.createdAt.toISOString(),
      }));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}

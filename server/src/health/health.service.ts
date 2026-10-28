import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { StorageService } from '../storage/storage.service.js';

export type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: { database: CheckStatus; redis: CheckStatus; storage: CheckStatus };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly storage: StorageService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis, storage] = await Promise.all([
      this.run('database', () => this.checkDatabase()),
      this.run('redis', () => this.checkRedis()),
      this.run('storage', () => this.storage.ping()),
    ]);
    const healthy = database === 'up' && redis === 'up' && storage === 'up';
    return { status: healthy ? 'ok' : 'degraded', checks: { database, redis, storage } };
  }

  private async checkDatabase(): Promise<void> {
    // Samo čitanje: konekcija bez transakcije, uvek se oslobađa.
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query('SELECT 1');
    } finally {
      await queryRunner.release();
    }
  }

  private async checkRedis(): Promise<void> {
    const reply = await this.redis.ping();
    if (reply !== 'PONG') throw new Error(`Neočekivan odgovor: ${reply}`);
  }

  // Detalji greške idu samo u log, nikad u odgovor.
  private async run(name: string, check: () => Promise<void>): Promise<CheckStatus> {
    try {
      await check();
      return 'up';
    } catch (error) {
      this.logger.warn(`Provera "${name}" nije uspela.`, error instanceof Error ? error.stack : undefined);
      return 'down';
    }
  }
}

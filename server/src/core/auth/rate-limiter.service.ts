import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { REDIS } from '../../redis/redis.module.js';

/** Brojač pokušaja u Redis-u (fiksni prozor). Ključ se hešira, pa email i IP ne stoje u Redis-u u čistom obliku. */
@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async consume(bucket: string, key: string, limit: number, windowSeconds: number): Promise<void> {
    const redisKey = this.key(bucket, key);
    const results = await this.redis.multi().incr(redisKey).expire(redisKey, windowSeconds, 'NX').exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    if (count > limit) {
      throw new ApiError(ApiErrorCode.TooManyRequests);
    }
  }

  async reset(bucket: string, key: string): Promise<void> {
    await this.redis.del(this.key(bucket, key));
  }

  private key(bucket: string, key: string): string {
    return `rl:${bucket}:${createHash('sha256').update(key).digest('hex')}`;
  }
}

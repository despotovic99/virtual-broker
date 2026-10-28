import { Injectable } from '@nestjs/common';
import { IsNull, type EntityManager } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity.js';

export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  createdIp: string | null;
  userAgent: string | null;
}

/** Jedini sloj koji priča sa bazom za refresh tokene. Svaki metod prima EntityManager. */
@Injectable()
export class RefreshTokensRepository {
  async insert(manager: EntityManager, data: NewRefreshToken): Promise<string> {
    const result = await manager.getRepository(RefreshToken).insert(data);
    return (result.identifiers[0] as { id: string }).id;
  }

  /** Zaključava red do kraja transakcije (rotacija mora biti atomska). */
  findByHashForUpdate(manager: EntityManager, tokenHash: string): Promise<RefreshToken | null> {
    return manager.getRepository(RefreshToken).findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async revoke(manager: EntityManager, id: string, at: Date, replacedById: string | null): Promise<void> {
    await manager.getRepository(RefreshToken).update({ id, revokedAt: IsNull() }, { revokedAt: at, replacedById });
  }

  async revokeFamily(manager: EntityManager, familyId: string, at: Date): Promise<void> {
    await manager.getRepository(RefreshToken).update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }

  async revokeAllForUser(manager: EntityManager, userId: string, at: Date): Promise<void> {
    await manager.getRepository(RefreshToken).update({ userId, revokedAt: IsNull() }, { revokedAt: at });
  }
}

import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';

/**
 * Upravljanje sesijama korisnika (refresh tokeni). Učestvuje u tuđoj
 * transakciji: posle promene uloga, tržišta ili deaktivacije korisnik mora
 * ponovo da se prijavi.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly refreshTokens: RefreshTokensRepository) {}

  revokeAllForUser(manager: EntityManager, userId: string, at: Date): Promise<void> {
    return this.refreshTokens.revokeAllForUser(manager, userId, at);
  }
}

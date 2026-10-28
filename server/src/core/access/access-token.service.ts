import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import type { AuthConfig } from '../../config/configuration.js';
import { isMarketCode, type MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from './auth-user.js';
import { isRole, type Role } from './role.enum.js';
import { capabilitiesFor } from './role-capabilities.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AccessTokenClaims {
  sub?: unknown;
  roles?: unknown;
  markets?: unknown;
}

/**
 * Access token (JWT, HS256). Nosi samo id korisnika i uloge; capability se
 * uvek računaju iz koda, pa promena prava ne zavisi od starih tokena.
 */
@Injectable()
export class AccessTokenService {
  readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.getOrThrow<AuthConfig>('auth').jwtAccessTtlSeconds;
  }

  sign(userId: string, roles: readonly Role[], markets: readonly MarketCode[]): Promise<string> {
    return this.jwt.signAsync({ roles: [...roles], markets: [...markets] }, { subject: userId });
  }

  async verify(token: string): Promise<AuthUser> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new ApiError(ApiErrorCode.Unauthenticated);
    }
    const { sub, roles, markets } = claims;
    if (
      typeof sub !== 'string' ||
      !UUID.test(sub) ||
      !Array.isArray(roles) ||
      !roles.every(isRole) ||
      !Array.isArray(markets) ||
      !markets.every(isMarketCode)
    ) {
      throw new ApiError(ApiErrorCode.Unauthenticated);
    }
    return { id: sub, roles, markets, capabilities: new Set(capabilitiesFor(roles)) };
  }
}

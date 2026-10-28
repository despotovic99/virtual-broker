import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { AuthConfig } from '../../config/configuration.js';
import { AccessTokenService } from '../access/access-token.service.js';
import { capabilitiesFor } from '../access/role-capabilities.js';
import type { User } from '../users/entities/user.entity.js';
import { PasswordService } from '../users/password.service.js';
import { toUserResponse } from '../users/users.mapper.js';
import { normalizeEmail, UsersService } from '../users/users.service.js';
import type { AuthResponseDto, MeResponseDto } from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { RateLimiterService } from './rate-limiter.service.js';
import { generateRefreshToken, hashRefreshToken, isWellFormedRefreshToken } from './refresh-token.util.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Rezultat prijave ili osvežavanja: telo odgovora i refresh token za cookie. */
export interface IssuedSession {
  response: AuthResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface IssuedRefreshToken {
  id: string;
  token: string;
  expiresAt: Date;
}

const WINDOW_SECONDS = 15 * 60;
const LOGIN_PER_IP = 20;
const LOGIN_PER_EMAIL = 5;
const REFRESH_PER_IP = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly rateLimiter: RateLimiterService,
    config: ConfigService,
  ) {
    this.refreshTtlMs = config.getOrThrow<AuthConfig>('auth').refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<IssuedSession> {
    const email = normalizeEmail(dto.email);
    if (meta.ip) await this.rateLimiter.consume('login-ip', meta.ip, LOGIN_PER_IP, WINDOW_SECONDS);
    await this.rateLimiter.consume('login-email', email, LOGIN_PER_EMAIL, WINDOW_SECONDS);

    // Jedna konekcija za celu prijavu: čitanje korisnika bez transakcije,
    // a upis (poslednja prijava i refresh token) u jednoj transakciji.
    let user: User;
    let refresh: IssuedRefreshToken;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const found = await this.users.findByEmailWithRoles(queryRunner.manager, email);

      // Nepostojeći korisnik troši isto vreme kao pogrešna lozinka.
      const passwordOk = found
        ? await this.passwords.verify(dto.password, found.passwordHash)
        : await this.passwords.verifyDummy(dto.password);
      if (!found || !passwordOk || !found.isActive) throw new ApiError(ApiErrorCode.AuthInvalidCredentials);
      user = found;

      await queryRunner.startTransaction();
      const now = new Date();
      await this.users.recordLogin(queryRunner.manager, user.id, now);
      refresh = await this.issueRefreshToken(queryRunner.manager, user.id, randomUUID(), meta, now);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    // Spoljni efekti posle commit-a.
    await this.rateLimiter.reset('login-email', email);
    return this.session(user, refresh);
  }

  async refresh(token: unknown, meta: ClientMeta): Promise<IssuedSession> {
    if (meta.ip) await this.rateLimiter.consume('refresh-ip', meta.ip, REFRESH_PER_IP, WINDOW_SECONDS);
    if (!isWellFormedRefreshToken(token)) throw new ApiError(ApiErrorCode.AuthSessionExpired);

    let result: { user: User; refresh: IssuedRefreshToken } | null = null;
    let reusedFamilyId: string | null = null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const now = new Date();
      const current = await this.refreshTokens.findByHashForUpdate(queryRunner.manager, hashRefreshToken(token));

      if (current?.revokedAt) {
        // Već iskorišćen token: verovatno je ukraden. Poništava se cela porodica.
        await this.refreshTokens.revokeFamily(queryRunner.manager, current.familyId, now);
        reusedFamilyId = current.familyId;
      } else if (current && current.expiresAt > now) {
        const user = await this.users.findActiveByIdWithRoles(queryRunner.manager, current.userId);
        if (user) {
          const next = await this.issueRefreshToken(queryRunner.manager, user.id, current.familyId, meta, now);
          await this.refreshTokens.revoke(queryRunner.manager, current.id, now, next.id);
          result = { user, refresh: next };
        } else {
          await this.refreshTokens.revokeFamily(queryRunner.manager, current.familyId, now);
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }

    if (reusedFamilyId) this.logger.warn(`Ponovo upotrebljen refresh token; porodica ${reusedFamilyId} je poništena.`);
    if (!result) throw new ApiError(ApiErrorCode.AuthSessionExpired);
    return this.session(result.user, result.refresh);
  }

  async logout(token: unknown): Promise<void> {
    if (!isWellFormedRefreshToken(token)) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const current = await this.refreshTokens.findByHashForUpdate(queryRunner.manager, hashRefreshToken(token));
      if (current) await this.refreshTokens.revokeFamily(queryRunner.manager, current.familyId, new Date());
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async me(userId: string): Promise<MeResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const user = await this.users.findActiveByIdWithRoles(queryRunner.manager, userId);
      if (!user) throw new ApiError(ApiErrorCode.Unauthenticated);
      return { user: toUserResponse(user), capabilities: capabilitiesFor(user.roles.map((userRole) => userRole.role)) };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  private async issueRefreshToken(
    manager: EntityManager,
    userId: string,
    familyId: string,
    meta: ClientMeta,
    now: Date,
  ): Promise<IssuedRefreshToken> {
    const token = generateRefreshToken();
    const expiresAt = new Date(now.getTime() + this.refreshTtlMs);
    const id = await this.refreshTokens.insert(manager, {
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt,
      createdIp: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id, token, expiresAt };
  }

  private async session(user: User, refresh: IssuedRefreshToken): Promise<IssuedSession> {
    const roles = user.roles.map((userRole) => userRole.role);
    const markets = user.markets.map((userMarket) => userMarket.market);
    return {
      response: {
        accessToken: await this.accessTokens.sign(user.id, roles, markets),
        expiresIn: this.accessTokens.ttlSeconds,
        user: toUserResponse(user),
        capabilities: capabilitiesFor(roles),
      },
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { MARKET_SCOPED_ROLES, Role } from '../access/role.enum.js';
import { canAssignRoles } from '../access/role-capabilities.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionsService } from '../auth/sessions.service.js';
import { isSuperAdmin } from './admin-scope.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import type { User } from './entities/user.entity.js';
import { toUserResponse } from './users.mapper.js';
import { UsersService } from './users.service.js';

/**
 * Izmena korisnika iz administracije. Registrovan je u AuthModule, jer posle
 * promene uloga, tržišta ili deaktivacije poništava sve refresh tokene
 * korisnika (SessionsService), u istoj transakciji.
 */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async updateUser(actor: AuthUser, userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const target = await this.users.lockWithRelations(queryRunner.manager, userId);
      if (!target || !this.canSee(actor, target)) throw new ApiError(ApiErrorCode.NotFound);

      const currentRoles = target.roles.map((userRole) => userRole.role);
      const currentMarkets = target.markets.map((userMarket) => userMarket.market);
      // Super admin se ne menja kroz API, a niko ne menja sopstvene uloge, tržišta i status.
      if (currentRoles.includes(Role.SuperAdmin)) throw new ApiError(ApiErrorCode.UserRoleNotAssignable);
      const changesAccess = dto.roles !== undefined || dto.markets !== undefined || dto.isActive !== undefined;
      if (target.id === actor.id && changesAccess) throw new ApiError(ApiErrorCode.CannotChangeOwnAccess);
      // Akter sme da menja samo korisnika čije sve trenutne uloge i sam sme da dodeli.
      if (!isSuperAdmin(actor) && currentRoles.length > 0 && !canAssignRoles(actor.roles, currentRoles)) {
        throw new ApiError(ApiErrorCode.UserRoleNotAssignable);
      }

      const roles: Role[] = dto.roles ? [...dto.roles] : currentRoles;
      if (dto.roles && (roles.includes(Role.SuperAdmin) || !canAssignRoles(actor.roles, roles))) {
        throw new ApiError(ApiErrorCode.UserRoleNotAssignable);
      }
      const markets = dto.markets ? this.checkMarkets(actor, currentMarkets, dto.markets) : currentMarkets;
      if (roles.some((role) => MARKET_SCOPED_ROLES.includes(role)) && markets.length === 0) {
        throw new ApiError(ApiErrorCode.UserMarketsRequired);
      }

      const manager = queryRunner.manager;
      if (dto.roles) await this.users.replaceRoles(manager, target.id, roles, actor.id);
      if (dto.markets) await this.users.replaceMarkets(manager, target.id, markets);
      await this.users.updateProfile(manager, target.id, {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      });
      // Nova prava važe od sledeće prijave; access token ističe najkasnije za 10 min.
      if (changesAccess) await this.sessions.revokeAllForUser(manager, target.id, new Date());
      await this.audit.record(manager, {
        market: null,
        actorId: actor.id,
        action: 'user.updated',
        entityType: 'user',
        entityId: target.id,
        data: {
          roles: dto.roles ? roles : null,
          markets: dto.markets ? markets : null,
          isActive: dto.isActive ?? null,
          profileChanged: dto.firstName !== undefined || dto.lastName !== undefined,
        },
      });

      const updated = await this.users.findByIdWithRoles(manager, target.id);
      await queryRunner.commitTransaction();
      return toUserResponse(updated as User);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Admin vidi korisnike sa bar jednim svojim tržištem i korisnike bez tržišta. */
  private canSee(actor: AuthUser, target: User): boolean {
    if (isSuperAdmin(actor)) return true;
    const markets = target.markets.map((userMarket) => userMarket.market);
    return markets.length === 0 || markets.some((market) => actor.markets.includes(market));
  }

  /**
   * Akter koji nije super admin sme da dodaje i uklanja samo svoja tržišta;
   * tuđa tržišta korisnika moraju da ostanu.
   */
  private checkMarkets(actor: AuthUser, current: readonly MarketCode[], requested: readonly MarketCode[]): MarketCode[] {
    if (isSuperAdmin(actor)) return [...requested];
    const outsideScope = current.filter((market) => !actor.markets.includes(market));
    const addsForeign = requested.some((market) => !actor.markets.includes(market) && !current.includes(market));
    const dropsForeign = outsideScope.some((market) => !requested.includes(market));
    if (addsForeign || dropsForeign) throw new ApiError(ApiErrorCode.MarketNotAllowed);
    return [...requested];
  }
}

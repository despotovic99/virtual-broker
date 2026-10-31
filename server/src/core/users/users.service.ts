import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { expectError, throwApiError } from '../../common/errors/throw-api-error.js';
import { toPage, type Page } from '../../common/pagination/pagination.js';
import { isUniqueViolation } from '../../common/utils/db-error.util.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { assertMarketAccess } from '../access/market-access.js';
import { MARKET_SCOPED_ROLES, Role } from '../access/role.enum.js';
import { canAssignRoles } from '../access/role-capabilities.js';
import { auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { administeredMarkets, canSeeUser, isSuperAdmin } from './admin-scope.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { CreateBuyerDto } from './dto/create-buyer.dto.js';
import type { BuyerSearchQueryDto, ListUsersQueryDto, StaffQueryDto } from './dto/list-users-query.dto.js';
import type { StaffMemberDto } from './dto/staff-member.dto.js';
import type { UserListResponseDto, UserResponseDto } from './dto/user-response.dto.js';
import type { User } from './entities/user.entity.js';
import { BuyerProfileRepository } from './buyer-profile.repository.js';
import { PasswordService } from './password.service.js';
import { toUserResponse } from './users.mapper.js';
import { UsersRepository } from './users.repository.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface NewBuyer {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  language: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly buyerProfiles: BuyerProfileRepository,
  ) {}

  async createUser(actor: AuthUser, dto: CreateUserDto): Promise<UserResponseDto> {
    // Dvostruka zaštita uz DTO: SUPER_ADMIN se nikad ne dodeljuje kroz API,
    // a akter sme da dodeli samo uloge iz ROLE_CAN_ASSIGN.
    const requested: Role[] = [...dto.roles];
    if (requested.includes(Role.SuperAdmin) || !canAssignRoles(actor.roles, requested)) {
      throw new ApiError(ApiErrorCode.UserRoleNotAssignable);
    }
    // Uloge vezane za tržište moraju imati tržište (F-34 P3). Akter koji nije
    // super admin sme da dodeli samo tržišta na kojima i sam radi.
    const markets = [...dto.markets];
    if (requested.some((role) => MARKET_SCOPED_ROLES.includes(role)) && markets.length === 0) {
      throw new ApiError(ApiErrorCode.UserMarketsRequired);
    }
    if (!isSuperAdmin(actor) && markets.some((market) => !actor.markets.includes(market))) {
      throw new ApiError(ApiErrorCode.MarketNotAllowed);
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const profile = { email: normalizeEmail(dto.email), firstName: dto.firstName.trim(), lastName: dto.lastName.trim() };
      const userId = await this.users.insertUser(queryRunner.manager, { ...profile, passwordHash, createdById: actor.id });
      await this.users.insertRoles(queryRunner.manager, userId, requested, actor.id);
      await this.users.insertMarkets(queryRunner.manager, userId, markets);
      await this.audit.record(queryRunner.manager, {
        market: null,
        actorId: actor.id,
        action: 'user.created',
        entityType: 'user',
        entityId: userId,
        data: {
          roles: requested,
          markets,
          changes: auditInitial({ ...profile, roles: [...requested].sort(), markets: [...markets].sort(), isActive: true }, [
            'email',
            'firstName',
            'lastName',
            'roles',
            'markets',
            'isActive',
          ]),
        },
      });
      const user = await this.users.findActiveByIdWithRoles(queryRunner.manager, userId);
      await queryRunner.commitTransaction();
      return toUserResponse(user as User);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)]);
    } finally {
      await queryRunner.release();
    }
  }

  /** Admin vidi korisnike svojih tržišta i korisnike bez tržišta (kupce); super admin sve. */
  async listUsers(actor: AuthUser, query: ListUsersQueryDto): Promise<UserListResponseDto> {
    if (query.market && !administeredMarkets(actor).includes(query.market)) {
      throw new ApiError(ApiErrorCode.MarketNotAllowed);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [users, total] = await this.users.search(
        queryRunner.manager,
        {
          role: query.role,
          market: query.market,
          search: query.search,
          visibleMarkets: isSuperAdmin(actor) ? null : actor.markets,
        },
        query.limit,
        query.offset,
      );
      return toPage(users.map(toUserResponse), total, query);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Jedan korisnik za ekran izmene; korisnik van vidljivosti je NOT_FOUND. Samo čitanje. */
  async getUser(actor: AuthUser, userId: string): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const user = await this.users.findByIdWithRoles(queryRunner.manager, userId);
      if (!user || !canSeeUser(actor, user.markets.map((userMarket) => userMarket.market))) {
        throw new ApiError(ApiErrorCode.NotFound);
      }
      return toUserResponse(user);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Aktivni korisnici sa ulogom na tržištu, za dodelu na kupovini. Akter mora raditi na tom tržištu. */
  async listStaff(actor: AuthUser, query: StaffQueryDto): Promise<StaffMemberDto[]> {
    assertMarketAccess(actor, query.market);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const users = await this.users.findStaff(queryRunner.manager, query.role, query.market);
      return users.map((user) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Aktivni kupci po stranama (kupci nemaju tržište, pa se ne filtrira po tržištu). Samo čitanje. */
  async searchBuyers(query: BuyerSearchQueryDto): Promise<Page<StaffMemberDto>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [users, total] = await this.users.findBuyers(queryRunner.manager, Role.Buyer, query.search, query.limit, query.offset);
      return toPage(
        users.map((user) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email })),
        total,
        query,
      );
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Nalog kupca koji pravi tim pri otvaranju kupovine: uvek samo uloga BUYER,
   * bez tržišta, uz opcioni profil. Nalog, profil i audit su jedna transakcija.
   */
  async createBuyerByStaff(actor: AuthUser, dto: CreateBuyerDto): Promise<StaffMemberDto> {
    // Heširanje je skupo: radi se pre otvaranja konekcije.
    const passwordHash = await this.passwords.hash(dto.password);
    const identity = { email: normalizeEmail(dto.email), firstName: dto.firstName.trim(), lastName: dto.lastName.trim() };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const userId = await this.users.insertUser(manager, { ...identity, passwordHash, language: dto.language, createdById: actor.id });
      await this.users.insertRoles(manager, userId, [Role.Buyer], actor.id);
      const profile = dto.profile
        ? await this.buyerProfiles.upsert(manager, {
            userId,
            isFirstHome: dto.profile.isFirstHome,
            isEuCitizen: dto.profile.isEuCitizen,
            primaryResidence: dto.profile.primaryResidence,
            financing: dto.profile.financing,
            age: dto.profile.age ?? null,
            householdMembers: dto.profile.householdMembers,
            budget: dto.profile.budget ?? null,
          })
        : null;
      await this.audit.record(manager, {
        market: null,
        actorId: actor.id,
        action: 'user.created',
        entityType: 'user',
        entityId: userId,
        data: {
          userId,
          roles: [Role.Buyer],
          createdFor: 'purchase',
          changes: auditInitial(
            {
              ...identity,
              language: dto.language,
              roles: [Role.Buyer],
              isActive: true,
              ...(profile
                ? {
                    isFirstHome: profile.isFirstHome,
                    isEuCitizen: profile.isEuCitizen,
                    primaryResidence: profile.primaryResidence,
                    financing: profile.financing,
                    age: profile.age,
                    householdMembers: profile.householdMembers,
                    budget: profile.budget,
                  }
                : {}),
            },
            [
              'email',
              'firstName',
              'lastName',
              'language',
              'roles',
              'isActive',
              'isFirstHome',
              'isEuCitizen',
              'primaryResidence',
              'financing',
              'age',
              'householdMembers',
              'budget',
            ],
          ),
        },
      });
      await queryRunner.commitTransaction();
      return { id: userId, ...identity };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)]);
    } finally {
      await queryRunner.release();
    }
  }

  // Metodi ispod učestvuju u tuđoj konekciji ili transakciji (AuthService, UsersAdminService).

  findByEmailWithRoles(manager: EntityManager, email: string): Promise<User | null> {
    return this.users.findByEmailWithRoles(manager, normalizeEmail(email));
  }

  findActiveByIdWithRoles(manager: EntityManager, id: string): Promise<User | null> {
    return this.users.findActiveByIdWithRoles(manager, id);
  }

  recordLogin(manager: EntityManager, userId: string, at: Date): Promise<void> {
    return this.users.updateLastLogin(manager, userId, at);
  }

  /** Kupac iz samostalne registracije: uvek samo uloga BUYER, bez tržišta. */
  async createBuyer(manager: EntityManager, buyer: NewBuyer): Promise<string> {
    const userId = await this.users.insertUser(manager, {
      email: normalizeEmail(buyer.email),
      passwordHash: buyer.passwordHash,
      firstName: buyer.firstName.trim(),
      lastName: buyer.lastName.trim(),
      language: buyer.language,
      createdById: null,
    });
    await this.users.insertRoles(manager, userId, [Role.Buyer], null);
    return userId;
  }

  /** Zaključava korisnika i vraća ga sa ulogama i tržištima (aktivnog ili ne). */
  async lockWithRelations(manager: EntityManager, id: string): Promise<User | null> {
    const locked = await this.users.lockById(manager, id);
    if (!locked) return null;
    return this.users.findByIdWithRoles(manager, id);
  }

  findByIdWithRoles(manager: EntityManager, id: string): Promise<User | null> {
    return this.users.findByIdWithRoles(manager, id);
  }

  replaceRoles(manager: EntityManager, userId: string, roles: readonly Role[], assignedById: string): Promise<void> {
    return this.users.replaceRoles(manager, userId, roles, assignedById);
  }

  replaceMarkets(manager: EntityManager, userId: string, markets: readonly MarketCode[]): Promise<void> {
    return this.users.replaceMarkets(manager, userId, markets);
  }

  updateProfile(
    manager: EntityManager,
    userId: string,
    data: Partial<Pick<User, 'firstName' | 'lastName' | 'isActive'>>,
  ): Promise<void> {
    return this.users.updateProfile(manager, userId, data);
  }
}

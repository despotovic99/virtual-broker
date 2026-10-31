import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { assertMarketAccess } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';
import { auditChanges, auditInitial } from '../audit/audit-changes.js';
import { AuditService } from '../audit/audit.service.js';
import { administeredMarkets } from '../users/admin-scope.js';
import { UsersService } from '../users/users.service.js';
import type {
  AvailableLegalTeamDto,
  CreateLegalTeamDto,
  LegalTeamResponseDto,
  MyLegalTeamDto,
  UpdateLegalTeamDto,
  UpsertTeamMemberDto,
} from './dto/legal-team.dto.js';
import type { LegalTeam } from './entities/legal-team.entity.js';
import { LegalTeamsRepository } from './legal-teams.repository.js';

export function toLegalTeamResponse(team: LegalTeam): LegalTeamResponseDto {
  return {
    id: team.id,
    market: team.market,
    name: team.name,
    languages: team.languages,
    conflictDeveloperIds: team.conflictDeveloperIds,
    active: team.active,
    members: (team.members ?? [])
      .map((member) => ({
        userId: member.userId,
        firstName: member.user?.firstName ?? '',
        lastName: member.user?.lastName ?? '',
        email: member.user?.email ?? '',
        teamRole: member.teamRole,
        licenseNumber: member.licenseNumber,
        licenseVerifiedAt: member.licenseVerifiedAt ? member.licenseVerifiedAt.toISOString() : null,
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    createdAt: team.createdAt.toISOString(),
  };
}

/**
 * Administracija pravnih timova (F-13, F-31): admin i super admin na
 * tržištu tima. Advokat vidi samo timove kojima pripada.
 */
@Injectable()
export class LegalTeamsAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly teams: LegalTeamsRepository,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser): Promise<LegalTeamResponseDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const teams = await this.teams.listTeams(queryRunner.manager, administeredMarkets(actor));
      return teams.map(toLegalTeamResponse);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Aktivni timovi na tržištu za dodelu na kupovini (koordinator). Timovi sa
   * sukobom interesa prema investitoru se ne nude (F-13, P1). Članovi samo
   * sa ulogom LEAD ili LAWYER (oni mogu da vode predmet).
   */
  async available(actor: AuthUser, market: MarketCode, developerId: string | undefined): Promise<AvailableLegalTeamDto[]> {
    assertMarketAccess(actor, market);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const teams = await this.teams.listTeams(queryRunner.manager, [market]);
      return teams
        .filter((team) => team.active && !(developerId && team.conflictDeveloperIds.includes(developerId)))
        .map((team) => ({
          id: team.id,
          name: team.name,
          languages: team.languages,
          lawyers: (team.members ?? [])
            .filter((member) => member.teamRole !== 'ASSOCIATE' && member.user)
            .map((member) => ({
              userId: member.userId,
              firstName: member.user?.firstName ?? '',
              lastName: member.user?.lastName ?? '',
              teamRole: member.teamRole,
            })),
        }));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async mine(actor: AuthUser): Promise<MyLegalTeamDto[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const memberships = await this.teams.findMembershipsWithTeam(queryRunner.manager, actor.id);
      return memberships
        .filter((membership) => actor.markets.includes(membership.team.market))
        .map((membership) => ({
          id: membership.team.id,
          market: membership.team.market,
          name: membership.team.name,
          languages: membership.team.languages,
          active: membership.team.active,
          myRole: membership.teamRole,
        }));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async create(actor: AuthUser, dto: CreateLegalTeamDto): Promise<LegalTeamResponseDto> {
    this.assertAdministers(actor, dto.market);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const values = {
        name: dto.name.trim(),
        languages: [...dto.languages],
        conflictDeveloperIds: [...dto.conflictDeveloperIds],
      };
      const id = await this.teams.insertTeam(queryRunner.manager, { market: dto.market, ...values });
      await this.audit.record(queryRunner.manager, {
        market: dto.market,
        actorId: actor.id,
        action: 'legal-team.created',
        entityType: 'legal_team',
        entityId: id,
        data: {
          name: values.name,
          conflictDevelopers: dto.conflictDeveloperIds.length,
          changes: auditInitial({ ...values, active: true }, ['name', 'languages', 'conflictDeveloperIds', 'active']),
        },
      });
      const team = await this.loadTeam(queryRunner.manager, id);
      await queryRunner.commitTransaction();
      return toLegalTeamResponse(team);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async update(actor: AuthUser, teamId: string, dto: UpdateLegalTeamDto): Promise<LegalTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const team = await this.lockAdministeredTeam(queryRunner.manager, actor, teamId);
      const patch: Partial<LegalTeam> = {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.languages !== undefined ? { languages: [...dto.languages] } : {}),
        ...(dto.conflictDeveloperIds !== undefined ? { conflictDeveloperIds: [...dto.conflictDeveloperIds] } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      };
      await this.teams.updateTeam(queryRunner.manager, team.id, patch);
      await this.audit.record(queryRunner.manager, {
        market: team.market,
        actorId: actor.id,
        action: 'legal-team.updated',
        entityType: 'legal_team',
        entityId: team.id,
        data: { changes: auditChanges(team, patch, ['name', 'languages', 'conflictDeveloperIds', 'active']) },
      });
      const updated = await this.loadTeam(queryRunner.manager, team.id);
      await queryRunner.commitTransaction();
      return toLegalTeamResponse(updated);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Dodaje člana ili menja njegovu ulogu u timu. Član mora biti aktivan advokat na tržištu tima. */
  async upsertMember(actor: AuthUser, teamId: string, userId: string, dto: UpsertTeamMemberDto): Promise<LegalTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const team = await this.lockAdministeredTeam(queryRunner.manager, actor, teamId);
      const user = await this.users.findActiveByIdWithRoles(queryRunner.manager, userId);
      const isLawyerOnMarket =
        !!user &&
        user.roles.some((userRole) => userRole.role === Role.Lawyer) &&
        user.markets.some((userMarket) => userMarket.market === team.market);
      if (!isLawyerOnMarket) throw new ApiError(ApiErrorCode.LegalTeamMemberInvalid);

      const current = team.members?.find((member) => member.userId === userId);
      const licenseVerifiedAt =
        dto.licenseVerified === undefined
          ? (current?.licenseVerifiedAt ?? null)
          : dto.licenseVerified
            ? (current?.licenseVerifiedAt ?? new Date())
            : null;
      const licenseNumber = dto.licenseNumber?.trim() ?? current?.licenseNumber ?? null;
      await this.teams.upsertMember(queryRunner.manager, {
        teamId: team.id,
        userId,
        teamRole: dto.teamRole,
        licenseNumber,
        licenseVerifiedAt,
      });
      await this.audit.record(queryRunner.manager, {
        market: team.market,
        actorId: actor.id,
        action: 'legal-team.member.upserted',
        entityType: 'legal_team',
        entityId: team.id,
        data: {
          teamId: team.id,
          userId,
          teamRole: dto.teamRole,
          licenseVerified: licenseVerifiedAt !== null,
          // Nov član: sve stare vrednosti su null.
          changes: auditChanges<{ teamRole: string | null; licenseNumber: string | null; licenseVerified: boolean | null }>(
            {
              teamRole: current?.teamRole ?? null,
              licenseNumber: current?.licenseNumber ?? null,
              licenseVerified: current ? current.licenseVerifiedAt !== null : null,
            },
            { teamRole: dto.teamRole, licenseNumber, licenseVerified: licenseVerifiedAt !== null },
            ['teamRole', 'licenseNumber', 'licenseVerified'],
          ),
        },
      });
      const updated = await this.loadTeam(queryRunner.manager, team.id);
      await queryRunner.commitTransaction();
      return toLegalTeamResponse(updated);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async removeMember(actor: AuthUser, teamId: string, userId: string): Promise<LegalTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const team = await this.lockAdministeredTeam(queryRunner.manager, actor, teamId);
      const removed = team.members?.find((member) => member.userId === userId);
      await this.teams.removeMember(queryRunner.manager, team.id, userId);
      await this.audit.record(queryRunner.manager, {
        market: team.market,
        actorId: actor.id,
        action: 'legal-team.member.removed',
        entityType: 'legal_team',
        entityId: team.id,
        data: {
          teamId: team.id,
          userId,
          changes: removed ? { teamRole: { from: removed.teamRole, to: null } } : undefined,
        },
      });
      const updated = await this.loadTeam(queryRunner.manager, team.id);
      await queryRunner.commitTransaction();
      return toLegalTeamResponse(updated);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Zaključava tim i vraća ga sa članovima. Tim van tržišta aktera je NOT_FOUND. */
  private async lockAdministeredTeam(manager: EntityManager, actor: AuthUser, teamId: string): Promise<LegalTeam> {
    const locked = await this.teams.lockById(manager, teamId);
    if (!locked || !administeredMarkets(actor).includes(locked.market)) throw new ApiError(ApiErrorCode.NotFound);
    return this.loadTeam(manager, teamId);
  }

  private async loadTeam(manager: EntityManager, teamId: string): Promise<LegalTeam> {
    const team = await this.teams.findById(manager, teamId);
    if (!team) throw new ApiError(ApiErrorCode.NotFound);
    return team;
  }

  private assertAdministers(actor: AuthUser, market: MarketCode): void {
    if (!administeredMarkets(actor).includes(market)) throw new ApiError(ApiErrorCode.MarketNotAllowed);
  }
}

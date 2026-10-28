import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import { LegalTeamMember, type LegalTeamRole } from './entities/legal-team-member.entity.js';
import { LegalTeam } from './entities/legal-team.entity.js';

@Injectable()
export class LegalTeamsRepository {
  findMembership(manager: EntityManager, teamId: string, userId: string): Promise<LegalTeamMember | null> {
    return manager.getRepository(LegalTeamMember).findOne({ where: { teamId, userId } });
  }

  findTeamIdsForUser(manager: EntityManager, userId: string): Promise<LegalTeamMember[]> {
    return manager.getRepository(LegalTeamMember).find({ where: { userId } });
  }

  findMembershipsWithTeam(manager: EntityManager, userId: string): Promise<LegalTeamMember[]> {
    return manager.getRepository(LegalTeamMember).find({ where: { userId }, relations: { team: true } });
  }

  /** Zaključava red tima do kraja transakcije (bez join-ova, zbog FOR UPDATE). */
  lockById(manager: EntityManager, id: string): Promise<LegalTeam | null> {
    return manager.getRepository(LegalTeam).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  findActiveTeams(manager: EntityManager, market: MarketCode): Promise<LegalTeam[]> {
    return manager.getRepository(LegalTeam).find({ where: { market, active: true }, order: { name: 'ASC' } });
  }

  findById(manager: EntityManager, id: string): Promise<LegalTeam | null> {
    return manager.getRepository(LegalTeam).findOne({ where: { id }, relations: { members: { user: true } } });
  }

  listTeams(manager: EntityManager, markets: readonly MarketCode[]): Promise<LegalTeam[]> {
    if (markets.length === 0) return Promise.resolve([]);
    return manager
      .getRepository(LegalTeam)
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .where('team.market IN (:...markets)', { markets: [...markets] })
      .orderBy('team.name', 'ASC')
      .getMany();
  }

  async insertTeam(
    manager: EntityManager,
    data: { market: MarketCode; name: string; languages: string[]; conflictDeveloperIds: string[] },
  ): Promise<string> {
    const result = await manager.getRepository(LegalTeam).insert({ ...data, active: true });
    return (result.identifiers[0] as { id: string }).id;
  }

  async updateTeam(
    manager: EntityManager,
    id: string,
    data: Partial<Pick<LegalTeam, 'name' | 'languages' | 'conflictDeveloperIds' | 'active'>>,
  ): Promise<void> {
    await manager.getRepository(LegalTeam).update({ id }, data);
  }

  async upsertMember(
    manager: EntityManager,
    data: { teamId: string; userId: string; teamRole: LegalTeamRole; licenseNumber: string | null; licenseVerifiedAt: Date | null },
  ): Promise<void> {
    await manager.getRepository(LegalTeamMember).upsert(data, ['teamId', 'userId']);
  }

  async removeMember(manager: EntityManager, teamId: string, userId: string): Promise<void> {
    await manager.getRepository(LegalTeamMember).delete({ teamId, userId });
  }
}

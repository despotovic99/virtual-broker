import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MarketCode } from '../../markets/market-code.js';
import type { LegalTeamRole } from './entities/legal-team-member.entity.js';
import type { LegalTeam } from './entities/legal-team.entity.js';
import { LegalTeamsRepository } from './legal-teams.repository.js';

/**
 * Pravni timovi: članstvo i predlog tima za kupovinu (F-13, F-31).
 * Metodi ovde učestvuju u tuđoj konekciji. Admin endpoint-i za timove su u
 * LegalTeamsAdminService.
 */
@Injectable()
export class LegalTeamsService {
  constructor(private readonly teams: LegalTeamsRepository) {}

  async memberRole(manager: EntityManager, teamId: string, userId: string): Promise<LegalTeamRole | null> {
    const membership = await this.teams.findMembership(manager, teamId, userId);
    return membership?.teamRole ?? null;
  }

  async teamIdsForUser(manager: EntityManager, userId: string): Promise<string[]> {
    const memberships = await this.teams.findTeamIdsForUser(manager, userId);
    return memberships.map((membership) => membership.teamId);
  }

  /**
   * Predlog tima za kupovinu: aktivan tim na tržištu, bez sukoba interesa sa
   * investitorom, prednost ima tim koji radi na jeziku kupca (F-13, P5).
   * Koordinator potvrđuje predlog.
   */
  async proposeTeam(
    manager: EntityManager,
    market: MarketCode,
    developerId: string,
    language: string | null,
  ): Promise<LegalTeam | null> {
    const candidates = (await this.teams.findActiveTeams(manager, market)).filter(
      (team) => !team.conflictDeveloperIds.includes(developerId),
    );
    if (candidates.length === 0) return null;
    return (language && candidates.find((team) => team.languages.includes(language))) || candidates[0];
  }

  async findTeam(manager: EntityManager, teamId: string): Promise<LegalTeam | null> {
    return this.teams.findById(manager, teamId);
  }
}

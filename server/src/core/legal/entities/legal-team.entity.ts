import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { LegalTeamMember } from './legal-team-member.entity.js';

/**
 * Pravni tim (advokatska kancelarija) partner na jednom tržištu (F-13, F-31).
 * Advokati rade samo predmete tržišta na kom je tim licenciran.
 */
@Entity({ name: 'legal_teams' })
export class LegalTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Jezici na kojima tim radi sa kupcem (dodela po jeziku). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  languages: string[];

  /**
   * Investitori koje tim zastupa (izjava o nezavisnosti). Tim se nikad ne
   * dodeljuje kupovini kod tih investitora (F-13, P1).
   */
  @Column({ name: 'conflict_developer_ids', type: 'uuid', array: true, default: () => "'{}'" })
  conflictDeveloperIds: string[];

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => LegalTeamMember, (member) => member.team)
  members: Relation<LegalTeamMember[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

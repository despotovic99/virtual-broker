import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { LegalTeam } from './legal-team.entity.js';

/**
 * Uloga u pravnom timu (F-31). LEAD raspoređuje posao i potpisuje,
 * LAWYER radi predmete i potpisuje, ASSOCIATE priprema i NE potpisuje.
 */
export const LEGAL_TEAM_ROLES = ['LEAD', 'LAWYER', 'ASSOCIATE'] as const;
export type LegalTeamRole = (typeof LEGAL_TEAM_ROLES)[number];

@Entity({ name: 'legal_team_members' })
export class LegalTeamMember {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Index('ix_legal_team_members_user_id')
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => LegalTeam, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Relation<LegalTeam>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @Column({ name: 'team_role', type: 'enum', enum: [...LEGAL_TEAM_ROLES], enumName: 'legal_team_role' })
  teamRole: LegalTeamRole;

  /** Broj upisa u imenik advokata (AKS) ili Cyprus Bar Association. */
  @Column({ name: 'license_number', type: 'varchar', length: 64, nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'license_verified_at', type: 'timestamptz', nullable: true })
  licenseVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

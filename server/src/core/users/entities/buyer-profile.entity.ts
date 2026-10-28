import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { User } from './user.entity.js';

export const FINANCING_TYPES = ['CASH', 'MORTGAGE'] as const;
export type FinancingType = (typeof FINANCING_TYPES)[number];

/** Upitnik kupca (F-03). Na osnovu njega se računaju troškovi i pravne napomene. */
@Entity({ name: 'buyer_profiles' })
export class BuyerProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @Column({ name: 'is_first_home', type: 'boolean', default: false })
  isFirstHome: boolean;

  @Column({ name: 'is_eu_citizen', type: 'boolean', default: false })
  isEuCitizen: boolean;

  @Column({ name: 'primary_residence', type: 'boolean', default: false })
  primaryResidence: boolean;

  @Column({ type: 'enum', enum: [...FINANCING_TYPES], enumName: 'financing_type', default: 'CASH' })
  financing: FinancingType;

  @Column({ type: 'integer', nullable: true })
  age: number | null;

  @Column({ name: 'household_members', type: 'integer', default: 1 })
  householdMembers: number;

  /** Budžet u celim evrima. */
  @Column({ type: 'integer', nullable: true })
  budget: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

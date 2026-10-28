import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Unit } from '../../catalog/entities/unit.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PurchaseStep } from './purchase-step.entity.js';

export const PURCHASE_STATUSES = ['ACTIVE', 'BLOCKED', 'CANCELLED', 'COMPLETED'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * Kupovina (predmet, F-01): jedan kupac, jedan stan. Pripada tržištu
 * projekta i tržište se ne menja (F-34, P1). Pamti verziju paketa (P7).
 */
@Entity({ name: 'purchases' })
@Index('ix_purchases_market_status', ['market', 'status'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'pack_version', type: 'varchar', length: 32 })
  packVersion: string;

  @Index('ix_purchases_buyer_id')
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer?: Relation<User>;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Relation<Unit>;

  /** Denormalizovano iz stana, radi filtriranja po projektu i investitoru. */
  @Index('ix_purchases_project_id')
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ type: 'enum', enum: [...PURCHASE_STATUSES], enumName: 'purchase_status', default: 'ACTIVE' })
  status: PurchaseStatus;

  @Column({ name: 'block_reason', type: 'varchar', length: 500, nullable: true })
  blockReason: string | null;

  @Index('ix_purchases_coordinator_id')
  @Column({ name: 'coordinator_id', type: 'uuid', nullable: true })
  coordinatorId: string | null;

  @Index('ix_purchases_legal_team_id')
  @Column({ name: 'legal_team_id', type: 'uuid', nullable: true })
  legalTeamId: string | null;

  /** Advokat iz tima koji vodi predmet. */
  @Column({ name: 'lawyer_id', type: 'uuid', nullable: true })
  lawyerId: string | null;

  @Index('ix_purchases_engineer_id')
  @Column({ name: 'engineer_id', type: 'uuid', nullable: true })
  engineerId: string | null;

  @Index('ix_purchases_escrow_agent_id')
  @Column({ name: 'escrow_agent_id', type: 'uuid', nullable: true })
  escrowAgentId: string | null;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId: string | null;

  @OneToMany(() => PurchaseStep, (step) => step.purchase)
  steps: Relation<PurchaseStep[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}

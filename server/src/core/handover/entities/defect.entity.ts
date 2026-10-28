import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from '../../purchases/entities/purchase.entity.js';

export const DEFECT_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

export const DEFECT_STATUSES = ['OPEN', 'FIXED', 'CONFIRMED'] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

/** Nedostatak iz zapisnika (F-21): OPEN → FIXED (investitor otklonio) → CONFIRMED (inženjer ili kupac potvrdio). */
@Entity({ name: 'defects' })
@Index('ix_defects_purchase_status', ['purchaseId', 'status'])
export class Defect {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  @Column({ type: 'varchar', length: 1000 })
  description: string;

  @Column({ type: 'enum', enum: [...DEFECT_SEVERITIES], enumName: 'defect_severity' })
  severity: DefectSeverity;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'enum', enum: [...DEFECT_STATUSES], enumName: 'defect_status', default: 'OPEN' })
  status: DefectStatus;

  @Column({ name: 'reported_by_id', type: 'uuid' })
  reportedById: string;

  @Column({ name: 'fixed_at', type: 'timestamptz', nullable: true })
  fixedAt: Date | null;

  @Column({ name: 'confirmed_by_id', type: 'uuid', nullable: true })
  confirmedById: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Project } from '../../catalog/entities/project.entity.js';

export const PHASE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'CONFIRMED', 'REJECTED'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

/** Faza gradnje projekta: plan i stvarno stanje (F-18). Fazu potvrđuje samo nezavisni inženjer (F-17). */
@Entity({ name: 'construction_phases' })
@Index('uq_construction_phases_project_code', ['projectId', 'phaseCode'], { unique: true })
export class ConstructionPhase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Relation<Project>;

  @Column({ name: 'phase_code', type: 'varchar', length: 64 })
  phaseCode: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ name: 'planned_date', type: 'date', nullable: true })
  plannedDate: string | null;

  @Column({ name: 'actual_date', type: 'date', nullable: true })
  actualDate: string | null;

  @Column({ type: 'enum', enum: [...PHASE_STATUSES], enumName: 'phase_status', default: 'PLANNED' })
  status: PhaseStatus;

  @Column({ name: 'confirmed_by_id', type: 'uuid', nullable: true })
  confirmedById: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;
}

import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Project } from '../../catalog/entities/project.entity.js';

export const REPORT_VERDICTS = ['PROGRESS', 'PHASE_CONFIRMED', 'PHASE_REJECTED', 'ISSUE'] as const;
export type ReportVerdict = (typeof REPORT_VERDICTS)[number];

/** Izveštaj nezavisnog inženjera sa obilaska (F-17). Fotografije su dokumenti sa scope REPORT. */
@Entity({ name: 'engineer_reports' })
@Index('ix_engineer_reports_project_visit', ['projectId', 'visitDate'])
export class EngineerReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Relation<Project>;

  @Column({ name: 'phase_code', type: 'varchar', length: 64, nullable: true })
  phaseCode: string | null;

  @Column({ name: 'engineer_id', type: 'uuid' })
  engineerId: string;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'enum', enum: [...REPORT_VERDICTS], enumName: 'report_verdict' })
  verdict: ReportVerdict;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

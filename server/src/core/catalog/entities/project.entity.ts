import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Developer } from './developer.entity.js';

export const PROJECT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Projekat (zgrada). U MVP-u ga unosi naš tim (F-32). Kupac vidi samo PUBLISHED. */
@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_projects_developer_id')
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @ManyToOne(() => Developer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'developer_id' })
  developer?: Relation<Developer>;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Index('ix_projects_city')
  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 300 })
  address: string;

  /** RS: katastarska opština + broj parcele. CY: sheet/plan/parcel. Nikad broj lista nepokretnosti (KIS). */
  @Column({ name: 'parcel_reference', type: 'varchar', length: 120, nullable: true })
  parcelReference: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: [...PROJECT_STATUSES], enumName: 'project_status', default: 'DRAFT' })
  status: ProjectStatus;

  @Column({ name: 'expected_completion', type: 'date', nullable: true })
  expectedCompletion: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

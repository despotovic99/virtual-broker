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
import { AreaColumn, MarketColumn, numericTransformer } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Project } from './project.entity.js';

export const UNIT_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Stan u projektu. Cena je u celim evrima. */
@Entity({ name: 'units' })
@Index('uq_units_project_label', ['projectId', 'label'], { unique: true })
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Relation<Project>;

  /** Oznaka stana u projektu, npr. „A-12”. */
  @Column({ type: 'varchar', length: 40 })
  label: string;

  @Column({ type: 'integer', nullable: true })
  floor: number | null;

  @Column({ type: 'numeric', precision: 3, scale: 1, nullable: true, transformer: numericTransformer })
  rooms: number | null;

  @AreaColumn({ name: 'area' })
  area: number;

  /** RS: cena sa PDV-om. CY: cena bez PDV-a. */
  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'enum', enum: [...UNIT_STATUSES], enumName: 'unit_status', default: 'AVAILABLE' })
  status: UnitStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

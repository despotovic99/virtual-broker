import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MarketColumn, SemaphoreColumn, type Semaphore } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';

export const CHECK_SUBJECTS = ['DEVELOPER', 'PROJECT'] as const;
export const CHECK_METHODS = ['AUTOMATIC', 'DOCUMENT', 'LAWYER', 'MANUAL'] as const;

/**
 * Jedna provera (F-05, F-06). Svako izvršenje je nov red, pa ostaje istorija.
 * Važeća je poslednja provera za (predmet, kod); posle `validUntil` je siva.
 * Uvek se zna izvor, datum i način (README pravilo 2).
 */
@Entity({ name: 'checks' })
@Index('ix_checks_developer_code', ['developerId', 'definitionCode', 'checkedAt'])
@Index('ix_checks_project_code', ['projectId', 'definitionCode', 'checkedAt'])
export class Check {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'subject_type', type: 'enum', enum: [...CHECK_SUBJECTS], enumName: 'check_subject' })
  subjectType: (typeof CHECK_SUBJECTS)[number];

  @Column({ name: 'developer_id', type: 'uuid', nullable: true })
  developerId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  /** Kod provere iz paketa tržišta (npr. RS_NBS_BLOCKADE). */
  @Column({ name: 'definition_code', type: 'varchar', length: 64 })
  definitionCode: string;

  @SemaphoreColumn()
  status: Semaphore;

  @Column({ type: 'varchar', length: 500 })
  summary: string;

  /** Izvor podatka. Kod dummy integracija počinje sa „DUMMY:”. */
  @Column({ type: 'varchar', length: 300 })
  source: string;

  @Column({ type: 'enum', enum: [...CHECK_METHODS], enumName: 'check_method' })
  method: (typeof CHECK_METHODS)[number];

  /** true: rezultat je iz dummy integracije, nije pravi podatak. */
  @Column({ type: 'boolean', default: false })
  dummy: boolean;

  @Column({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;

  @Column({ name: 'valid_until', type: 'timestamptz' })
  validUntil: Date;

  /** null: proveru je uradio sistem (automatski izvor). */
  @Column({ name: 'checked_by_id', type: 'uuid', nullable: true })
  checkedById: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, string | number | boolean | null> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

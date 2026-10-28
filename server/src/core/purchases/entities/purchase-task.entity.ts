import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from './purchase.entity.js';

export const TASK_STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING', 'DONE', 'REJECTED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Zadatak na kupovini (advokat, inženjer, koordinator), sa rokom i statusom (F-13, F-31). */
@Entity({ name: 'purchase_tasks' })
@Index('ix_purchase_tasks_assignee_status', ['assigneeUserId', 'status'])
export class PurchaseTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_purchase_tasks_purchase_id')
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  /** Vrsta zadatka, npr. LEGAL_REVIEW, CONTRACT_REVIEW, SITE_VISIT. */
  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ name: 'assignee_user_id', type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @Column({ name: 'legal_team_id', type: 'uuid', nullable: true })
  legalTeamId: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'enum', enum: [...TASK_STATUSES], enumName: 'task_status', default: 'NEW' })
  status: TaskStatus;

  /** Obavezno kada je status WAITING (čeka kupca, investitora ili instituciju). */
  @Column({ name: 'waiting_reason', type: 'varchar', length: 300, nullable: true })
  waitingReason: string | null;

  @Column({ type: 'text', nullable: true })
  result: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Purchase } from './purchase.entity.js';

export const STEP_STATUSES = ['PENDING', 'DONE', 'SKIPPED'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Korak kupovine iz šablona paketa tržišta (S1–S17 ili K1–K17). */
@Entity({ name: 'purchase_steps' })
@Index('uq_purchase_steps_purchase_code', ['purchaseId', 'stepCode'], { unique: true })
export class PurchaseStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Relation<Purchase>;

  @Column({ name: 'step_code', type: 'varchar', length: 8 })
  stepCode: string;

  /** Faza puta kupca (JourneyPhase). */
  @Column({ type: 'varchar', length: 32 })
  phase: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'enum', enum: [...STEP_STATUSES], enumName: 'step_status', default: 'PENDING' })
  status: StepStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_by_id', type: 'uuid', nullable: true })
  completedById: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}

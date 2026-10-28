import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Installment } from './installment.entity.js';

export const CONDITION_STATUSES = ['PENDING', 'MET'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

/** Uslov pre uplate za jednu ratu (F-14). Potvrđuje ga uloga iz paketa tržišta. */
@Entity({ name: 'installment_conditions' })
@Index('uq_installment_conditions_code', ['installmentId', 'conditionCode'], { unique: true })
export class InstallmentCondition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'installment_id', type: 'uuid' })
  installmentId: string;

  @ManyToOne(() => Installment, (installment) => installment.conditions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installment_id' })
  installment: Relation<Installment>;

  /** Kod uslova iz paketa tržišta (npr. RS_PRE_REGISTRATION). */
  @Column({ name: 'condition_code', type: 'varchar', length: 64 })
  conditionCode: string;

  @Column({ type: 'enum', enum: [...CONDITION_STATUSES], enumName: 'condition_status', default: 'PENDING' })
  status: ConditionStatus;

  @Column({ name: 'confirmed_by_id', type: 'uuid', nullable: true })
  confirmedById: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'evidence_document_id', type: 'uuid', nullable: true })
  evidenceDocumentId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}

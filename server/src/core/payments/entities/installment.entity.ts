import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from '../../purchases/entities/purchase.entity.js';
import { InstallmentCondition } from './installment-condition.entity.js';

/**
 * LOCKED: uslovi nisu ispunjeni, uplata nije dozvoljena (F-14).
 * READY: svi uslovi ispunjeni, kupac sme da plati.
 * PAID: uplata potvrđena (GATE: investitoru; ESCROW: na escrow račun).
 * RELEASED: escrow partner isplatio investitoru (samo ESCROW).
 */
export const INSTALLMENT_STATUSES = ['LOCKED', 'READY', 'PAID', 'RELEASED'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

/** Rata iz plana uplata (F-15). Iznos u celim evrima. */
@Entity({ name: 'installments' })
@Index('uq_installments_purchase_sequence', ['purchaseId', 'sequence'], { unique: true })
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  @Column({ type: 'integer' })
  sequence: number;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'integer' })
  amount: number;

  /** Faza gradnje posle koje se rata plaća (uslov PHASE). */
  @Column({ name: 'phase_code', type: 'varchar', length: 64, nullable: true })
  phaseCode: string | null;

  /** Poslednja rata (uslov LAST). */
  @Column({ name: 'is_final', type: 'boolean', default: false })
  isFinal: boolean;

  @Column({ type: 'enum', enum: [...INSTALLMENT_STATUSES], enumName: 'installment_status', default: 'LOCKED' })
  status: InstallmentStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'paid_confirmed_by_id', type: 'uuid', nullable: true })
  paidConfirmedById: string | null;

  @Column({ name: 'proof_document_id', type: 'uuid', nullable: true })
  proofDocumentId: string | null;

  @OneToMany(() => InstallmentCondition, (condition) => condition.installment)
  conditions: Relation<InstallmentCondition[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

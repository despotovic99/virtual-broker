import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { DeveloperBankAccount } from '../../catalog/entities/developer-bank-account.entity.js';
import { Installment } from './installment.entity.js';

/**
 * PENDING_APPROVAL: čeka dva odobrenja (četiri oka).
 * APPROVED: odobrena, čeka escrow partnera.
 * EXECUTED: escrow partner potvrdio isplatu.
 * RETURNED: escrow partner vratio instrukciju uz razlog.
 */
export const ESCROW_INSTRUCTION_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'RETURNED'] as const;
export type EscrowInstructionStatus = (typeof ESCROW_INSTRUCTION_STATUSES)[number];

/**
 * Instrukcija escrow partneru da isplati ratu investitoru (F-15, samo model
 * ESCROW). Mi nikad ne držimo novac; isplatu izvršava escrow partner van
 * platforme (bankarska integracija je dummy) i ovde je potvrđuje.
 */
@Entity({ name: 'escrow_instructions' })
export class EscrowInstruction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('uq_escrow_instructions_installment', { unique: true })
  @Column({ name: 'installment_id', type: 'uuid' })
  installmentId: string;

  @ManyToOne(() => Installment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installment_id' })
  installment?: Relation<Installment>;

  @Index('ix_escrow_instructions_purchase_id')
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'bank_account_id', type: 'uuid' })
  bankAccountId: string;

  @ManyToOne(() => DeveloperBankAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount?: Relation<DeveloperBankAccount>;

  @Column({ type: 'enum', enum: [...ESCROW_INSTRUCTION_STATUSES], enumName: 'escrow_instruction_status', default: 'PENDING_APPROVAL' })
  status: EscrowInstructionStatus;

  @Column({ name: 'first_approver_id', type: 'uuid', nullable: true })
  firstApproverId: string | null;

  @Column({ name: 'first_approved_at', type: 'timestamptz', nullable: true })
  firstApprovedAt: Date | null;

  @Column({ name: 'second_approver_id', type: 'uuid', nullable: true })
  secondApproverId: string | null;

  @Column({ name: 'second_approved_at', type: 'timestamptz', nullable: true })
  secondApprovedAt: Date | null;

  @Column({ name: 'executed_by_id', type: 'uuid', nullable: true })
  executedById: string | null;

  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt: Date | null;

  @Column({ name: 'return_reason', type: 'varchar', length: 500, nullable: true })
  returnReason: string | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

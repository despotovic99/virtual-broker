import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { AreaColumn, MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from '../../purchases/entities/purchase.entity.js';

/** Pregled i merenje stana pri primopredaji (F-20). */
@Entity({ name: 'handovers' })
export class Handover {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('uq_handovers_purchase_id', { unique: true })
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  @Column({ name: 'engineer_id', type: 'uuid' })
  engineerId: string;

  @Column({ name: 'inspected_at', type: 'timestamptz' })
  inspectedAt: Date;

  @AreaColumn({ name: 'contract_area' })
  contractArea: number;

  @AreaColumn({ name: 'measured_area' })
  measuredArea: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'keys_handed_at', type: 'timestamptz', nullable: true })
  keysHandedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

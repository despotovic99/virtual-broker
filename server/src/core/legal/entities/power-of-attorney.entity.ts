import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from '../../purchases/entities/purchase.entity.js';

/**
 * Punomoćje kupca advokatu (F-13, P9 i P10). Potpisuje se van platforme i
 * otprema kao dokument. Obim je ograničen: nikad opterećenje, prodaja,
 * prijem novca ni promena računa.
 */
@Entity({ name: 'powers_of_attorney' })
export class PowerOfAttorney {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_powers_of_attorney_purchase_id')
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  /** Dozvoljene radnje (kodovi iz POA_SCOPES). */
  @Column({ type: 'text', array: true })
  scope: string[];

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Radnje koje punomoćje sme da obuhvati. */
export const POA_SCOPES = [
  'CADASTRE_SEARCH',
  'CONTRACT_DEPOSIT',
  'PERMIT_APPLICATION',
  'COURT_SEARCH',
  'RECEIVE_DOCUMENTS',
  'TITLE_TRANSFER',
] as const;

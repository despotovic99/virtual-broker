import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';

/**
 * Investitor (developer). U MVP-u ga unosi naš tim (F-32); investitor nema
 * nalog ni ekrane do faze 2. Jedan zapis po registraciji firme na tržištu.
 */
@Entity({ name: 'developers' })
@Index('uq_developers_market_registration', ['market', 'registrationNumber'], { unique: true })
export class Developer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** RS: matični broj. CY: HE broj. */
  @Column({ name: 'registration_number', type: 'varchar', length: 32 })
  registrationNumber: string;

  /** RS: PIB. CY: VAT broj. */
  @Column({ name: 'tax_number', type: 'varchar', length: 32, nullable: true })
  taxNumber: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  website: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

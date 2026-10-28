import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Developer } from './developer.entity.js';

/**
 * Račun investitora na koji idu uplate ili isplate (F-16). Uplata je moguća
 * samo na proveren račun. Promena računa = nov zapis i nova provera.
 */
@Entity({ name: 'developer_bank_accounts' })
export class DeveloperBankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_developer_bank_accounts_developer_id')
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @ManyToOne(() => Developer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer?: Relation<Developer>;

  @Column({ type: 'varchar', length: 34 })
  iban: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 120 })
  bankName: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 200 })
  holderName: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'verified_by_id', type: 'uuid', nullable: true })
  verifiedById: string | null;

  /** Kako je račun proveren (npr. potvrda banke, poziv na poznat broj). */
  @Column({ name: 'verification_note', type: 'varchar', length: 500, nullable: true })
  verificationNote: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

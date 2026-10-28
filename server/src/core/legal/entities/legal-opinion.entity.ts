import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import { Purchase } from '../../purchases/entities/purchase.entity.js';

export const OPINION_CONCLUSIONS = ['SIGN', 'SIGN_WITH_CONDITIONS', 'DO_NOT_SIGN'] as const;
export type OpinionConclusion = (typeof OPINION_CONCLUSIONS)[number];

/**
 * Pravno mišljenje advokata pre potpisa ugovora (F-12, F-13 P15). Potpisan
 * PDF se otprema kao dokument. Ugovor ne može da se potpiše bez mišljenja.
 */
@Entity({ name: 'legal_opinions' })
export class LegalOpinion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_legal_opinions_purchase_id')
  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase?: Relation<Purchase>;

  @Column({ type: 'enum', enum: [...OPINION_CONCLUSIONS], enumName: 'opinion_conclusion' })
  conclusion: OpinionConclusion;

  @Column({ type: 'text' })
  reasoning: string;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  /** Potpisan PDF mišljenja. */
  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

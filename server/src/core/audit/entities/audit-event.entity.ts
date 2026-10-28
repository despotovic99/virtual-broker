import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';

/** Bezbedni detalji promene: samo jednostavne vrednosti. */
export type AuditData = Record<string, string | number | boolean | null | string[]>;

/**
 * Nepromenljiv trag ko je šta uradio (README, odeljak 11). Upisuje se u istoj
 * transakciji kao i sama promena. Nema izmene ni brisanja.
 */
@Entity({ name: 'audit_events' })
@Index('ix_audit_events_entity', ['entityType', 'entityId'])
@Index('ix_audit_events_created_at', ['createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: [...MARKET_CODES], enumName: 'market', nullable: true })
  market: MarketCode | null;

  /** null: akciju je uradio sistem. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  /** Npr. purchase.step.completed, escrow.instruction.approved. */
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  /** Bezbedni detalji promene (bez lozinki, tokena i dokumenata). */
  @Column({ type: 'jsonb', nullable: true })
  data: AuditData | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

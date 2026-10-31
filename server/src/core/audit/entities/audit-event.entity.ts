import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';

/** Jednostavna vrednost u tragu (bez lozinki, tokena i sadržaja dokumenata). */
export type AuditValue = string | number | boolean | null | string[];

/** Izmena jednog polja: stara i nova vrednost. */
export interface AuditChange {
  from: AuditValue;
  to: AuditValue;
}

/**
 * Bezbedni detalji promene. `changes` nosi izmenjena polja (polje → stara i
 * nova vrednost); ostali ključevi su jednostavne vrednosti (npr. purchaseId).
 */
export type AuditData = { changes?: Record<string, AuditChange> } & Record<string, AuditValue | Record<string, AuditChange> | undefined>;

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

  @MarketColumn({ nullable: true })
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

  /** IP adresa sa koje je zahtev stigao (null: sistem ili pozadinski posao). */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  /** Bezbedni detalji promene (bez lozinki, tokena i dokumenata). */
  @Column({ type: 'jsonb', nullable: true })
  data: AuditData | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

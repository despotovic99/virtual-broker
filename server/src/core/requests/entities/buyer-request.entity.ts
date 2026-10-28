import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';
import type { SemaphoreResult } from '../../checks/semaphore.js';
import { User } from '../../users/entities/user.entity.js';

export const REQUEST_KINDS = ['CHECK', 'QUESTION', 'GUIDED_PURCHASE'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM', 'ANSWERED', 'CONVERTED', 'CLOSED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Snimak besplatnog semafora u trenutku zahteva (investitor ne mora biti u katalogu). */
export interface FreeSemaphoreSnapshot {
  developer: SemaphoreResult | null;
  parcel: SemaphoreResult | null;
  checkedAt: string;
}

export const ANSWER_SCOPES = ['INFORMATION', 'ENGAGED_ADVICE'] as const;
export type AnswerScope = (typeof ANSWER_SCOPES)[number];

/** Zahtev kupca (F-35): provera, pitanje ili „vodi moju kupovinu”. */
@Entity({ name: 'buyer_requests' })
@Index('ix_buyer_requests_market_status', ['market', 'status'])
export class BuyerRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Index('ix_buyer_requests_buyer_id')
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer?: Relation<User>;

  @Column({ type: 'enum', enum: [...REQUEST_KINDS], enumName: 'request_kind' })
  kind: RequestKind;

  @Column({ type: 'enum', enum: [...REQUEST_STATUSES], enumName: 'request_status', default: 'NEW' })
  status: RequestStatus;

  @Column({ name: 'listing_url', type: 'varchar', length: 500, nullable: true })
  listingUrl: string | null;

  @Column({ name: 'developer_name', type: 'varchar', length: 200, nullable: true })
  developerName: string | null;

  @Column({ name: 'registration_number', type: 'varchar', length: 32, nullable: true })
  registrationNumber: string | null;

  @Column({ name: 'parcel_reference', type: 'varchar', length: 120, nullable: true })
  parcelReference: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  question: string | null;

  /** Besplatni semafor iz automatskih izvora (u MVP-u DUMMY), za zahtev tipa CHECK. */
  @Column({ name: 'free_semaphore', type: 'jsonb', nullable: true })
  freeSemaphore: FreeSemaphoreSnapshot | null;

  @Column({ name: 'developer_id', type: 'uuid', nullable: true })
  developerId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  /** Analitičar koji vodi zahtev. */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ name: 'legal_team_id', type: 'uuid', nullable: true })
  legalTeamId: string | null;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ name: 'answer_scope', type: 'enum', enum: [...ANSWER_SCOPES], enumName: 'answer_scope', nullable: true })
  answerScope: AnswerScope | null;

  @Column({ name: 'answered_by_id', type: 'uuid', nullable: true })
  answeredById: string | null;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string | null;

  @Column({ name: 'first_response_due_at', type: 'timestamptz' })
  firstResponseDueAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

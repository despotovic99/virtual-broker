import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MarketColumn } from '../../../common/db/columns.js';
import type { MarketCode } from '../../../markets/market-code.js';

export const DOCUMENT_SCOPES = ['PURCHASE', 'PROJECT', 'DEVELOPER', 'REPORT'] as const;
export type DocumentScopeValue = (typeof DOCUMENT_SCOPES)[number];

/**
 * Dokument u trezoru (F-02). Fajl je u S3 (MinIO u dev-u) pod `storageKey`;
 * u bazi su samo metapodaci i SHA-256 heš. Pristup zavisi od vlasnika
 * (kupovina, projekat, investitor ili izveštaj inženjera).
 */
@Entity({ name: 'documents' })
@Index('ix_documents_purchase_id', ['purchaseId'])
@Index('ix_documents_project_id', ['projectId'])
@Index('ix_documents_developer_id', ['developerId'])
@Index('ix_documents_report_id', ['reportId'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @MarketColumn()
  market: MarketCode;

  @Column({ type: 'enum', enum: [...DOCUMENT_SCOPES], enumName: 'document_scope' })
  scope: DocumentScopeValue;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'developer_id', type: 'uuid', nullable: true })
  developerId: string | null;

  @Column({ name: 'report_id', type: 'uuid', nullable: true })
  reportId: string | null;

  /** Vrsta dokumenta iz paketa tržišta (npr. RS_PROPERTY_SHEET). */
  @Column({ name: 'type_code', type: 'varchar', length: 64 })
  typeCode: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 300 })
  storageKey: string;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

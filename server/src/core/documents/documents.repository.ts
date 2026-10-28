import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Document, type DocumentScopeValue } from './entities/document.entity.js';

export interface NewDocument {
  market: Document['market'];
  scope: DocumentScopeValue;
  purchaseId: string | null;
  projectId: string | null;
  developerId: string | null;
  reportId: string | null;
  typeCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  uploadedById: string;
}

export interface DocumentOwnerFilter {
  purchaseId?: string;
  projectId?: string;
  developerId?: string;
  reportId?: string;
}

@Injectable()
export class DocumentsRepository {
  async insert(manager: EntityManager, data: NewDocument): Promise<Document> {
    const repository = manager.getRepository(Document);
    const result = await repository.insert(data);
    const id = (result.identifiers[0] as { id: string }).id;
    return repository.findOneOrFail({ where: { id } });
  }

  findById(manager: EntityManager, id: string): Promise<Document | null> {
    return manager.getRepository(Document).findOne({ where: { id } });
  }

  list(manager: EntityManager, filter: DocumentOwnerFilter): Promise<Document[]> {
    return manager.getRepository(Document).find({ where: { ...filter }, order: { createdAt: 'DESC' }, take: 200 });
  }
}

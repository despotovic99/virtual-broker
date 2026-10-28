import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { PurchasesModule } from '../purchases/purchases.module.js';
import { LegalWorkController } from './legal-work.controller.js';
import { LegalWorkRepository } from './legal-work.repository.js';
import { LegalWorkService } from './legal-work.service.js';

/**
 * Rad pravnog tima na kupovini: punomoćje i pravno mišljenje (F-12, F-13).
 * Niko ne importuje ovaj modul (PurchasesModule proverava mišljenje sam).
 */
@Module({
  imports: [PurchasesModule, DocumentsModule],
  controllers: [LegalWorkController],
  providers: [LegalWorkService, LegalWorkRepository],
})
export class LegalWorkModule {}

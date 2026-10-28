import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PurchasesModule } from '../purchases/purchases.module.js';
import { ConstructionController } from './construction.controller.js';
import { ConstructionRepository } from './construction.repository.js';
import { ConstructionService } from './construction.service.js';

/** Gradnja: faze projekta i izveštaji nezavisnog inženjera (F-17, F-18). */
@Module({
  imports: [CatalogModule, PurchasesModule, DocumentsModule, PaymentsModule],
  controllers: [ConstructionController],
  providers: [ConstructionService, ConstructionRepository],
})
export class ConstructionModule {}

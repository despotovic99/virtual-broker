import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PurchasesModule } from '../purchases/purchases.module.js';
import { EscrowRepository } from './escrow.repository.js';
import { EscrowService } from './escrow.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentsService } from './payments.service.js';

/** Novac: plan uplata, uslovi pre uplate, kapija (RS) i escrow (CY) (F-14 – F-16). */
@Module({
  imports: [PurchasesModule, DocumentsModule, CatalogModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, EscrowService, EscrowRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}

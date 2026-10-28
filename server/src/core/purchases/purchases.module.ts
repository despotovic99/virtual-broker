import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ChecksModule } from '../checks/checks.module.js';
import { LegalTeamsModule } from '../legal/legal-teams.module.js';
import { RequestsModule } from '../requests/requests.module.js';
import { UsersModule } from '../users/users.module.js';
import { PurchaseAccessRepository } from './purchase-access.repository.js';
import { PurchaseAccessService } from './purchase-access.service.js';
import { PurchaseMessagesService } from './purchase-messages.service.js';
import { PurchaseTasksService } from './purchase-tasks.service.js';
import { PurchasesController, TasksController } from './purchases.controller.js';
import { PurchasesRepository } from './purchases.repository.js';
import { PurchasesService } from './purchases.service.js';

/**
 * Kupovine (F-01, F-13, F-24). PurchaseAccessService je jedino mesto koje
 * odlučuje ko vidi koju kupovinu. Ovaj modul NE sme da importuje
 * DocumentsModule ni LegalWorkModule (oni importuju njega).
 */
@Module({
  imports: [CatalogModule, ChecksModule, RequestsModule, LegalTeamsModule, UsersModule],
  controllers: [PurchasesController, TasksController],
  providers: [
    PurchaseAccessService,
    PurchaseAccessRepository,
    PurchasesService,
    PurchasesRepository,
    PurchaseTasksService,
    PurchaseMessagesService,
  ],
  exports: [PurchaseAccessService],
})
export class PurchasesModule {}

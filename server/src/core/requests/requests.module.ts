import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ChecksModule } from '../checks/checks.module.js';
import { LegalTeamsModule } from '../legal/legal-teams.module.js';
import { RequestsAppService } from './requests-app.service.js';
import { RequestsController } from './requests.controller.js';
import { RequestsRepository } from './requests.repository.js';
import { RequestsService } from './requests.service.js';

/**
 * Zahtevi kupca i besplatni semafor (F-35). PurchasesModule importuje ovaj
 * modul, pa ovaj ne sme da importuje PurchasesModule.
 */
@Module({
  imports: [CatalogModule, ChecksModule, LegalTeamsModule],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsRepository, RequestsAppService],
  exports: [RequestsService],
})
export class RequestsModule {}

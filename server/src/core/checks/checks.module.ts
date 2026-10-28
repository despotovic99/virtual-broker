import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CatalogBrowseService } from './catalog-browse.service.js';
import { ChecksAdminService } from './checks-admin.service.js';
import { ChecksController } from './checks.controller.js';
import { ChecksRepository } from './checks.repository.js';
import { ChecksService } from './checks.service.js';

/** Provere i semafor (F-05 – F-08) i detalj projekta sa semaforom (F-04). */
@Module({
  imports: [CatalogModule],
  controllers: [ChecksController],
  providers: [ChecksService, ChecksRepository, ChecksAdminService, CatalogBrowseService],
  exports: [ChecksService],
})
export class ChecksModule {}

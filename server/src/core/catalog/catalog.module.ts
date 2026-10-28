import { Module } from '@nestjs/common';
import { CatalogAdminRepository } from './catalog-admin.repository.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';

/**
 * Katalog: investitori, projekti, stanovi, računi investitora.
 * Ne sme da importuje ChecksModule (ChecksModule importuje ovaj modul).
 */
@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository, CatalogAdminService, CatalogAdminRepository],
  exports: [CatalogService],
})
export class CatalogModule {}

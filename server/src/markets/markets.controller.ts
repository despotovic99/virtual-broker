import { Controller, Get } from '@nestjs/common';
import { Authenticated } from '../core/access/access.decorators.js';
import { MarketsMetadataService, type MarketMetadataDto } from './markets-metadata.service.js';

@Controller('markets')
export class MarketsController {
  constructor(private readonly metadata: MarketsMetadataService) {}

  /** Paketi tržišta za klijent: koraci kupovine, provere, uslovi, faze, dokumenta. */
  @Get()
  @Authenticated()
  list(): MarketMetadataDto[] {
    return this.metadata.list();
  }
}

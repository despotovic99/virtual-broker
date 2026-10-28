import { Global, Module } from '@nestjs/common';
import { cyMarketPack } from './cy/cy.market-pack.js';
import { MARKET_PACKS } from './market-pack.js';
import { MarketRegistry } from './market-registry.js';
import { MarketsMetadataService } from './markets-metadata.service.js';
import { MarketsController } from './markets.controller.js';
import { rsMarketPack } from './rs/rs.market-pack.js';

// Jedino mesto gde se registruju paketi tržišta.
@Global()
@Module({
  controllers: [MarketsController],
  providers: [{ provide: MARKET_PACKS, useValue: [cyMarketPack, rsMarketPack] }, MarketRegistry, MarketsMetadataService],
  exports: [MarketRegistry],
})
export class MarketsModule {}

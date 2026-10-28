import { Global, Module } from '@nestjs/common';
import { DUMMY_CHECK_INTEGRATIONS } from './dummy/dummy-check-integrations.js';
import { DummyEmailSender, EMAIL_SENDER } from './dummy/dummy-email.sender.js';
import { DummyPriceIndex, PRICE_INDEX } from './dummy/dummy-price-index.js';
import { CHECK_INTEGRATIONS, type CheckIntegration } from './integration.types.js';

/**
 * Spoljni izvori podataka. U MVP-u su SVI DUMMY (videti src/integrations/dummy).
 * Prava integracija se uključuje zamenom klase u ovom modulu.
 */
@Global()
@Module({
  providers: [
    ...DUMMY_CHECK_INTEGRATIONS,
    {
      provide: CHECK_INTEGRATIONS,
      inject: [...DUMMY_CHECK_INTEGRATIONS],
      useFactory: (...integrations: CheckIntegration[]) => integrations,
    },
    { provide: EMAIL_SENDER, useClass: DummyEmailSender },
    { provide: PRICE_INDEX, useClass: DummyPriceIndex },
  ],
  exports: [CHECK_INTEGRATIONS, EMAIL_SENDER, PRICE_INDEX],
})
export class IntegrationsModule {}

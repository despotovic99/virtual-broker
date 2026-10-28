import { Module } from '@nestjs/common';
import { BuyerProfileRepository } from './buyer-profile.repository.js';
import { CostsController } from './costs.controller.js';
import { CostsService } from './costs.service.js';

/** Profil kupca, troškovi, procena cene i pravne napomene (F-03, F-09 – F-11). */
@Module({
  controllers: [CostsController],
  providers: [CostsService, BuyerProfileRepository],
})
export class CostsModule {}

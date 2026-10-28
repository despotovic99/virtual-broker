import { Module } from '@nestjs/common';
import { PurchasesModule } from '../purchases/purchases.module.js';
import { HandoverController } from './handover.controller.js';
import { HandoverRepository } from './handover.repository.js';
import { HandoverService } from './handover.service.js';

/** Primopredaja, merenje i zapisnik o nedostacima (F-20, F-21). */
@Module({
  imports: [PurchasesModule],
  controllers: [HandoverController],
  providers: [HandoverService, HandoverRepository],
})
export class HandoverModule {}

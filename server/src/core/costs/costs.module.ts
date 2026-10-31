import { Module } from '@nestjs/common';
import { CostsController } from './costs.controller.js';
import { CostsService } from './costs.service.js';
import { UsersModule } from '../users/users.module.js';

/** Profil kupca, troškovi, procena cene i pravne napomene (F-03, F-09 – F-11). */
@Module({
  imports: [UsersModule],
  controllers: [CostsController],
  providers: [CostsService],
})
export class CostsModule {}

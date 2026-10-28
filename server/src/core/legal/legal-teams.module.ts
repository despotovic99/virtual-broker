import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { LegalTeamsAdminService } from './legal-teams-admin.service.js';
import { LegalTeamsController } from './legal-teams.controller.js';
import { LegalTeamsRepository } from './legal-teams.repository.js';
import { LegalTeamsService } from './legal-teams.service.js';

/**
 * Pravni timovi: članstvo, predlog tima (LegalTeamsService) i administracija
 * (LegalTeamsAdminService). UsersModule ne sme da importuje ovaj modul.
 */
@Module({
  imports: [UsersModule],
  controllers: [LegalTeamsController],
  providers: [LegalTeamsService, LegalTeamsRepository, LegalTeamsAdminService],
  exports: [LegalTeamsService, LegalTeamsRepository],
})
export class LegalTeamsModule {}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import {
  AvailableLegalTeamsQueryDto,
  CreateLegalTeamDto,
  type AvailableLegalTeamDto,
  UpdateLegalTeamDto,
  UpsertTeamMemberDto,
  type LegalTeamResponseDto,
  type MyLegalTeamDto,
} from './dto/legal-team.dto.js';
import { LegalTeamsAdminService } from './legal-teams-admin.service.js';

@Controller('legal-teams')
export class LegalTeamsController {
  constructor(private readonly teams: LegalTeamsAdminService) {}

  @Get()
  @RequireCapabilities(Capability.LegalTeamsManage)
  list(@CurrentUser() actor: AuthUser): Promise<LegalTeamResponseDto[]> {
    return this.teams.list(actor);
  }

  /** Timovi za dodelu na kupovini i za prosleđivanje zahteva (naš tim na tržištu). */
  @Get('available')
  @RequireCapabilities(Capability.RequestsTriage)
  available(@CurrentUser() actor: AuthUser, @Query() query: AvailableLegalTeamsQueryDto): Promise<AvailableLegalTeamDto[]> {
    return this.teams.available(actor, query.market, query.developerId);
  }

  /** Timovi kojima prijavljeni advokat pripada, sa njegovom ulogom u timu. */
  @Get('mine')
  @RequireCapabilities(Capability.TasksWork)
  mine(@CurrentUser() actor: AuthUser): Promise<MyLegalTeamDto[]> {
    return this.teams.mine(actor);
  }

  @Post()
  @RequireCapabilities(Capability.LegalTeamsManage)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateLegalTeamDto): Promise<LegalTeamResponseDto> {
    return this.teams.create(actor, dto);
  }

  @Patch(':id')
  @RequireCapabilities(Capability.LegalTeamsManage)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalTeamDto,
  ): Promise<LegalTeamResponseDto> {
    return this.teams.update(actor, id, dto);
  }

  @Put(':id/members/:userId')
  @RequireCapabilities(Capability.LegalTeamsManage)
  upsertMember(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpsertTeamMemberDto,
  ): Promise<LegalTeamResponseDto> {
    return this.teams.upsertMember(actor, id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @RequireCapabilities(Capability.LegalTeamsManage)
  removeMember(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<LegalTeamResponseDto> {
    return this.teams.removeMember(actor, id, userId);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { CreateDefectDto, RecordHandoverDto, UpdateDefectDto } from './dto/handover.dto.js';
import { HandoverService, type DefectResponse, type HandoverResponse } from './handover.service.js';

@Controller()
export class HandoverController {
  constructor(private readonly handover: HandoverService) {}

  @Get('purchases/:id/handover')
  @RequireCapabilities(Capability.PurchasesRead)
  get(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ handover: HandoverResponse | null; defects: DefectResponse[] }> {
    return this.handover.getHandover(actor, id);
  }

  @Post('purchases/:id/handover')
  @RequireCapabilities(Capability.HandoverManage)
  record(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordHandoverDto,
  ): Promise<HandoverResponse> {
    return this.handover.recordHandover(actor, id, dto);
  }

  /** Predaja ključeva: koordinator, naš tim ili inženjer kupovine (proverava servis). */
  @Patch('purchases/:id/handover/keys')
  @RequireCapabilities(Capability.DefectsManage)
  keys(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<HandoverResponse> {
    return this.handover.handOverKeys(actor, id);
  }

  @Post('purchases/:id/defects')
  @RequireCapabilities(Capability.DefectsManage)
  createDefect(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDefectDto,
  ): Promise<DefectResponse> {
    return this.handover.createDefect(actor, id, dto);
  }

  @Patch('defects/:id')
  @RequireCapabilities(Capability.DefectsManage)
  updateDefect(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDefectDto,
  ): Promise<DefectResponse> {
    return this.handover.updateDefect(actor, id, dto);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import {
  CreateLegalOpinionDto,
  CreatePowerOfAttorneyDto,
  type LegalOpinionDto,
  type PowerOfAttorneyDto,
} from './dto/legal-work.dto.js';
import { LegalWorkService } from './legal-work.service.js';

/** Punomoćje i pravno mišljenje na kupovini (F-12, F-13). Pristup kupovini proverava servis. */
@Controller()
export class LegalWorkController {
  constructor(private readonly legal: LegalWorkService) {}

  @Get('purchases/:id/powers-of-attorney')
  @RequireCapabilities(Capability.PurchasesRead)
  listPowersOfAttorney(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PowerOfAttorneyDto[]> {
    return this.legal.listPowersOfAttorney(actor, id);
  }

  @Post('purchases/:id/powers-of-attorney')
  @RequireCapabilities(Capability.PowerOfAttorneyManage)
  createPowerOfAttorney(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePowerOfAttorneyDto,
  ): Promise<PowerOfAttorneyDto> {
    return this.legal.createPowerOfAttorney(actor, id, dto);
  }

  @Post('powers-of-attorney/:id/revoke')
  @RequireCapabilities(Capability.PowerOfAttorneyManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokePowerOfAttorney(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.legal.revokePowerOfAttorney(actor, id);
  }

  @Get('purchases/:id/legal-opinions')
  @RequireCapabilities(Capability.PurchasesRead)
  listOpinions(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<LegalOpinionDto[]> {
    return this.legal.listOpinions(actor, id);
  }

  @Post('purchases/:id/legal-opinions')
  @RequireCapabilities(Capability.LegalOpinionsSign)
  createOpinion(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLegalOpinionDto,
  ): Promise<LegalOpinionDto> {
    return this.legal.createOpinion(actor, id, dto);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { CatalogBrowseService, type ProjectDetailResponse } from './catalog-browse.service.js';
import {
  ChecksAdminService,
  type CheckHistoryItem,
  type CheckHistoryListResponse,
  type ProjectSemaphoreResponse,
  type SemaphoreResponse,
} from './checks-admin.service.js';
import { CheckHistoryQueryDto, CheckTargetDto, ManualCheckDto } from './dto/checks.dto.js';

@Controller()
export class ChecksController {
  constructor(
    private readonly checks: ChecksAdminService,
    private readonly browse: CatalogBrowseService,
  ) {}

  /** Detalj projekta sa stanovima i semaforom (F-04). */
  @Get('catalog/projects/:id')
  @RequireCapabilities(Capability.CatalogRead)
  projectDetail(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ProjectDetailResponse> {
    return this.browse.projectDetail(actor, id);
  }

  /** Pokreće automatske provere (u MVP-u DUMMY izvori) za investitora ili projekat. */
  @Post('checks/run')
  @RequireCapabilities(Capability.ChecksManage)
  run(@CurrentUser() actor: AuthUser, @Body() dto: CheckTargetDto): Promise<SemaphoreResponse> {
    return this.checks.runAutomatic(actor, dto);
  }

  /** Ručni unos provere (analitičar: MANUAL/DOCUMENT, advokat: LAWYER/DOCUMENT). */
  @Post('checks')
  @RequireCapabilities(Capability.ChecksManage)
  record(@CurrentUser() actor: AuthUser, @Body() dto: ManualCheckDto): Promise<CheckHistoryItem> {
    return this.checks.recordManual(actor, dto);
  }

  @Get('checks/history')
  @RequireCapabilities(Capability.ChecksRead)
  history(@CurrentUser() actor: AuthUser, @Query() query: CheckHistoryQueryDto): Promise<CheckHistoryListResponse> {
    return this.checks.history(actor, query);
  }

  @Get('checks/developers/:id/semaphore')
  @RequireCapabilities(Capability.ChecksRead)
  developerSemaphore(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SemaphoreResponse> {
    return this.checks.developerSemaphore(actor, id);
  }

  @Get('checks/projects/:id/semaphore')
  @RequireCapabilities(Capability.ChecksRead)
  projectSemaphore(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ProjectSemaphoreResponse> {
    return this.checks.projectSemaphore(actor, id);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { AuditService, type AuditEventListResponse } from './audit.service.js';
import { ListAuditQueryDto } from './dto/list-audit-query.dto.js';
import { administeredMarkets } from '../users/admin-scope.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireCapabilities(Capability.AuditRead)
  list(@CurrentUser() actor: AuthUser, @Query() query: ListAuditQueryDto): Promise<AuditEventListResponse> {
    return this.audit.list(
      { entityType: query.entityType, entityId: query.entityId, relatedTo: query.relatedTo, markets: administeredMarkets(actor) },
      query,
    );
  }
}

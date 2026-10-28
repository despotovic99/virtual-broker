import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { AuditService, type AuditEventResponse } from './audit.service.js';

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireCapabilities(Capability.AuditRead)
  list(@CurrentUser() actor: AuthUser, @Query() query: AuditQueryDto): Promise<AuditEventResponse[]> {
    return this.audit.list({ entityType: query.entityType, entityId: query.entityId, markets: actor.markets }, query.limit);
  }
}

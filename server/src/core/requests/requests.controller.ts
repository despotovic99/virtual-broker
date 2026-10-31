import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { Authenticated, RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import {
  AnswerRequestDto,
  CreateRequestDto,
  ForwardRequestDto,
  LegalAnswerRequestDto,
  LinkRequestDto,
  RequestQueueQueryDto,
} from './dto/requests.dto.js';
import { RequestsAppService, type RequestListResponse } from './requests-app.service.js';
import type { RequestResponse } from './requests.mapper.js';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsAppService) {}

  /** Kupac podnosi zahtev; za CHECK dobija besplatni semafor (DUMMY izvori u MVP-u). */
  @Post()
  @RequireCapabilities(Capability.RequestsCreate)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateRequestDto): Promise<RequestResponse> {
    return this.requests.create(actor, dto);
  }

  @Get('mine')
  @RequireCapabilities(Capability.RequestsCreate)
  mine(@CurrentUser() actor: AuthUser, @Query() query: PaginationQueryDto): Promise<RequestListResponse> {
    return this.requests.listMine(actor, query);
  }

  @Get('queue')
  @RequireCapabilities(Capability.RequestsTriage)
  queue(@CurrentUser() actor: AuthUser, @Query() query: RequestQueueQueryDto): Promise<RequestListResponse> {
    return this.requests.queue(actor, query);
  }

  @Get('legal-queue')
  @RequireCapabilities(Capability.RequestsAnswerLegal)
  legalQueue(@CurrentUser() actor: AuthUser, @Query() query: PaginationQueryDto): Promise<RequestListResponse> {
    return this.requests.legalQueue(actor, query);
  }

  /** Kupac vidi svoj zahtev, tim i pravni tim vide zahteve sa svog tržišta (proverava servis). */
  @Get(':id')
  @Authenticated()
  getOne(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RequestResponse> {
    return this.requests.getOne(actor, id);
  }

  @Post(':id/take')
  @RequireCapabilities(Capability.RequestsTriage)
  take(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RequestResponse> {
    return this.requests.take(actor, id);
  }

  @Patch(':id/link')
  @RequireCapabilities(Capability.RequestsTriage)
  link(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkRequestDto): Promise<RequestResponse> {
    return this.requests.link(actor, id, dto);
  }

  @Post(':id/forward')
  @RequireCapabilities(Capability.RequestsTriage)
  forward(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForwardRequestDto,
  ): Promise<RequestResponse> {
    return this.requests.forward(actor, id, dto);
  }

  @Post(':id/answer')
  @RequireCapabilities(Capability.RequestsTriage)
  answer(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswerRequestDto): Promise<RequestResponse> {
    return this.requests.answer(actor, id, dto);
  }

  @Post(':id/legal-answer')
  @RequireCapabilities(Capability.RequestsAnswerLegal)
  legalAnswer(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LegalAnswerRequestDto,
  ): Promise<RequestResponse> {
    return this.requests.legalAnswer(actor, id, dto);
  }

  @Post(':id/close')
  @RequireCapabilities(Capability.RequestsTriage)
  close(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RequestResponse> {
    return this.requests.close(actor, id);
  }
}

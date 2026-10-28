import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import type { DocumentResponse } from '../documents/documents.service.js';
import { MAX_DOCUMENT_BYTES, type UploadedFileData } from '../documents/file-validation.js';
import { ConstructionService, type ConstructionResponse, type EngineerReportResponse } from './construction.service.js';
import { CreateEngineerReportDto, UpdateConstructionPlanDto } from './dto/construction.dto.js';

@Controller()
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}

  @Get('projects/:id/construction')
  @RequireCapabilities(Capability.ConstructionRead)
  get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ConstructionResponse> {
    return this.construction.getConstruction(actor, id);
  }

  /** Planirani datumi faza (naš tim na tržištu projekta). */
  @Put('projects/:id/construction/plan')
  @RequireCapabilities(Capability.PaymentsPlan)
  updatePlan(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConstructionPlanDto,
  ): Promise<ConstructionResponse> {
    return this.construction.updatePlan(actor, id, dto);
  }

  @Get('projects/:id/reports')
  @RequireCapabilities(Capability.ConstructionRead)
  listReports(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EngineerReportResponse[]> {
    return this.construction.listReports(actor, id);
  }

  @Post('projects/:id/reports')
  @RequireCapabilities(Capability.ConstructionReport)
  createReport(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEngineerReportDto,
  ): Promise<EngineerReportResponse> {
    return this.construction.createReport(actor, id, dto);
  }

  @Post('reports/:id/files')
  @RequireCapabilities(Capability.ConstructionReport)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 5 } }))
  addFile(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
  ): Promise<DocumentResponse> {
    return this.construction.addReportFile(actor, id, file);
  }
}

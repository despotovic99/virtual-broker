import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import type { DocumentResponse } from '../documents/documents.service.js';
import { MAX_DOCUMENT_BYTES, type UploadedFileData } from '../documents/file-validation.js';
import {
  ConstructionService,
  MAX_REPORT_FILES,
  type ConstructionResponse,
  type EngineerReportListResponse,
  type EngineerReportResponse,
} from './construction.service.js';
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
  listReports(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<EngineerReportListResponse> {
    return this.construction.listReports(actor, id, query);
  }

  /** JSON ili multipart: polja izveštaja i do 10 priloga u polju `files` (PDF, JPG, PNG, do 20 MB svaki). */
  @Post('projects/:id/reports')
  @RequireCapabilities(Capability.ConstructionReport)
  @UseInterceptors(
    FilesInterceptor('files', MAX_REPORT_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: MAX_REPORT_FILES, fields: 10 },
    }),
  )
  createReport(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEngineerReportDto,
    @UploadedFiles() files: UploadedFileData[] | undefined,
  ): Promise<EngineerReportResponse> {
    return this.construction.createReport(actor, id, dto, files ?? []);
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

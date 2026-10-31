import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Authenticated, RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { DocumentsService, type DocumentListResponse, type DocumentResponse } from './documents.service.js';
import { ListDocumentsQueryDto, UploadDocumentDto } from './dto/upload-document.dto.js';
import { MAX_DOCUMENT_BYTES, type UploadedFileData } from './file-validation.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @RequireCapabilities(Capability.DocumentsUpload)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 10 } }))
  upload(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: UploadedFileData | undefined,
  ): Promise<DocumentResponse> {
    return this.documents.upload(actor, dto, file);
  }

  /** Spisak dokumenata jednog vlasnika. Pristup proverava servis (učesnici kupovine, tim na tržištu). */
  @Get()
  @Authenticated()
  list(@CurrentUser() actor: AuthUser, @Query() query: ListDocumentsQueryDto): Promise<DocumentListResponse> {
    return this.documents.list(actor, query);
  }

  @Get(':id/content')
  @Authenticated()
  async content(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const download = await this.documents.download(actor, id);
    return new StreamableFile(download.stream, {
      type: download.mimeType,
      length: download.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`,
    });
  }
}

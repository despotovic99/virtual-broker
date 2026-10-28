import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/** Polja koja stižu uz fajl (multipart). Vlasnik je tačno jedan od id-eva, prema `scope`. */
export class UploadDocumentDto {
  @IsIn(['PURCHASE', 'PROJECT', 'DEVELOPER'])
  scope: 'PURCHASE' | 'PROJECT' | 'DEVELOPER';

  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/)
  typeCode: string;
}

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  reportId?: string;
}

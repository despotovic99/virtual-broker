import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { SEMAPHORE_STATUSES, type Semaphore } from '../../../common/db/columns.js';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';

/** Cilj provere: tačno jedan od developerId i projectId (proverava servis). */
export class CheckTargetDto {
  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class ManualCheckDto extends CheckTargetDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/)
  definitionCode: string;

  @IsIn([...SEMAPHORE_STATUSES])
  status: Semaphore;

  @IsString()
  @Length(3, 500)
  summary: string;

  /** Dokument iz trezora koji dokazuje proveru (obavezan za metodu DOCUMENT). */
  @IsOptional()
  @IsUUID()
  documentId?: string;
}

/** Istorija provera: tačno jedan od developerId i projectId (proverava servis), uz paginaciju. */
export class CheckHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { SEMAPHORE_STATUSES, type Semaphore } from '../../../common/db/columns.js';

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

export class CheckHistoryQueryDto extends CheckTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}

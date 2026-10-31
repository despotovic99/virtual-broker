import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';

export class ListAuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  /** Entitet i sve što mu pripada (npr. projekat sa stanovima, kupovina sa ratama). */
  @IsOptional()
  @IsUUID()
  relatedTo?: string;
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Najveća strana koju server vraća (klijent nudi 20, 50 ili 100 redova). */
export const MAX_PAGE_SIZE = 100;

/**
 * Zajednički parametri liste: `limit` (redova po strani) i `offset` (od kog
 * reda). Query DTO liste ga nasleđuje i dodaje svoje filtere.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

/** Jedna strana liste. `total` je ukupan broj redova za iste filtere. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function toPage<T>(items: T[], total: number, query: Pick<PaginationQueryDto, 'limit' | 'offset'>): Page<T> {
  return { items, total, limit: query.limit, offset: query.offset };
}

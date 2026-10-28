import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { ALL_ROLES, Role } from '../../access/role.enum.js';

export class ListUsersQueryDto {
  @IsOptional()
  @IsIn([...ALL_ROLES])
  role?: Role;

  @IsOptional()
  @IsIn([...MARKET_CODES])
  market?: MarketCode;

  /** Pretraga po email-u, imenu ili prezimenu. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

/** Uloge koje se dodeljuju na kupovini (koordinator, inženjer, escrow, analitičar, advokat). */
export const STAFF_ROLES = [Role.Coordinator, Role.Engineer, Role.EscrowAgent, Role.Analyst, Role.Lawyer] as const;

export class StaffQueryDto {
  @IsIn([...STAFF_ROLES])
  role: (typeof STAFF_ROLES)[number];

  @IsIn([...MARKET_CODES])
  market: MarketCode;
}

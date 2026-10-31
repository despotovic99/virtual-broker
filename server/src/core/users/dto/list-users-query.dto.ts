import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { ALL_ROLES, Role } from '../../access/role.enum.js';

export class ListUsersQueryDto extends PaginationQueryDto {
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
}

/** Uloge koje se dodeljuju na kupovini (koordinator, inženjer, escrow, analitičar, advokat). */
export const STAFF_ROLES = [Role.Coordinator, Role.Engineer, Role.EscrowAgent, Role.Analyst, Role.Lawyer] as const;

export class StaffQueryDto {
  @IsIn([...STAFF_ROLES])
  role: (typeof STAFF_ROLES)[number];

  @IsIn([...MARKET_CODES])
  market: MarketCode;
}

/** Pretraga kupaca za otvaranje kupovine bez zahteva (ime, prezime ili email), po stranama. */
export class BuyerSearchQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../../access/role.enum.js';

/** Izmena korisnika iz administracije. Sva polja su opciona; menja se samo ono što je poslato. */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  /** SUPER_ADMIN nije dozvoljena vrednost (ASSIGNABLE_ROLES). Zamenjuje sve uloge. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ASSIGNABLE_ROLES.length)
  @ArrayUnique()
  @IsIn([...ASSIGNABLE_ROLES], { each: true })
  roles?: AssignableRole[];

  /** Zamenjuje sva tržišta korisnika. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKET_CODES.length)
  @ArrayUnique()
  @IsIn([...MARKET_CODES], { each: true })
  markets?: MarketCode[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

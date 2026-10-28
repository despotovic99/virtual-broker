import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../../access/role.enum.js';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(12, 128)
  password: string;

  @IsString()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @Length(1, 100)
  lastName: string;

  /** SUPER_ADMIN nije dozvoljena vrednost (ASSIGNABLE_ROLES). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ASSIGNABLE_ROLES.length)
  @ArrayUnique()
  @IsIn([...ASSIGNABLE_ROLES], { each: true })
  roles: AssignableRole[];

  /** Obavezno za uloge vezane za tržište (MARKET_SCOPED_ROLES). */
  @IsArray()
  @ArrayMaxSize(MARKET_CODES.length)
  @ArrayUnique()
  @IsIn([...MARKET_CODES], { each: true })
  markets: MarketCode[] = [];
}

import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { FINANCING_TYPES, type FinancingType } from '../../users/entities/buyer-profile.entity.js';

/** Upitnik kupca (F-03). */
export class UpdateBuyerProfileDto {
  @IsBoolean()
  isFirstHome: boolean;

  @IsBoolean()
  isEuCitizen: boolean;

  @IsBoolean()
  primaryResidence: boolean;

  @IsIn([...FINANCING_TYPES])
  financing: FinancingType;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @IsInt()
  @Min(1)
  @Max(20)
  householdMembers: number;

  /** Budžet u celim evrima. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  budget?: number;
}

/**
 * Obračun troškova (F-10). Polja koja nisu poslata uzimaju se iz profila
 * kupca, a ako profila nema, iz podrazumevanih vrednosti.
 */
export class CalculateCostsDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;

  /** Cena iz ugovora u celim evrima. RS: sa PDV-om. CY: bez PDV-a. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  area: number;

  @IsOptional()
  @IsBoolean()
  isFirstHome?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  householdMembers?: number;

  @IsOptional()
  @IsBoolean()
  isEuCitizen?: boolean;

  @IsOptional()
  @IsBoolean()
  primaryResidence?: boolean;

  /** Iznos kredita u celim evrima; 0 ako se kupuje gotovinom. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  loanAmount?: number;
}

export class MarketQueryDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;
}

export class PriceEstimateQueryDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;

  @IsString()
  @Length(1, 120)
  city: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  area?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price?: number;
}

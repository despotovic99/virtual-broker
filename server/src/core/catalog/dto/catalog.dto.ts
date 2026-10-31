import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { PROJECT_STATUSES, type ProjectStatus } from '../entities/project.entity.js';
import { UNIT_STATUSES, type UnitStatus } from '../entities/unit.entity.js';

// ---- Investitor ----

export class CreateDeveloperDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;

  @IsString()
  @Length(1, 200)
  name: string;

  /** RS: matični broj (8 cifara). CY: HE broj. */
  @IsString()
  @Length(3, 32)
  @Matches(/^[A-Za-z0-9-]+$/)
  registrationNumber: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9-]+$/)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(300)
  website?: string;
}

export class UpdateDeveloperDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9-]+$/)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(300)
  website?: string;
}

export class ListDevelopersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...MARKET_CODES])
  market?: MarketCode;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// ---- Račun investitora ----

export class CreateBankAccountDto {
  /** IBAN bez razmaka (velika slova i cifre). */
  @IsString()
  @Length(15, 34)
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/)
  iban: string;

  @IsString()
  @Length(1, 120)
  bankName: string;

  @IsString()
  @Length(1, 200)
  holderName: string;
}

export class VerifyBankAccountDto {
  /** Kako je račun proveren (potvrda banke, poziv na poznat broj…). */
  @IsString()
  @Length(3, 500)
  note: string;
}

// ---- Projekat ----

export class CreateProjectDto {
  @IsUUID()
  developerId: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @Length(1, 120)
  city: string;

  @IsString()
  @Length(1, 300)
  address: string;

  /** RS: katastarska opština + broj parcele. CY: sheet/plan/parcel. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  parcelReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedCompletion?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parcelReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expectedCompletion?: string;

  @IsOptional()
  @IsIn([...PROJECT_STATUSES])
  status?: ProjectStatus;
}

export class ListProjectsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...MARKET_CODES])
  market?: MarketCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsUUID()
  developerId?: string;

  /** Najviša cena stana u evrima: projekat ima bar jedan slobodan stan do te cene. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  maxPrice?: number;

  /** Najmanji broj soba: projekat ima bar jedan slobodan stan sa toliko soba. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(20)
  minRooms?: number;
}

// ---- Stan ----

export class CreateUnitDto {
  @IsString()
  @Length(1, 40)
  label: string;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(20)
  rooms?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  area: number;

  /** Cena u celim evrima. RS: sa PDV-om. CY: bez PDV-a. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price: number;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(20)
  rooms?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  area?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price?: number;

  /** Ručno se može vratiti samo na AVAILABLE ili SOLD; rezervaciju radi kupovina. */
  @IsOptional()
  @IsIn([...UNIT_STATUSES])
  status?: UnitStatus;
}

import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { LEGAL_TEAM_ROLES, type LegalTeamRole } from '../entities/legal-team-member.entity.js';

export class CreateLegalTeamDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;

  @IsString()
  @Length(2, 200)
  name: string;

  /** Jezici tima (ISO 639-1, npr. sr, en, ru, he). */
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @Matches(/^[a-z]{2}$/, { each: true })
  languages: string[] = [];

  /** Investitori koje tim zastupa (izjava o nezavisnosti). */
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  conflictDeveloperIds: string[] = [];
}

export class UpdateLegalTeamDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @Matches(/^[a-z]{2}$/, { each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  conflictDeveloperIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpsertTeamMemberDto {
  @IsIn([...LEGAL_TEAM_ROLES])
  teamRole: LegalTeamRole;

  /** Broj upisa u imenik advokata (AKS) ili Cyprus Bar Association. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  licenseNumber?: string;

  /** Admin je proverio upis u registru advokata. */
  @IsOptional()
  @IsBoolean()
  licenseVerified?: boolean;
}

export interface LegalTeamMemberResponseDto {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  teamRole: LegalTeamRole;
  licenseNumber: string | null;
  licenseVerifiedAt: string | null;
}

export interface LegalTeamResponseDto {
  id: string;
  market: MarketCode;
  name: string;
  languages: string[];
  conflictDeveloperIds: string[];
  active: boolean;
  members: LegalTeamMemberResponseDto[];
  createdAt: string;
}

export interface MyLegalTeamDto {
  id: string;
  market: MarketCode;
  name: string;
  languages: string[];
  active: boolean;
  myRole: LegalTeamRole;
}

/** Tim za dodelu na kupovini (bez sukoba interesa), sa advokatima koji mogu da vode predmet. */
export interface AvailableLegalTeamDto {
  id: string;
  name: string;
  languages: string[];
  lawyers: { userId: string; firstName: string; lastName: string; teamRole: 'LEAD' | 'LAWYER' | 'ASSOCIATE' }[];
}

export class AvailableLegalTeamsQueryDto {
  @IsIn([...MARKET_CODES])
  market: MarketCode;

  @IsOptional()
  @IsUUID()
  developerId?: string;
}

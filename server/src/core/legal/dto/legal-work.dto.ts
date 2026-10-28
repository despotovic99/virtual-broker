import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { OPINION_CONCLUSIONS, type OpinionConclusion } from '../entities/legal-opinion.entity.js';
import { POA_SCOPES } from '../entities/power-of-attorney.entity.js';

export class CreatePowerOfAttorneyDto {
  /** Već otpremljen dokument tipa POWER_OF_ATTORNEY na ovoj kupovini. */
  @IsUUID()
  documentId: string;

  /** Dozvoljene radnje. Nikad opterećenje, prodaja, prijem novca ni promena računa (F-13 P9). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(POA_SCOPES.length)
  @ArrayUnique()
  @IsIn([...POA_SCOPES], { each: true })
  scope: (typeof POA_SCOPES)[number][];

  @IsOptional()
  @IsDateString({ strict: true })
  validUntil?: string;
}

export class CreateLegalOpinionDto {
  @IsIn([...OPINION_CONCLUSIONS])
  conclusion: OpinionConclusion;

  @IsString()
  @Length(10, 10_000)
  reasoning: string;

  @IsOptional()
  @IsString()
  @Length(1, 5_000)
  conditions?: string;

  /** Potpisan PDF mišljenja (dokument tipa LEGAL_OPINION na ovoj kupovini). */
  @IsUUID()
  documentId: string;
}

export interface PowerOfAttorneyDto {
  id: string;
  purchaseId: string;
  documentId: string;
  scope: string[];
  validUntil: string | null;
  revokedAt: string | null;
  createdById: string;
  createdAt: string;
  /** Važi: nije opozvano i rok nije prošao. */
  valid: boolean;
}

export interface LegalOpinionDto {
  id: string;
  purchaseId: string;
  conclusion: OpinionConclusion;
  reasoning: string;
  conditions: string | null;
  documentId: string | null;
  authorId: string;
  createdAt: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class InstallmentInputDto {
  @IsString()
  @Length(1, 200)
  label: string;

  /** Iznos u celim evrima. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  /** Faza gradnje iz paketa tržišta posle koje se rata plaća. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/)
  phaseCode?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}

/** Ceo plan uplata; zamenjuje postojeći dok nijedna rata nije plaćena. */
export class ReplacePaymentPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => InstallmentInputDto)
  installments: InstallmentInputDto[];
}

export class ConfirmConditionDto {
  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RecordPaymentDto {
  /** Dokaz o uplati (dokument kupovine). Obavezan ako ga kupac već nije priložio. */
  @IsOptional()
  @IsUUID()
  proofDocumentId?: string;
}

export class ReturnInstructionDto {
  @IsString()
  @Length(3, 500)
  reason: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { REPORT_VERDICTS, type ReportVerdict } from '../entities/engineer-report.entity.js';

const PHASE_CODE = /^[A-Z0-9_]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PhasePlanItemDto {
  @IsString()
  @MaxLength(64)
  @Matches(PHASE_CODE)
  phaseCode: string;

  /** Planirani datum završetka faze; null briše plan. */
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601({ strict: true })
  @Matches(DATE)
  plannedDate: string | null;
}

export class UpdateConstructionPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PhasePlanItemDto)
  phases: PhasePlanItemDto[];
}

export class CreateEngineerReportDto {
  /** Obavezno kada izveštaj potvrđuje ili odbija fazu. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(PHASE_CODE)
  phaseCode?: string;

  @IsISO8601({ strict: true })
  @Matches(DATE)
  visitDate: string;

  @IsString()
  @Length(10, 5000)
  summary: string;

  @IsIn([...REPORT_VERDICTS])
  verdict: ReportVerdict;
}

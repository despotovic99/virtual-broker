import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { DEFECT_SEVERITIES, type DefectSeverity } from '../entities/defect.entity.js';

export class RecordHandoverDto {
  @IsISO8601({ strict: true })
  inspectedAt: string;

  /** Površina iz ugovora u m². */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  contractArea: number;

  /** Izmerena površina u m². */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000)
  measuredArea: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class CreateDefectDto {
  @IsString()
  @Length(3, 1000)
  description: string;

  @IsIn([...DEFECT_SEVERITIES])
  severity: DefectSeverity;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}

export class UpdateDefectDto {
  /** FIXED: investitor otklonio (beleži koordinator). CONFIRMED: kupac ili inženjer potvrdio. */
  @IsIn(['FIXED', 'CONFIRMED'])
  status: 'FIXED' | 'CONFIRMED';
}

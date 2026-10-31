import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { PURCHASE_STATUSES, type PurchaseStatus } from '../entities/purchase.entity.js';
import { TASK_STATUSES, type TaskStatus } from '../entities/purchase-task.entity.js';

export class CreatePurchaseDto {
  /** Zahtev „vodi moju kupovinu” iz koga nastaje kupovina (F-35). */
  @IsOptional()
  @IsUUID()
  requestId?: string;

  /** Obavezno ako nema zahteva. Ako ima zahteva, kupac je iz zahteva. */
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  /** Obavezno ako nema zahteva ili zahtev nije povezan sa stanom. Ako ima zahteva, podrazumevano je stan iz zahteva. */
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class ListPurchasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...PURCHASE_STATUSES])
  status?: PurchaseStatus;

  @IsOptional()
  @IsIn([...MARKET_CODES])
  market?: MarketCode;
}

/**
 * Dodele na kupovini. Polje koje nije poslato se ne menja; `null` uklanja dodelu.
 */
export class UpdateAssignmentsDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  legalTeamId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  lawyerId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  engineerId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  escrowAgentId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  coordinatorId?: string | null;
}

export class StepCompleteDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class StepSkipDto {
  /** Razlog je obavezan za preskakanje opcionog koraka. */
  @IsString()
  @Length(3, 500)
  reason: string;
}

/** Parametri rute za korak: id kupovine i kod koraka iz paketa tržišta (npr. S7, K9). */
export class StepParamsDto {
  @IsUUID()
  id: string;

  @Matches(/^[A-Z]{1,3}[0-9]{1,3}$/)
  code: string;
}

export class BlockPurchaseDto {
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class CreateTaskDto {
  /** Vrsta zadatka, npr. LEGAL_REVIEW, CONTRACT_REVIEW, SITE_VISIT. */
  @Matches(/^[A-Z][A-Z_]{1,63}$/)
  type: string;

  @IsString()
  @Length(1, 300)
  title: string;

  @IsUUID()
  assigneeUserId: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueAt?: string;
}

export class UpdateTaskDto {
  @IsIn([...TASK_STATUSES])
  status: TaskStatus;

  /** Obavezno kada je status WAITING. */
  @IsOptional()
  @IsString()
  @Length(3, 300)
  waitingReason?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10_000)
  result?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class CreateMessageDto {
  @IsString()
  @Length(1, 4_000)
  body: string;

  /** Interna poruka: kupac je ne vidi. Kupac ne može da je pošalje. */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

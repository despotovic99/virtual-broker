import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.js';
import { MARKET_CODES, type MarketCode } from '../../../markets/market-code.js';
import { ANSWER_SCOPES, REQUEST_KINDS, REQUEST_STATUSES, type AnswerScope, type RequestKind, type RequestStatus } from '../entities/buyer-request.entity.js';

export class CreateRequestDto {
  @IsIn([...REQUEST_KINDS])
  kind: RequestKind;

  @IsIn([...MARKET_CODES])
  market: MarketCode;

  /** Link oglasa sa portala. Samo https. */
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  listingUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  developerName?: string;

  /** RS: matični broj. CY: HE broj. */
  @IsOptional()
  @IsString()
  @Length(3, 32)
  @Matches(/^[A-Za-z0-9-]+$/)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  parcelReference?: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  question?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class RequestQueueQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...REQUEST_STATUSES])
  status?: RequestStatus;

  @IsOptional()
  @IsIn([...MARKET_CODES])
  market?: MarketCode;
}

export class LinkRequestDto {
  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class AnswerRequestDto {
  @IsString()
  @Length(1, 5000)
  answer: string;
}

export class LegalAnswerRequestDto extends AnswerRequestDto {
  /** INFORMATION: opšta informacija. ENGAGED_ADVICE: savet u okviru angažovanja (F-35, P6). */
  @IsIn([...ANSWER_SCOPES])
  answerScope: AnswerScope;
}

export class ForwardRequestDto {
  @IsUUID()
  legalTeamId: string;
}

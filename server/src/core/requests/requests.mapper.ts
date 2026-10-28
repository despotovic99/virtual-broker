import type { MarketCode } from '../../markets/market-code.js';
import type { Localized } from '../../markets/market-pack.js';
import { SEMAPHORE_DISCLAIMER } from '../checks/checks.service.js';
import type { AnswerScope, BuyerRequest, FreeSemaphoreSnapshot, RequestKind, RequestStatus } from './entities/buyer-request.entity.js';

export interface RequestResponse {
  id: string;
  market: MarketCode;
  kind: RequestKind;
  status: RequestStatus;
  listingUrl: string | null;
  developerName: string | null;
  registrationNumber: string | null;
  parcelReference: string | null;
  address: string | null;
  question: string | null;
  developerId: string | null;
  projectId: string | null;
  unitId: string | null;
  answer: string | null;
  answerScope: AnswerScope | null;
  answeredAt: string | null;
  purchaseId: string | null;
  freeSemaphore: (FreeSemaphoreSnapshot & { disclaimer: Localized }) | null;
  firstResponseDueAt: string;
  createdAt: string;
  updatedAt: string;
  /** Samo za tim: ko vodi zahtev i kom pravnom timu je prosleđen. */
  ownerUserId?: string | null;
  legalTeamId?: string | null;
  buyerId?: string;
  answeredById?: string | null;
}

export function toRequestResponse(request: BuyerRequest, forStaff: boolean): RequestResponse {
  const response: RequestResponse = {
    id: request.id,
    market: request.market,
    kind: request.kind,
    status: request.status,
    listingUrl: request.listingUrl,
    developerName: request.developerName,
    registrationNumber: request.registrationNumber,
    parcelReference: request.parcelReference,
    address: request.address,
    question: request.question,
    developerId: request.developerId,
    projectId: request.projectId,
    unitId: request.unitId,
    answer: request.answer,
    answerScope: request.answerScope,
    answeredAt: request.answeredAt ? request.answeredAt.toISOString() : null,
    purchaseId: request.purchaseId,
    freeSemaphore: request.freeSemaphore ? { ...request.freeSemaphore, disclaimer: SEMAPHORE_DISCLAIMER } : null,
    firstResponseDueAt: request.firstResponseDueAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
  if (forStaff) {
    response.ownerUserId = request.ownerUserId;
    response.legalTeamId = request.legalTeamId;
    response.buyerId = request.buyerId;
    response.answeredById = request.answeredById;
  }
  return response;
}

import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import type { BuyerRequest } from './entities/buyer-request.entity.js';
import { RequestsRepository } from './requests.repository.js';

/**
 * Zahtevi kupca (F-35). Ovde su metodi koji učestvuju u tuđoj transakciji
 * (pretvaranje zahteva u kupovinu). Endpoint-e dodaje RequestsAppService.
 */
@Injectable()
export class RequestsService {
  constructor(private readonly requests: RequestsRepository) {}

  /** Zahtev za pretvaranje u kupovinu, zaključan do kraja transakcije. */
  async getForConversion(manager: EntityManager, requestId: string): Promise<BuyerRequest> {
    const request = await this.requests.findByIdForUpdate(manager, requestId);
    if (!request) throw new ApiError(ApiErrorCode.NotFound);
    if (request.status === 'CONVERTED' || request.status === 'CLOSED') throw new ApiError(ApiErrorCode.InvalidStateTransition);
    return request;
  }

  markConverted(manager: EntityManager, requestId: string, purchaseId: string): Promise<void> {
    return this.requests.markConverted(manager, requestId, purchaseId);
  }
}

import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ApiErrorCode } from './api-error-code.js';
import { ApiError } from './api-error.js';

const logger = new Logger('BodyParserErrorHandler');

/**
 * Express error handler za greške iz middleware-a pre Nest ruta (body parser,
 * cookie parser). Bez njega bi Express vratio svoju poruku greške.
 * Registruje se u main.ts posle tih middleware-a.
 */
export function bodyParserErrorHandler(error: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
  let apiError: ApiError;
  if (type === 'entity.too.large') {
    apiError = new ApiError(ApiErrorCode.PayloadTooLarge);
  } else if (typeof type === 'string' && (type.startsWith('entity.') || type.endsWith('.unsupported'))) {
    apiError = new ApiError(ApiErrorCode.InvalidRequest);
  } else {
    logger.error('Neočekivana greška u middleware-u.', error instanceof Error ? error.stack : String(error));
    apiError = new ApiError(ApiErrorCode.InternalError);
  }

  response.status(apiError.getStatus()).json(apiError.toBody());
}

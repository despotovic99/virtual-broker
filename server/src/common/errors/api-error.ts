import { HttpException } from '@nestjs/common';
import { API_ERRORS, ApiErrorCode } from './api-error-code.js';

/** Dodatni podaci za klijenta. Samo bezbedne vrednosti (npr. nazivi polja), nikad interni detalji. */
export type ApiErrorDetails = Readonly<Record<string, string | number | boolean | readonly string[] | Readonly<Record<string, string>>>>;

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetails;
}

/**
 * Jedina vrsta greške koja sme da izađe van API-ja. Status i poruka dolaze
 * iz kataloga (API_ERRORS). Originalna greška se čuva u `cause` i ide samo u log.
 */
export class ApiError extends HttpException {
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetails;

  constructor(code: ApiErrorCode, details?: ApiErrorDetails, options?: { cause?: unknown }) {
    const definition = API_ERRORS[code];
    super(definition.message, definition.status, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { statusCode: this.getStatus(), code: this.code, message: this.message };
    if (this.details) body.details = this.details;
    return body;
  }
}

import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorCode } from './api-error-code.js';
import { ApiError } from './api-error.js';

/**
 * Poslednja linija odbrane: van API-ja izlazi samo ApiError.
 * - ApiError ide klijentu kakva jeste.
 * - HttpException iz samog framework-a (npr. nepostojeća ruta) postaje
 *   generička greška po statusu, bez originalne poruke.
 * - Sve ostalo je INTERNAL_ERROR; detalji idu samo u log.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = this.toApiError(exception);

    if (error.getStatus() >= 500) {
      const original = error.cause ?? exception;
      this.logger.error(
        `${error.code}: neočekivana greška.`,
        original instanceof Error ? original.stack : String(original),
      );
    }

    response.status(error.getStatus()).json(error.toBody());
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ApiError) return exception;
    if (exception instanceof HttpException) {
      return new ApiError(this.codeForStatus(exception.getStatus()), undefined, { cause: exception });
    }
    return new ApiError(ApiErrorCode.InternalError, undefined, { cause: exception });
  }

  private codeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.Unauthenticated;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.Forbidden;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NotFound;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ApiErrorCode.PayloadTooLarge;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.TooManyRequests;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ApiErrorCode.ServiceUnavailable;
      default:
        return status >= 400 && status < 500 ? ApiErrorCode.InvalidRequest : ApiErrorCode.InternalError;
    }
  }
}

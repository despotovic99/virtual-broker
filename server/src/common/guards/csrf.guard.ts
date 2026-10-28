import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ApiErrorCode } from '../errors/api-error-code.js';
import { ApiError } from '../errors/api-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF zaštita za sve metode koje menjaju stanje: obavezan header
 * X-Requested-With i Origin sa liste dozvoljenih. Bitno je za rute koje
 * koriste refresh cookie (/api/auth/refresh, /api/auth/logout).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService) {
    this.allowedOrigins = new Set(config.getOrThrow<string[]>('corsOrigins'));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.get('origin');
    if (request.get('x-requested-with') !== 'XMLHttpRequest' || !origin || !this.allowedOrigins.has(origin)) {
      throw new ApiError(ApiErrorCode.Forbidden);
    }
    return true;
  }
}

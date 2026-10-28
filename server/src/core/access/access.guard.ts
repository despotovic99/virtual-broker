import { Injectable, Logger, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { getAccessRule } from './access.decorators.js';
import { AccessTokenService } from './access-token.service.js';
import type { AuthenticatedRequest } from './auth-user.js';

/** Globalni guard: proverava access token i capability za svaki endpoint. */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = getAccessRule(this.reflector, context.getHandler(), context.getClass());
    if (!rule) {
      // Deny by default: ruta bez oznake pristupa nikad ne prolazi.
      this.logger.error(`Ruta ${context.getClass().name}.${context.getHandler().name} nema oznaku pristupa.`);
      throw new ApiError(ApiErrorCode.Forbidden);
    }
    if (rule.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.accessTokens.verify(this.bearerToken(request));
    request.authUser = user;

    if (rule.kind === 'authenticated') return true;
    if (!rule.capabilities.every((capability) => user.capabilities.has(capability))) {
      throw new ApiError(ApiErrorCode.Forbidden);
    }
    return true;
  }

  private bearerToken(request: AuthenticatedRequest): string {
    const header = request.get('authorization');
    const match = header ? /^Bearer ([A-Za-z0-9._-]+)$/.exec(header) : null;
    if (!match) throw new ApiError(ApiErrorCode.Unauthenticated);
    return match[1];
  }
}

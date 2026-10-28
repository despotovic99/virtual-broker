import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthConfig } from '../../config/configuration.js';

const COOKIE_NAME = 'vb_refresh';

/**
 * Refresh token cookie: HttpOnly (JavaScript ga ne vidi), SameSite=Strict,
 * Secure u produkciji, i šalje se samo na /api/auth rute.
 */
@Injectable()
export class RefreshCookie {
  private readonly options: CookieOptions;

  constructor(config: ConfigService) {
    const auth = config.getOrThrow<AuthConfig>('auth');
    this.options = { httpOnly: true, sameSite: 'strict', secure: auth.cookieSecure, path: '/api/auth' };
  }

  read(request: Request): unknown {
    const cookies: unknown = request.cookies;
    return typeof cookies === 'object' && cookies !== null ? (cookies as Record<string, unknown>)[COOKIE_NAME] : undefined;
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(COOKIE_NAME, token, { ...this.options, expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(COOKIE_NAME, this.options);
  }
}

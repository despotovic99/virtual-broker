import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { Authenticated, Public } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { AuthService, type ClientMeta } from './auth.service.js';
import type { AuthResponseDto, MeResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto, type RegisterResponseDto } from './dto/register.dto.js';
import { RefreshCookie } from './refresh-cookie.js';
import { RegistrationService } from './registration.service.js';

function clientMeta(request: Request): ClientMeta {
  return {
    ip: request.ip ? request.ip.slice(0, 45) : null,
    userAgent: request.get('user-agent')?.slice(0, 255) ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly registration: RegistrationService,
    private readonly refreshCookie: RefreshCookie,
  ) {}

  /** Samostalna registracija kupca. Odgovor je uvek isti (bez enumeracije naloga). */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  register(@Body() dto: RegisterDto, @Req() request: Request): Promise<RegisterResponseDto> {
    return this.registration.register(dto, clientMeta(request));
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.login(dto, clientMeta(request));
    this.refreshCookie.set(response, session.refreshToken, session.refreshExpiresAt);
    return session.response;
  }

  /** Javno, jer access token je možda već istekao; identitet dolazi iz refresh cookie-ja. */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    try {
      const session = await this.auth.refresh(this.refreshCookie.read(request), clientMeta(request));
      this.refreshCookie.set(response, session.refreshToken, session.refreshExpiresAt);
      return session.response;
    } catch (error) {
      // Neuspešan refresh: brišemo cookie, da browser ne šalje nevažeći token.
      if (error instanceof ApiError && error.getStatus() === HttpStatus.UNAUTHORIZED) this.refreshCookie.clear(response);
      throwApiError(error);
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(this.refreshCookie.read(request));
    this.refreshCookie.clear(response);
  }

  @Get('me')
  @Authenticated()
  me(@CurrentUser() user: AuthUser): Promise<MeResponseDto> {
    return this.auth.me(user.id);
  }
}

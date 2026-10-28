import { Module } from '@nestjs/common';
import { UsersAdminController } from '../users/users-admin.controller.js';
import { UsersAdminService } from '../users/users-admin.service.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RateLimiterService } from './rate-limiter.service.js';
import { RefreshCookie } from './refresh-cookie.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';
import { RegistrationService } from './registration.service.js';
import { SessionsService } from './sessions.service.js';

/**
 * Prijava, registracija kupca i sesije. Ovde je i izmena korisnika
 * (UsersAdminController), jer poništava sesije; tako UsersModule ne zavisi
 * od AuthModule (nema ciklusa).
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController, UsersAdminController],
  providers: [
    AuthService,
    RegistrationService,
    SessionsService,
    UsersAdminService,
    RefreshTokensRepository,
    RateLimiterService,
    RefreshCookie,
  ],
  exports: [SessionsService, RateLimiterService],
})
export class AuthModule {}

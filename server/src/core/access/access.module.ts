import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthConfig } from '../../config/configuration.js';
import { AccessAuditService } from './access-audit.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AccessGuard } from './access.guard.js';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.getOrThrow<AuthConfig>('auth');
        return {
          secret: auth.jwtAccessSecret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: auth.jwtAccessTtlSeconds,
            issuer: auth.jwtIssuer,
            audience: auth.jwtAudience,
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: auth.jwtIssuer,
            audience: auth.jwtAudience,
          },
        };
      },
    }),
  ],
  providers: [
    AccessTokenService,
    AccessAuditService,
    // Redosled je bitan: prvo CSRF, pa prava pristupa.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AccessTokenService],
})
export class AccessModule {}

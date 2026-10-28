import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth-user.js';

/** Prijavljeni korisnik. Radi samo na rutama sa @Authenticated ili @RequireCapabilities. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // Greška u kodu (ne u zahtevu): klijent dobija generičku grešku, a poruka ide u log.
  if (!request.authUser) throw new Error('CurrentUser je upotrebljen na ruti bez prijave.');
  return request.authUser;
});

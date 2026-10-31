import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from './auth-user.js';
import { Role } from './role.enum.js';

/** Da li korisnik sme da radi na datom tržištu (uloge vezane za tržište, F-34 P5). */
export function hasMarketAccess(actor: AuthUser, market: MarketCode): boolean {
  return actor.markets.includes(market);
}

/** Baca FORBIDDEN ako korisnik nema pristup tržištu. */
export function assertMarketAccess(actor: AuthUser, market: MarketCode): void {
  if (!hasMarketAccess(actor, market)) throw new ApiError(ApiErrorCode.Forbidden);
}

export function hasRole(actor: AuthUser, ...roles: Role[]): boolean {
  return roles.some((role) => actor.roles.includes(role));
}

/** Naš tim (analitičar, koordinator, admin) na datom tržištu. */
export function isInternalOnMarket(actor: AuthUser, market: MarketCode): boolean {
  return hasRole(actor, Role.Admin, Role.Analyst, Role.Coordinator) && hasMarketAccess(actor, market);
}

/** Admin na datom tržištu: prolazi sve provere uloge i veze (osim pravila četiri oka). */
export function isAdminOnMarket(actor: AuthUser, market: MarketCode): boolean {
  return hasRole(actor, Role.Admin) && hasMarketAccess(actor, market);
}

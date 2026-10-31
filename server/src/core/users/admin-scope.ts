import { MARKET_CODES, type MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { Role } from '../access/role.enum.js';

/** Tržišta na kojima akter administrira. SUPER_ADMIN administrira sva tržišta. */
export function administeredMarkets(actor: AuthUser): readonly MarketCode[] {
  return actor.roles.includes(Role.SuperAdmin) ? MARKET_CODES : actor.markets;
}

export function isSuperAdmin(actor: AuthUser): boolean {
  return actor.roles.includes(Role.SuperAdmin);
}

/** Admin vidi korisnike sa bar jednim svojim tržištem i korisnike bez tržišta; super admin sve. */
export function canSeeUser(actor: AuthUser, userMarkets: readonly MarketCode[]): boolean {
  if (isSuperAdmin(actor)) return true;
  return userMarkets.length === 0 || userMarkets.some((market) => actor.markets.includes(market));
}

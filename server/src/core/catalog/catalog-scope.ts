import type { MarketCode } from '../../markets/market-code.js';
import type { AuthUser } from '../access/auth-user.js';
import { hasMarketAccess, hasRole } from '../access/market-access.js';
import { Role } from '../access/role.enum.js';

/** Uloge koje na svom tržištu vide ceo katalog, i neobjavljene projekte. */
const STAFF_ROLES = [Role.Admin, Role.Analyst, Role.Coordinator, Role.Lawyer, Role.Engineer] as const;

/** Tržišta na kojima korisnik vidi ceo katalog. Kupac i super admin: nijedno (vide samo objavljeno). */
export function catalogStaffMarkets(actor: AuthUser): MarketCode[] {
  return hasRole(actor, ...STAFF_ROLES) ? [...actor.markets] : [];
}

export function isCatalogStaffOn(actor: AuthUser, market: MarketCode): boolean {
  return hasRole(actor, ...STAFF_ROLES) && hasMarketAccess(actor, market);
}

/** Naš tim (analitičar, koordinator, admin) vidi ceo IBAN; ostali samo poslednje cifre. */
export function canSeeFullIban(actor: AuthUser, market: MarketCode): boolean {
  return hasRole(actor, Role.Admin, Role.Analyst, Role.Coordinator) && hasMarketAccess(actor, market);
}

import type { Request } from 'express';
import type { MarketCode } from '../../markets/market-code.js';
import type { Capability } from './capability.enum.js';
import type { Role } from './role.enum.js';

/** Prijavljeni korisnik, izveden iz proverenog access tokena. */
export interface AuthUser {
  id: string;
  roles: readonly Role[];
  /** Tržišta na kojima korisnik sa ulogom vezanom za tržište sme da radi (F-34). */
  markets: readonly MarketCode[];
  capabilities: ReadonlySet<Capability>;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

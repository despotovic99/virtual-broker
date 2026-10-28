import { SetMetadata } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Capability } from './capability.enum.js';

export const ACCESS_RULE = 'vb:access-rule';

export type AccessRule =
  | { kind: 'public' }
  | { kind: 'authenticated' }
  | { kind: 'capabilities'; capabilities: readonly Capability[] };

/**
 * Svaki endpoint mora imati tačno jednu od ove tri oznake. Endpoint bez
 * oznake se odbija (403), a API ne krene dok sve rute nisu označene
 * (AccessAuditService). Oznaka na metodi ima prednost nad oznakom na klasi.
 */

/** Dostupno bez prijave. */
export const Public = () => SetMetadata(ACCESS_RULE, { kind: 'public' } satisfies AccessRule);

/** Dostupno svakom prijavljenom korisniku, bez posebne capability. */
export const Authenticated = () => SetMetadata(ACCESS_RULE, { kind: 'authenticated' } satisfies AccessRule);

/** Prijavljeni korisnik mora imati sve navedene capability. */
export const RequireCapabilities = (...capabilities: [Capability, ...Capability[]]) =>
  SetMetadata(ACCESS_RULE, { kind: 'capabilities', capabilities } satisfies AccessRule);

/** Handler ili klasa kontrolera, kako ih Reflector prima. */
export type AccessTarget = Parameters<Reflector['getAllAndOverride']>[1][number];

export function getAccessRule(reflector: Reflector, handler: AccessTarget, controller: AccessTarget): AccessRule | undefined {
  return reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_RULE, [handler, controller]);
}

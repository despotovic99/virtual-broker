import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Podaci o HTTP zahtevu koji važe tokom cele obrade (npr. IP za audit). */
export interface RequestContext {
  ip: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Express middleware: svaki zahtev dobija svoj kontekst. IP dolazi iz
 * `request.ip`, koji poštuje podešavanje `trust proxy` (TRUST_PROXY).
 */
export function requestContextMiddleware(request: Request, _response: Response, next: NextFunction): void {
  const ip = request.ip ? request.ip.replace(/^::ffff:/, '').slice(0, 45) : null;
  storage.run({ ip }, next);
}

/** Kontekst tekućeg zahteva; null van HTTP zahteva (npr. pozadinski posao). */
export function currentRequest(): RequestContext | null {
  return storage.getStore() ?? null;
}

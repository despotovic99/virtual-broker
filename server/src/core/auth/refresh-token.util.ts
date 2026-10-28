import { createHash, randomBytes } from 'node:crypto';

/** Nasumičan refresh token od 256 bita. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** U bazi se čuva samo SHA-256 heš tokena. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Odbacuje vrednosti cookie-ja koje nisu u formatu tokena, pre upita u bazu. */
export function isWellFormedRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

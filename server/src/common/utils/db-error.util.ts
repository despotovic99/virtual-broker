import { QueryFailedError } from 'typeorm';

/** Postgres greška 23505: narušeno UNIQUE ograničenje. */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return typeof driverError === 'object' && driverError !== null && 'code' in driverError && driverError.code === '23505';
}

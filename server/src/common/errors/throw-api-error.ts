import { ApiErrorCode } from './api-error-code.js';
import { ApiError, type ApiErrorDetails } from './api-error.js';

/** Greška koju očekujemo u nekoj operaciji i poslovna greška u koju se prevodi. */
export interface ExpectedError {
  matches: (error: unknown) => boolean;
  code: ApiErrorCode;
  details?: ApiErrorDetails;
}

/**
 * Opis očekivane greške, na primer:
 * `expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)`.
 */
export function expectError(
  matches: (error: unknown) => boolean,
  code: ApiErrorCode,
  details?: ApiErrorDetails,
): ExpectedError {
  return { matches, code, details };
}

/**
 * Jedino mesto gde se greška iz rada pretvara u grešku za klijenta.
 *
 * - ApiError (već poslovna greška) prolazi nepromenjena.
 * - Greška koja odgovara nekoj od očekivanih postaje odgovarajuća poslovna greška.
 * - Sve ostalo je neočekivano: klijent dobija generičku grešku (INTERNAL_ERROR),
 *   a original ostaje u `cause` i filter ga upisuje u log.
 *
 * Koristi se u `catch` bloku metoda koji započinje operaciju (posle rollback-a):
 *
 * ```ts
 * } catch (error) {
 *   if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
 *   throwApiError(error, [expectError(isUniqueViolation, ApiErrorCode.UserEmailTaken)]);
 * }
 * ```
 */
export function throwApiError(error: unknown, expected: readonly ExpectedError[] = []): never {
  if (error instanceof ApiError) throw error;
  for (const candidate of expected) {
    if (candidate.matches(error)) throw new ApiError(candidate.code, candidate.details, { cause: error });
  }
  throw new ApiError(ApiErrorCode.InternalError, undefined, { cause: error });
}

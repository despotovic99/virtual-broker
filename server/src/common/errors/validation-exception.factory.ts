import type { ValidationError } from 'class-validator';
import { ApiErrorCode } from './api-error-code.js';
import { ApiError } from './api-error.js';

const MAX_FIELDS = 20;
const MAX_FIELD_LENGTH = 64;

function collectFields(errors: readonly ValidationError[], parent: string, into: Set<string>): void {
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) into.add(path.slice(0, MAX_FIELD_LENGTH));
    if (error.children?.length) collectFields(error.children, path, into);
  }
}

/**
 * Greška validacije za ValidationPipe. Klijent dobija samo nazive polja koja
 * nisu prošla, bez tekstova class-validator-a i bez poslatih vrednosti.
 */
export function validationExceptionFactory(errors: ValidationError[]): ApiError {
  const fields = new Set<string>();
  collectFields(errors, '', fields);
  return new ApiError(ApiErrorCode.ValidationFailed, { fields: [...fields].slice(0, MAX_FIELDS) });
}

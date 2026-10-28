import { Injectable, type PipeTransform } from '@nestjs/common';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';

/** Kod uslova iz URL-a: samo velika slova, cifre i donja crta (npr. RS_PRE_REGISTRATION). */
@Injectable()
export class ParseConditionCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(value)) {
      throw new ApiError(ApiErrorCode.ValidationFailed, { fields: ['code'] });
    }
    return value;
  }
}

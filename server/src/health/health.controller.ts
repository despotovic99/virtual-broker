import { Controller, Get } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error-code.js';
import { ApiError } from '../common/errors/api-error.js';
import { Public } from '../core/access/access.decorators.js';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  async get(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') throw new ApiError(ApiErrorCode.ServiceUnavailable, { checks: report.checks });
    return report;
  }
}

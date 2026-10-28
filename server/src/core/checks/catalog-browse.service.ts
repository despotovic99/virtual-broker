import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import type { Localized } from '../../markets/market-pack.js';
import type { AuthUser } from '../access/auth-user.js';
import { toProjectResponse, toUnitResponse, type ProjectResponse, type UnitResponse } from '../catalog/catalog.mapper.js';
import { isCatalogStaffOn } from '../catalog/catalog-scope.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ChecksService, SEMAPHORE_DISCLAIMER, type ProjectSemaphore } from './checks.service.js';

export interface ProjectDetailResponse {
  project: ProjectResponse;
  developer: { id: string; name: string; registrationNumber: string };
  units: UnitResponse[];
  semaphore: ProjectSemaphore & { disclaimer: Localized };
}

/**
 * Detalj projekta za kupca i tim (F-04): projekat, investitor, stanovi i
 * semafor. Ovde je (a ne u CatalogModule) jer koristi provere.
 */
@Injectable()
export class CatalogBrowseService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly checks: ChecksService,
  ) {}

  async projectDetail(actor: AuthUser, projectId: string): Promise<ProjectDetailResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const project = await this.catalog.getProject(queryRunner.manager, projectId);
      const staff = isCatalogStaffOn(actor, project.market);
      // Neobjavljen projekat vidi samo tim na tržištu; ostalima NOT_FOUND.
      if (project.status !== 'PUBLISHED' && !staff) throw new ApiError(ApiErrorCode.NotFound);
      const developer = await this.catalog.getDeveloper(queryRunner.manager, project.developerId);
      const units = await this.catalog.listUnits(queryRunner.manager, project.id);
      const semaphore = await this.checks.projectSemaphore(queryRunner.manager, project, developer);
      return {
        project: toProjectResponse(project, developer.name),
        developer: { id: developer.id, name: developer.name, registrationNumber: developer.registrationNumber },
        units: units.map(toUnitResponse),
        semaphore: { ...semaphore, disclaimer: SEMAPHORE_DISCLAIMER },
      };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }
}

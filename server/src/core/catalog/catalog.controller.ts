import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { CatalogAdminService, type DeveloperListResponse, type ProjectListResponse } from './catalog-admin.service.js';
import type { BankAccountResponse, DeveloperResponse, ProjectResponse, UnitResponse } from './catalog.mapper.js';
import {
  CreateBankAccountDto,
  CreateDeveloperDto,
  CreateProjectDto,
  CreateUnitDto,
  ListDevelopersQueryDto,
  ListProjectsQueryDto,
  UpdateDeveloperDto,
  UpdateProjectDto,
  UpdateUnitDto,
  VerifyBankAccountDto,
} from './dto/catalog.dto.js';

/**
 * Katalog (F-04, F-32). Detalj projekta sa stanovima i semaforom je u
 * ChecksModule (GET /catalog/projects/:id), jer koristi provere.
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogAdminService) {}

  // ---- Investitori ----

  @Get('developers')
  @RequireCapabilities(Capability.CatalogRead)
  listDevelopers(@CurrentUser() actor: AuthUser, @Query() query: ListDevelopersQueryDto): Promise<DeveloperListResponse> {
    return this.catalog.listDevelopers(actor, query);
  }

  @Get('developers/:id')
  @RequireCapabilities(Capability.CatalogRead)
  getDeveloper(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DeveloperResponse> {
    return this.catalog.getDeveloper(actor, id);
  }

  @Post('developers')
  @RequireCapabilities(Capability.CatalogManage)
  createDeveloper(@CurrentUser() actor: AuthUser, @Body() dto: CreateDeveloperDto): Promise<DeveloperResponse> {
    return this.catalog.createDeveloper(actor, dto);
  }

  @Patch('developers/:id')
  @RequireCapabilities(Capability.CatalogManage)
  updateDeveloper(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeveloperDto,
  ): Promise<DeveloperResponse> {
    return this.catalog.updateDeveloper(actor, id, dto);
  }

  // ---- Računi investitora ----

  @Get('developers/:id/bank-accounts')
  @RequireCapabilities(Capability.CatalogRead)
  listBankAccounts(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BankAccountResponse[]> {
    return this.catalog.listBankAccounts(actor, id);
  }

  @Post('developers/:id/bank-accounts')
  @RequireCapabilities(Capability.CatalogManage)
  addBankAccount(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBankAccountDto,
  ): Promise<BankAccountResponse> {
    return this.catalog.addBankAccount(actor, id, dto);
  }

  @Post('bank-accounts/:id/verify')
  @RequireCapabilities(Capability.BankAccountsVerify)
  verifyBankAccount(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyBankAccountDto,
  ): Promise<BankAccountResponse> {
    return this.catalog.verifyBankAccount(actor, id, dto);
  }

  // ---- Projekti ----

  @Get('projects')
  @RequireCapabilities(Capability.CatalogRead)
  searchProjects(@CurrentUser() actor: AuthUser, @Query() query: ListProjectsQueryDto): Promise<ProjectListResponse> {
    return this.catalog.searchProjects(actor, query);
  }

  @Post('projects')
  @RequireCapabilities(Capability.CatalogManage)
  createProject(@CurrentUser() actor: AuthUser, @Body() dto: CreateProjectDto): Promise<ProjectResponse> {
    return this.catalog.createProject(actor, dto);
  }

  @Patch('projects/:id')
  @RequireCapabilities(Capability.CatalogManage)
  updateProject(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    return this.catalog.updateProject(actor, id, dto);
  }

  // ---- Stanovi ----

  @Post('projects/:id/units')
  @RequireCapabilities(Capability.CatalogManage)
  createUnit(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateUnitDto,
  ): Promise<UnitResponse> {
    return this.catalog.createUnit(actor, projectId, dto);
  }

  @Patch('units/:id')
  @RequireCapabilities(Capability.CatalogManage)
  updateUnit(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<UnitResponse> {
    return this.catalog.updateUnit(actor, id, dto);
  }
}

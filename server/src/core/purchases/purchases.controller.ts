import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import {
  BlockPurchaseDto,
  CreateMessageDto,
  CreatePurchaseDto,
  CreateTaskDto,
  ListPurchasesQueryDto,
  StepParamsDto,
  StepCompleteDto,
  StepSkipDto,
  UpdateAssignmentsDto,
  UpdateTaskDto,
} from './dto/purchase.dto.js';
import type {
  PurchaseDetailDto,
  PurchaseListDto,
  PurchaseMessageDto,
  PurchaseTaskDto,
} from './dto/purchase-response.dto.js';
import { PurchaseMessagesService } from './purchase-messages.service.js';
import { PurchaseTasksService } from './purchase-tasks.service.js';
import { PurchasesService } from './purchases.service.js';

/**
 * Kupovine (F-01). Capability kaže DA LI neko sme da radi radnju; KOJU
 * kupovinu sme da vidi i menja proverava PurchaseAccessService u servisu.
 */
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly tasks: PurchaseTasksService,
    private readonly messages: PurchaseMessagesService,
  ) {}

  @Post()
  @RequireCapabilities(Capability.PurchasesManage)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreatePurchaseDto): Promise<PurchaseDetailDto> {
    return this.purchases.create(actor, dto);
  }

  @Get()
  @RequireCapabilities(Capability.PurchasesRead)
  list(@CurrentUser() actor: AuthUser, @Query() query: ListPurchasesQueryDto): Promise<PurchaseListDto> {
    return this.purchases.list(actor, query);
  }

  @Get(':id')
  @RequireCapabilities(Capability.PurchasesRead)
  detail(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseDetailDto> {
    return this.purchases.detail(actor, id);
  }

  @Patch(':id/assignments')
  @RequireCapabilities(Capability.PurchasesAssignLawyer)
  assign(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentsDto,
  ): Promise<PurchaseDetailDto> {
    return this.purchases.updateAssignments(actor, id, dto);
  }

  @Post(':id/steps/:code/complete')
  @RequireCapabilities(Capability.PurchaseStepsComplete)
  @HttpCode(HttpStatus.OK)
  completeStep(@CurrentUser() actor: AuthUser, @Param() params: StepParamsDto, @Body() dto: StepCompleteDto): Promise<PurchaseDetailDto> {
    return this.purchases.completeStep(actor, params.id, params.code, dto);
  }

  @Post(':id/steps/:code/skip')
  @RequireCapabilities(Capability.PurchaseStepsComplete)
  @HttpCode(HttpStatus.OK)
  skipStep(@CurrentUser() actor: AuthUser, @Param() params: StepParamsDto, @Body() dto: StepSkipDto): Promise<PurchaseDetailDto> {
    return this.purchases.skipStep(actor, params.id, params.code, dto);
  }

  @Post(':id/block')
  @RequireCapabilities(Capability.PurchasesManage)
  @HttpCode(HttpStatus.OK)
  block(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BlockPurchaseDto): Promise<PurchaseDetailDto> {
    return this.purchases.block(actor, id, dto.reason);
  }

  @Post(':id/unblock')
  @RequireCapabilities(Capability.PurchasesManage)
  @HttpCode(HttpStatus.OK)
  unblock(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseDetailDto> {
    return this.purchases.unblock(actor, id);
  }

  @Post(':id/cancel')
  @RequireCapabilities(Capability.PurchasesManage)
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseDetailDto> {
    return this.purchases.cancel(actor, id);
  }

  /** Zadatke dodeljuju koordinator i vodeći advokat; servis proverava vezu sa kupovinom. */
  @Post(':id/tasks')
  @RequireCapabilities(Capability.PurchasesRead)
  createTask(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTaskDto): Promise<PurchaseTaskDto> {
    return this.tasks.create(actor, id, dto);
  }

  @Get(':id/tasks')
  @RequireCapabilities(Capability.PurchasesRead)
  listTasks(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseTaskDto[]> {
    return this.tasks.listForPurchase(actor, id);
  }

  @Get(':id/messages')
  @RequireCapabilities(Capability.PurchasesRead)
  listMessages(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseMessageDto[]> {
    return this.messages.list(actor, id);
  }

  @Post(':id/messages')
  @RequireCapabilities(Capability.MessagesWrite)
  createMessage(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<PurchaseMessageDto> {
    return this.messages.create(actor, id, dto);
  }
}

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: PurchaseTasksService) {}

  @Get('mine')
  @RequireCapabilities(Capability.TasksWork)
  mine(@CurrentUser() actor: AuthUser): Promise<PurchaseTaskDto[]> {
    return this.tasks.listMine(actor);
  }

  @Patch(':id')
  @RequireCapabilities(Capability.TasksWork)
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto): Promise<PurchaseTaskDto> {
    return this.tasks.update(actor, id, dto);
  }
}

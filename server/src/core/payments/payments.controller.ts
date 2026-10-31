import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import { ConfirmConditionDto, RecordPaymentDto, ReplacePaymentPlanDto, ReturnInstructionDto } from './dto/payments.dto.js';
import { EscrowService, type EscrowInstructionListResponse, type EscrowInstructionResponse } from './escrow.service.js';
import type { InstallmentResponse, PaymentPlanResponse } from './payments.mapper.js';
import { PaymentsService } from './payments.service.js';
import { ParseConditionCodePipe } from './parse-condition-code.pipe.js';

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly escrow: EscrowService,
  ) {}

  @Get('purchases/:id/installments')
  @RequireCapabilities(Capability.PaymentsRead)
  getPlan(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PaymentPlanResponse> {
    return this.payments.getPlan(actor, id);
  }

  @Put('purchases/:id/installments')
  @RequireCapabilities(Capability.PaymentsPlan)
  replacePlan(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePaymentPlanDto,
  ): Promise<PaymentPlanResponse> {
    return this.payments.replacePlan(actor, id, dto);
  }

  @Post('installments/:id/conditions/:code/confirm')
  @RequireCapabilities(Capability.PaymentConditionsConfirm)
  @HttpCode(HttpStatus.OK)
  confirmCondition(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('code', ParseConditionCodePipe) code: string,
    @Body() dto: ConfirmConditionDto,
  ): Promise<InstallmentResponse> {
    return this.payments.confirmCondition(actor, id, code, dto);
  }

  @Post('installments/:id/paid')
  @RequireCapabilities(Capability.PaymentsRecord)
  @HttpCode(HttpStatus.OK)
  recordPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<InstallmentResponse> {
    return this.payments.recordPayment(actor, id, dto);
  }

  /** Naš tim vidi instrukcije svog tržišta, escrow partner samo svoje kupovine. */
  @Get('escrow/instructions')
  @RequireCapabilities(Capability.PaymentsRead)
  listInstructions(@CurrentUser() actor: AuthUser, @Query() query: PaginationQueryDto): Promise<EscrowInstructionListResponse> {
    return this.escrow.list(actor, query);
  }

  @Post('escrow/instructions/:id/approve')
  @RequireCapabilities(Capability.EscrowInstructionsApprove)
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EscrowInstructionResponse> {
    return this.escrow.approve(actor, id);
  }

  @Post('escrow/instructions/:id/execute')
  @RequireCapabilities(Capability.EscrowExecute)
  @HttpCode(HttpStatus.OK)
  execute(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EscrowInstructionResponse> {
    return this.escrow.execute(actor, id);
  }

  @Post('escrow/instructions/:id/return')
  @RequireCapabilities(Capability.EscrowExecute)
  @HttpCode(HttpStatus.OK)
  returnInstruction(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnInstructionDto,
  ): Promise<EscrowInstructionResponse> {
    return this.escrow.returnInstruction(actor, id, dto.reason);
  }
}

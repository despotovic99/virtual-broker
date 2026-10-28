import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import type { LegalFinding } from '../../markets/market-pack.js';
import { RequireCapabilities } from '../access/access.decorators.js';
import type { AuthUser } from '../access/auth-user.js';
import { Capability } from '../access/capability.enum.js';
import { CurrentUser } from '../access/current-user.decorator.js';
import {
  CostsService,
  type BuyerProfileResponse,
  type CostCalculationResponse,
  type PriceEstimateResponse,
} from './costs.service.js';
import { CalculateCostsDto, MarketQueryDto, PriceEstimateQueryDto, UpdateBuyerProfileDto } from './dto/costs.dto.js';

@Controller()
export class CostsController {
  constructor(private readonly costs: CostsService) {}

  /** Upitnik kupca (F-03). */
  @Get('buyer-profile')
  @RequireCapabilities(Capability.BuyerProfileManage)
  getProfile(@CurrentUser() actor: AuthUser): Promise<BuyerProfileResponse> {
    return this.costs.getProfile(actor);
  }

  @Put('buyer-profile')
  @RequireCapabilities(Capability.BuyerProfileManage)
  updateProfile(@CurrentUser() actor: AuthUser, @Body() dto: UpdateBuyerProfileDto): Promise<BuyerProfileResponse> {
    return this.costs.updateProfile(actor, dto);
  }

  /** Obračun ukupnog troška po pravilima tržišta (F-10). */
  @Post('costs/calculate')
  @RequireCapabilities(Capability.CostsCalculate)
  calculate(@CurrentUser() actor: AuthUser, @Body() dto: CalculateCostsDto): Promise<CostCalculationResponse> {
    return this.costs.calculate(actor, dto);
  }

  /** Pravne napomene za kupca na osnovu upitnika (F-11). */
  @Get('costs/legal-findings')
  @RequireCapabilities(Capability.BuyerProfileManage)
  legalFindings(@CurrentUser() actor: AuthUser, @Query() query: MarketQueryDto): Promise<LegalFinding[]> {
    return this.costs.legalFindings(actor, query.market);
  }

  /** Procena cene (F-09). Tržišni indeks je DUMMY u MVP-u. */
  @Get('costs/price-estimate')
  @RequireCapabilities(Capability.CostsCalculate)
  priceEstimate(@Query() query: PriceEstimateQueryDto): Promise<PriceEstimateResponse> {
    return this.costs.priceEstimate(query);
  }
}

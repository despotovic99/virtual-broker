import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { throwApiError } from '../../common/errors/throw-api-error.js';
import { PRICE_INDEX, type PriceIndex } from '../../integrations/dummy/dummy-price-index.js';
import type { MarketCode } from '../../markets/market-code.js';
import type { BuyerProfileFacts, CostBreakdown, CostInput, LegalFinding, Localized } from '../../markets/market-pack.js';
import { MarketRegistry } from '../../markets/market-registry.js';
import type { AuthUser } from '../access/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { BuyerProfile } from '../users/entities/buyer-profile.entity.js';
import { BuyerProfileRepository } from './buyer-profile.repository.js';
import type { CalculateCostsDto, PriceEstimateQueryDto, UpdateBuyerProfileDto } from './dto/costs.dto.js';

export interface BuyerProfileResponse {
  isFirstHome: boolean;
  isEuCitizen: boolean;
  primaryResidence: boolean;
  financing: BuyerProfile['financing'];
  age: number | null;
  householdMembers: number;
  budget: number | null;
  /** false: profil još nije popunjen, vraćene su podrazumevane vrednosti. */
  completed: boolean;
}

export interface CostCalculationResponse extends CostBreakdown {
  market: MarketCode;
  input: CostInput;
}

export interface PriceEstimateResponse {
  market: MarketCode;
  city: string;
  averagePricePerM2: number;
  pricePerM2: number | null;
  /** Odstupanje tražene cene od proseka u procentima (pozitivno: skuplje od proseka). */
  deviationPercent: number | null;
  verdict: 'BELOW_MARKET' | 'FAIR' | 'ABOVE_MARKET' | null;
  source: string;
  /** true: tržišni indeks je DUMMY, brojevi nisu pravi podaci (F-09). */
  dummy: boolean;
  disclaimer: Localized;
}

const DEFAULT_PROFILE: Omit<BuyerProfileResponse, 'completed'> = {
  isFirstHome: false,
  isEuCitizen: false,
  primaryResidence: false,
  financing: 'CASH',
  age: null,
  householdMembers: 1,
  budget: null,
};

/** Granica „fer” cene: ±10% od proseka (predlog, F-09). */
const FAIR_BAND_PERCENT = 10;

/**
 * Profil kupca (F-03), obračun troškova (F-10), pravne napomene (F-11) i
 * procena cene (F-09). Obračun i napomene dolaze iz paketa tržišta.
 */
@Injectable()
export class CostsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly profiles: BuyerProfileRepository,
    private readonly markets: MarketRegistry,
    private readonly audit: AuditService,
    @Inject(PRICE_INDEX) private readonly priceIndex: PriceIndex,
  ) {}

  async getProfile(actor: AuthUser): Promise<BuyerProfileResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      return toProfileResponse(await this.profiles.find(queryRunner.manager, actor.id));
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async updateProfile(actor: AuthUser, dto: UpdateBuyerProfileDto): Promise<BuyerProfileResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const profile = await this.profiles.upsert(queryRunner.manager, {
        userId: actor.id,
        isFirstHome: dto.isFirstHome,
        isEuCitizen: dto.isEuCitizen,
        primaryResidence: dto.primaryResidence,
        financing: dto.financing,
        age: dto.age ?? null,
        householdMembers: dto.householdMembers,
        budget: dto.budget ?? null,
      });
      await this.audit.record(queryRunner.manager, {
        market: null,
        actorId: actor.id,
        action: 'buyer_profile.updated',
        entityType: 'buyer_profile',
        entityId: actor.id,
        data: null,
      });
      await queryRunner.commitTransaction();
      return toProfileResponse(profile);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async calculate(actor: AuthUser, dto: CalculateCostsDto): Promise<CostCalculationResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const profile = toProfileResponse(await this.profiles.find(queryRunner.manager, actor.id));
      const input: CostInput = {
        price: dto.price,
        area: dto.area,
        isFirstHome: dto.isFirstHome ?? profile.isFirstHome,
        householdMembers: dto.householdMembers ?? profile.householdMembers,
        isEuCitizen: dto.isEuCitizen ?? profile.isEuCitizen,
        primaryResidence: dto.primaryResidence ?? profile.primaryResidence,
        loanAmount: dto.loanAmount ?? 0,
      };
      const breakdown = this.markets.get(dto.market).calculateCosts(input);
      return { ...breakdown, market: dto.market, input };
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  async legalFindings(actor: AuthUser, market: MarketCode): Promise<LegalFinding[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const profile = toProfileResponse(await this.profiles.find(queryRunner.manager, actor.id));
      const facts: BuyerProfileFacts = {
        isFirstHome: profile.isFirstHome,
        isEuCitizen: profile.isEuCitizen,
        primaryResidence: profile.primaryResidence,
        financing: profile.financing,
        age: profile.age,
      };
      return this.markets.get(market).legalFindings(facts);
    } catch (error) {
      throwApiError(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Procena cene iz tržišnog indeksa. Indeks je DUMMY i to se vraća u odgovoru. Ne koristi bazu. */
  async priceEstimate(query: PriceEstimateQueryDto): Promise<PriceEstimateResponse> {
    try {
      const index = await this.priceIndex.averageFor(query.market, query.city);
      const pricePerM2 = query.price !== undefined && query.area ? Math.round(query.price / query.area) : null;
      const deviationPercent =
        pricePerM2 !== null && index.averagePricePerM2 > 0
          ? Math.round(((pricePerM2 - index.averagePricePerM2) / index.averagePricePerM2) * 1000) / 10
          : null;
      const verdict =
        deviationPercent === null
          ? null
          : deviationPercent > FAIR_BAND_PERCENT
            ? 'ABOVE_MARKET'
            : deviationPercent < -FAIR_BAND_PERCENT
              ? 'BELOW_MARKET'
              : 'FAIR';
      return {
        market: query.market,
        city: query.city.trim(),
        averagePricePerM2: index.averagePricePerM2,
        pricePerM2,
        deviationPercent,
        verdict,
        source: index.source,
        dummy: index.dummy,
        disclaimer: {
          sr: 'Orijentaciona procena. Tržišni indeks još nije povezan sa pravim izvorom (test podaci).',
          en: 'Indicative estimate. The market index is not yet connected to a real source (test data).',
        },
      };
    } catch (error) {
      throwApiError(error);
    }
  }
}

function toProfileResponse(profile: BuyerProfile | null): BuyerProfileResponse {
  if (!profile) return { ...DEFAULT_PROFILE, completed: false };
  return {
    isFirstHome: profile.isFirstHome,
    isEuCitizen: profile.isEuCitizen,
    primaryResidence: profile.primaryResidence,
    financing: profile.financing,
    age: profile.age,
    householdMembers: profile.householdMembers,
    budget: profile.budget,
    completed: true,
  };
}

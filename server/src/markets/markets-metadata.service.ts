import { Injectable } from '@nestjs/common';
import type { Role } from '../core/access/role.enum.js';
import type { MarketCode } from './market-code.js';
import type {
  CheckMethod,
  CheckSubject,
  ConditionScope,
  DocumentScope,
  JourneyPhase,
  Localized,
  MarketLocale,
  MoneyModel,
} from './market-pack.js';
import { MarketRegistry } from './market-registry.js';

export interface MarketMetadataDto {
  code: MarketCode;
  version: string;
  locale: MarketLocale;
  moneyModel: MoneyModel;
  journey: {
    code: string;
    phase: JourneyPhase;
    title: Localized;
    ownerRoles: Role[];
    requiresLegalOpinion: boolean;
    optional: boolean;
  }[];
  checks: {
    code: string;
    subject: CheckSubject;
    title: Localized;
    mandatory: boolean;
    method: CheckMethod;
    validityDays: number;
    inFreeSemaphore: boolean;
    hardBlockOnRed: boolean;
    /** Automatska provera iz spoljnog izvora. U MVP-u su svi izvori DUMMY. */
    automatic: boolean;
    sourceIsDummy: boolean;
  }[];
  paymentConditions: { code: string; title: Localized; appliesTo: ConditionScope; confirmerRoles: Role[] }[];
  constructionPhases: { code: string; title: Localized; defaultSharePercent: number }[];
  documentTypes: { code: string; title: Localized; scopes: DocumentScope[] }[];
}

/** Metapodaci paketa tržišta (F-34) bez funkcija i internih ključeva integracija. Bez pristupa bazi. */
@Injectable()
export class MarketsMetadataService {
  constructor(private readonly markets: MarketRegistry) {}

  list(): MarketMetadataDto[] {
    return this.markets.list().map((pack) => ({
      code: pack.code,
      version: pack.version,
      locale: pack.locale,
      moneyModel: pack.moneyModel,
      journey: pack.journey.map((step) => ({
        code: step.code,
        phase: step.phase,
        title: step.title,
        ownerRoles: [...step.ownerRoles],
        requiresLegalOpinion: step.requiresLegalOpinion ?? false,
        optional: step.optional ?? false,
      })),
      checks: pack.checks.map((check) => ({
        code: check.code,
        subject: check.subject,
        title: check.title,
        mandatory: check.mandatory,
        method: check.method,
        validityDays: check.validityDays,
        inFreeSemaphore: check.inFreeSemaphore,
        hardBlockOnRed: check.hardBlockOnRed ?? false,
        automatic: check.integration !== undefined,
        // MVP: svi spoljni izvori su DUMMY (src/integrations/dummy). Promeniti kad se uradi integracija.
        sourceIsDummy: check.integration !== undefined,
      })),
      paymentConditions: pack.paymentConditions.map((condition) => ({
        code: condition.code,
        title: condition.title,
        appliesTo: condition.appliesTo,
        confirmerRoles: [...condition.confirmerRoles],
      })),
      constructionPhases: pack.constructionPhases.map((phase) => ({
        code: phase.code,
        title: phase.title,
        defaultSharePercent: phase.defaultSharePercent,
      })),
      documentTypes: pack.documentTypes.map((type) => ({ code: type.code, title: type.title, scopes: [...type.scopes] })),
    }));
  }
}

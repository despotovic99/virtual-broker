import type { Role } from '../core/access/role.enum.js';
import type { IntegrationKey } from '../integrations/integration-key.js';
import type { MarketCode } from './market-code.js';

/** Tekst na jezicima MVP-a (srpski latinica i engleski). */
export interface Localized {
  sr: string;
  en: string;
}

export interface MarketLocale {
  /** Jezici interfejsa, prvi je podrazumevani. */
  languages: readonly string[];
  /** Valute prikaza; iznosi se čuvaju u evrima. */
  displayCurrencies: readonly string[];
  /** Po ovoj zoni se računaju svi rokovi na tržištu. */
  timeZone: string;
}

/** Faze puta kupca. Iste su na oba tržišta (jezgro); koraci unutar faza dolaze iz paketa. */
export enum JourneyPhase {
  Preparation = 'PREPARATION',
  Checks = 'CHECKS',
  Contract = 'CONTRACT',
  PaymentsConstruction = 'PAYMENTS_CONSTRUCTION',
  Completion = 'COMPLETION',
  AfterKeys = 'AFTER_KEYS',
}

export const JOURNEY_PHASE_ORDER: readonly JourneyPhase[] = [
  JourneyPhase.Preparation,
  JourneyPhase.Checks,
  JourneyPhase.Contract,
  JourneyPhase.PaymentsConstruction,
  JourneyPhase.Completion,
  JourneyPhase.AfterKeys,
];

/** Korak kupovine (S1–S17 za Srbiju, K1–K17 za Kipar; dokument 6). */
export interface JourneyStepDefinition {
  code: string;
  phase: JourneyPhase;
  title: Localized;
  /** Ko sme da označi korak kao završen (uz koordinatora, koji sme uvek). */
  ownerRoles: readonly Role[];
  /** Korak ne može da se završi bez pravnog mišljenja advokata (F-12). */
  requiresLegalOpinion?: boolean;
  /** Korak koji ne važi za svakog kupca i može se preskočiti uz razlog. */
  optional?: boolean;
}

export type CheckSubject = 'DEVELOPER' | 'PROJECT';

/** Kako se provera radi (README pravilo 2: svaka stavka ima izvor, datum i način). */
export type CheckMethod = 'AUTOMATIC' | 'DOCUMENT' | 'LAWYER' | 'MANUAL';

export interface CheckDefinition {
  code: string;
  subject: CheckSubject;
  title: Localized;
  /** Ulazi u ukupan semafor (najgore stanje obaveznih provera). */
  mandatory: boolean;
  method: CheckMethod;
  /** Posle ovoliko dana provera ističe i postaje siva. */
  validityDays: number;
  /** Spoljni izvor za automatske provere. U MVP-u su svi dummy. */
  integration?: IntegrationKey;
  /** Ulazi u besplatni semafor (F-35): samo automatske provere. */
  inFreeSemaphore: boolean;
  /** Crveno stanje ove provere blokira kupovinu (tvrda blokada, README pravilo 8). */
  hardBlockOnRed?: boolean;
}

/** Na koje rate se uslov odnosi. PHASE: rate vezane za fazu gradnje. */
export type ConditionScope = 'FIRST' | 'EVERY' | 'PHASE' | 'LAST';

/** Uslov pre uplate (F-14). Rata je zaključana dok nisu ispunjeni svi njeni uslovi. */
export interface PaymentConditionDefinition {
  code: string;
  title: Localized;
  appliesTo: ConditionScope;
  /** Ko sme da potvrdi da je uslov ispunjen. */
  confirmerRoles: readonly Role[];
}

export interface ConstructionPhaseDefinition {
  code: string;
  title: Localized;
  /** Predlog udela cene koji se plaća po završetku faze (koordinator ga menja u planu uplata). */
  defaultSharePercent: number;
}

export type DocumentScope = 'PURCHASE' | 'PROJECT' | 'DEVELOPER' | 'REPORT';

export interface DocumentTypeDefinition {
  code: string;
  title: Localized;
  scopes: readonly DocumentScope[];
}

/** ESCROW: novac čuva escrow partner. GATE: kupac plaća investitoru, ali je svaka rata zaključana uslovima. */
export type MoneyModel = 'ESCROW' | 'GATE';

export interface CostInput {
  /** Cena iz ugovora u evrima. RS: sa PDV-om. CY: bez PDV-a. */
  price: number;
  /** Površina stana u m². */
  area: number;
  isFirstHome: boolean;
  /** Broj članova domaćinstva, uključujući kupca. */
  householdMembers: number;
  isEuCitizen: boolean;
  primaryResidence: boolean;
  /** Iznos kredita u evrima, 0 ako se kupuje gotovinom. */
  loanAmount: number;
}

export interface CostLine {
  code: string;
  label: Localized;
  amount: number;
  /** COST: dodatni trošak. REFUND: novac koji se vraća. INCLUDED: već u ceni, samo informacija. */
  kind: 'COST' | 'REFUND' | 'INCLUDED';
  /** Iznos je procena, ne tačan obračun. */
  estimate: boolean;
  note?: Localized;
}

export interface CostBreakdown {
  lines: CostLine[];
  totalExtra: number;
  totalRefund: number;
  disclaimer: Localized;
}

export interface BuyerProfileFacts {
  isFirstHome: boolean;
  isEuCitizen: boolean;
  primaryResidence: boolean;
  financing: 'CASH' | 'MORTGAGE';
  /** Godine kupca, ako ih je uneo (program za mlade u Srbiji). */
  age: number | null;
}

/** Pravna napomena za kupca (F-11). BLOCKER zaustavlja kupovinu dok je advokat ne razreši. */
export interface LegalFinding {
  code: string;
  level: 'INFO' | 'WARNING' | 'BLOCKER';
  title: Localized;
  text: Localized;
}

/**
 * Paket tržišta: sve što je specifično za jednu zemlju (F-34, odeljak 6.3).
 * Jezgro nikad ne grana po kodu zemlje, nego pita paket preko MarketRegistry.
 */
export interface MarketPack {
  readonly code: MarketCode;
  /** Verzija paketa; kupovina pamti verziju sa kojom je počela. */
  readonly version: string;
  readonly locale: MarketLocale;
  readonly moneyModel: MoneyModel;
  readonly journey: readonly JourneyStepDefinition[];
  readonly checks: readonly CheckDefinition[];
  readonly paymentConditions: readonly PaymentConditionDefinition[];
  readonly constructionPhases: readonly ConstructionPhaseDefinition[];
  readonly documentTypes: readonly DocumentTypeDefinition[];
  calculateCosts(input: CostInput): CostBreakdown;
  legalFindings(profile: BuyerProfileFacts): LegalFinding[];
}

export const MARKET_PACKS = Symbol('MARKET_PACKS');

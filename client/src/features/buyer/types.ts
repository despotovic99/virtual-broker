// Oblici odgovora servera za ekrane kupca (server/src/core/requests, catalog, checks, costs).
import type { MarketCode } from '../../core/auth/capabilities.ts'
import type { Localized } from '../../core/i18n/I18nContext.tsx'
import type { SemaphoreStatus } from '../../ui/components.tsx'

export type RequestKind = 'CHECK' | 'QUESTION' | 'GUIDED_PURCHASE'
export type RequestStatus = 'NEW' | 'IN_TRIAGE' | 'WITH_LEGAL_TEAM' | 'ANSWERED' | 'CONVERTED' | 'CLOSED'
export type AnswerScope = 'INFORMATION' | 'ENGAGED_ADVICE'

export interface SemaphoreItem {
  code: string
  subject: 'DEVELOPER' | 'PROJECT'
  title: Localized
  mandatory: boolean
  method: 'AUTOMATIC' | 'DOCUMENT' | 'LAWYER' | 'MANUAL'
  status: SemaphoreStatus
  summary: string | null
  source: string | null
  dummy: boolean
  checkedAt: string | null
  validUntil: string | null
  expired: boolean
  hardBlockOnRed: boolean
  documentId: string | null
}

export interface SemaphoreResult {
  overall: SemaphoreStatus
  hardBlocked: boolean
  items: SemaphoreItem[]
  containsDummyData: boolean
}

export interface FreeSemaphore {
  developer: SemaphoreResult | null
  parcel: SemaphoreResult | null
  checkedAt: string
  disclaimer: Localized
}

export interface BuyerRequestItem {
  id: string
  market: MarketCode
  kind: RequestKind
  status: RequestStatus
  listingUrl: string | null
  developerName: string | null
  registrationNumber: string | null
  parcelReference: string | null
  address: string | null
  question: string | null
  developerId: string | null
  projectId: string | null
  unitId: string | null
  answer: string | null
  answerScope: AnswerScope | null
  answeredAt: string | null
  purchaseId: string | null
  freeSemaphore: FreeSemaphore | null
  firstResponseDueAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateRequestBody {
  kind: RequestKind
  market: MarketCode
  listingUrl?: string
  developerName?: string
  registrationNumber?: string
  parcelReference?: string
  address?: string
  question?: string
  projectId?: string
  unitId?: string
}

export interface ProjectItem {
  id: string
  market: MarketCode
  developerId: string
  developerName: string | null
  name: string
  city: string
  address: string
  parcelReference: string | null
  description: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  expectedCompletion: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectList {
  items: ProjectItem[]
  total: number
  limit: number
  offset: number
}

export interface UnitItem {
  id: string
  projectId: string
  label: string
  floor: number | null
  rooms: number | null
  area: number
  price: number
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD'
}

export interface ProjectSemaphore {
  developer: SemaphoreResult
  project: SemaphoreResult
  overall: SemaphoreStatus
  hardBlocked: boolean
  containsDummyData: boolean
  disclaimer: Localized
}

export interface ProjectDetail {
  project: ProjectItem
  developer: { id: string; name: string; registrationNumber: string }
  units: UnitItem[]
  semaphore: ProjectSemaphore
}

export interface BuyerProfile {
  isFirstHome: boolean
  isEuCitizen: boolean
  primaryResidence: boolean
  financing: 'CASH' | 'MORTGAGE'
  age: number | null
  householdMembers: number
  budget: number | null
  completed: boolean
}

export interface CostLine {
  code: string
  label: Localized
  amount: number
  kind: 'COST' | 'REFUND' | 'INCLUDED'
  estimate: boolean
  note?: Localized
}

export interface CostCalculation {
  market: MarketCode
  lines: CostLine[]
  totalExtra: number
  totalRefund: number
  disclaimer: Localized
}

export interface CostCalculateBody {
  market: MarketCode
  price: number
  area: number
  loanAmount?: number
}

export interface LegalFinding {
  code: string
  level: 'INFO' | 'WARNING' | 'BLOCKER'
  title: Localized
  text: Localized
}

export interface PriceEstimate {
  market: MarketCode
  city: string
  averagePricePerM2: number
  pricePerM2: number | null
  deviationPercent: number | null
  verdict: 'BELOW_MARKET' | 'FAIR' | 'ABOVE_MARKET' | null
  source: string
  dummy: boolean
  disclaimer: Localized
}

/** Podatak iz dummy integracije (README: jasno naznačeno da je dummy). */
export function isDummy(item: { dummy?: boolean; source?: string | null }): boolean {
  return Boolean(item.dummy) || Boolean(item.source?.startsWith('DUMMY:'))
}

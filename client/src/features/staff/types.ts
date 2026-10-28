// Tipovi odgovora servera za back-office (server/src/core/*). Ručno usklađeno.
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
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
  disclaimer?: Localized
}

export interface ProjectSemaphore {
  developer: SemaphoreResult
  project: SemaphoreResult
  overall: SemaphoreStatus
  hardBlocked: boolean
  containsDummyData: boolean
  disclaimer?: Localized
}

export interface BuyerRequest {
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
  freeSemaphore: {
    developer: SemaphoreResult | null
    parcel: SemaphoreResult | null
    checkedAt: string
    disclaimer: Localized
  } | null
  firstResponseDueAt: string
  createdAt: string
  updatedAt: string
  ownerUserId?: string | null
  legalTeamId?: string | null
  buyerId?: string
  answeredById?: string | null
}

export interface Developer {
  id: string
  market: MarketCode
  name: string
  registrationNumber: string
  taxNumber: string | null
  address: string | null
  website: string | null
  createdAt: string
}

export interface BankAccount {
  id: string
  developerId: string
  iban: string
  bankName: string
  holderName: string
  verified: boolean
  verifiedAt: string | null
  verificationNote: string | null
  /** Ko je uneo račun; ta osoba ne sme da ga proveri (četiri oka). */
  createdById: string | null
  createdAt: string
}

export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type UnitStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD'

export interface Project {
  id: string
  market: MarketCode
  developerId: string
  developerName: string | null
  name: string
  city: string
  address: string
  parcelReference: string | null
  description: string | null
  status: ProjectStatus
  expectedCompletion: string | null
  createdAt: string
  updatedAt: string
}

export interface Unit {
  id: string
  projectId: string
  label: string
  floor: number | null
  rooms: number | null
  area: number
  price: number
  status: UnitStatus
}

export interface ProjectDetail {
  project: Project
  developer: { id: string; name: string; registrationNumber: string }
  units: Unit[]
  semaphore: ProjectSemaphore
}

export interface CheckHistoryItem {
  id: string
  definitionCode: string
  status: SemaphoreStatus
  summary: string
  source: string
  method: SemaphoreItem['method']
  dummy: boolean
  checkedAt: string
  validUntil: string
  checkedById: string | null
  documentId: string | null
}

export interface DocumentItem {
  id: string
  scope: 'PURCHASE' | 'PROJECT' | 'DEVELOPER' | 'REPORT'
  typeCode: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
  uploadedById: string
  createdAt: string
}

export type PhaseStatus = 'PLANNED' | 'IN_PROGRESS' | 'CONFIRMED' | 'REJECTED'
export type ReportVerdict = 'PROGRESS' | 'PHASE_CONFIRMED' | 'PHASE_REJECTED' | 'ISSUE'

export interface ConstructionPhase {
  phaseCode: string
  title: Localized
  position: number
  defaultSharePercent: number
  plannedDate: string | null
  actualDate: string | null
  status: PhaseStatus
  confirmedAt: string | null
  late: boolean
}

export interface Construction {
  projectId: string
  phases: ConstructionPhase[]
}

export interface EngineerReport {
  id: string
  projectId: string
  phaseCode: string | null
  engineerId: string
  visitDate: string
  summary: string
  verdict: ReportVerdict
  createdAt: string
}

export type EscrowStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'RETURNED'

export interface EscrowInstruction {
  id: string
  purchaseId: string
  installmentId: string
  amount: number
  status: EscrowStatus
  recipient: { iban: string; bankName: string; holderName: string } | null
  firstApproverId: string | null
  secondApproverId: string | null
  executedAt: string | null
  returnReason: string | null
  createdAt: string
}

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: Role[]
  markets: MarketCode[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  language?: string
}

export interface UserList {
  items: AdminUser[]
  total: number
  limit: number
  offset: number
}

export type LegalTeamRole = 'LEAD' | 'LAWYER' | 'ASSOCIATE'

export interface LegalTeamMember {
  userId: string
  firstName: string
  lastName: string
  email: string
  teamRole: LegalTeamRole
  licenseNumber: string | null
  licenseVerifiedAt: string | null
}

export interface LegalTeam {
  id: string
  market: MarketCode
  name: string
  languages: string[]
  conflictDeveloperIds: string[]
  active: boolean
  members: LegalTeamMember[]
  createdAt: string
}

export interface AuditEvent {
  id: string
  market: MarketCode | null
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  data: Record<string, unknown> | null
  createdAt: string
}

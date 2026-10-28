// Oblici odgovora servera (server/src/core/purchases, legal, payments, construction, handover, documents).
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import type { Localized } from '../../core/i18n/I18nContext.tsx'

export type PurchaseStatus = 'ACTIVE' | 'BLOCKED' | 'CANCELLED' | 'COMPLETED'
export type PurchaseRelation = 'BUYER' | 'COORDINATOR' | 'INTERNAL' | 'LAWYER' | 'ENGINEER' | 'ESCROW'
export type StepStatus = 'PENDING' | 'DONE' | 'SKIPPED'
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'REJECTED'
export type MoneyModel = 'ESCROW' | 'GATE'

export interface Person {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

export interface PurchaseStep {
  code: string
  phase: string
  title: Localized
  ownerRoles: Role[]
  optional: boolean
  requiresLegalOpinion: boolean
  status: StepStatus
  completedAt: string | null
  completedBy: Person | null
  note: string | null
}

export interface PurchaseSummary {
  id: string
  market: MarketCode
  status: PurchaseStatus
  unitLabel: string
  projectId: string
  projectName: string
  city: string
  price: number
  currentStep: { code: string; title: Localized } | null
  createdAt: string
}

export interface PurchaseDetail extends PurchaseSummary {
  packVersion: string
  moneyModel: MoneyModel
  blockReason: string | null
  closedAt: string | null
  unit: { id: string; label: string; floor: number | null; rooms: number | null; area: number; price: number }
  project: { id: string; name: string; city: string; address: string }
  developer: { id: string; name: string }
  buyer: Person | null
  coordinator: Person | null
  lawyer: Person | null
  engineer: Person | null
  escrowAgent: Person | null
  legalTeam: { id: string; name: string } | null
  proposedLegalTeam: { id: string; name: string } | null
  steps: PurchaseStep[]
  myRelations: PurchaseRelation[]
}

export interface PurchaseList {
  items: PurchaseSummary[]
  total: number
  limit: number
  offset: number
}

export interface PurchaseTask {
  id: string
  purchaseId: string
  type: string
  title: string
  assigneeUserId: string | null
  legalTeamId: string | null
  dueAt: string | null
  status: TaskStatus
  waitingReason: string | null
  result: string | null
  documentId: string | null
  createdAt: string
  completedAt: string | null
}

export interface PurchaseMessage {
  id: string
  authorId: string
  author: Person | null
  body: string
  internal: boolean
  createdAt: string
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

export interface PowerOfAttorney {
  id: string
  purchaseId: string
  documentId: string
  scope: string[]
  validUntil: string | null
  revokedAt: string | null
  createdById: string
  createdAt: string
  valid: boolean
}

export type OpinionConclusion = 'SIGN' | 'SIGN_WITH_CONDITIONS' | 'DO_NOT_SIGN'

export interface LegalOpinion {
  id: string
  purchaseId: string
  conclusion: OpinionConclusion
  reasoning: string
  conditions: string | null
  documentId: string | null
  authorId: string
  createdAt: string
}

export type InstallmentStatus = 'LOCKED' | 'READY' | 'PAID' | 'RELEASED'

export interface InstallmentCondition {
  code: string
  title: Localized
  status: 'PENDING' | 'MET'
  confirmedById: string | null
  confirmedAt: string | null
  evidenceDocumentId: string | null
  note: string | null
}

export interface Installment {
  id: string
  sequence: number
  label: string
  amount: number
  phaseCode: string | null
  isFinal: boolean
  status: InstallmentStatus
  dueDate: string | null
  paidAt: string | null
  proofDocumentId: string | null
  conditions: InstallmentCondition[]
}

export interface PaymentPlan {
  moneyModel: MoneyModel
  installments: Installment[]
  total: number
}

export type PhaseStatus = 'PLANNED' | 'IN_PROGRESS' | 'CONFIRMED' | 'REJECTED'

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

export interface EngineerReport {
  id: string
  projectId: string
  phaseCode: string | null
  engineerId: string
  visitDate: string
  summary: string
  verdict: 'PROGRESS' | 'PHASE_CONFIRMED' | 'PHASE_REJECTED' | 'ISSUE'
  createdAt: string
}

export interface Handover {
  purchaseId: string
  engineerId: string
  inspectedAt: string
  contractArea: number
  measuredArea: number
  areaDifference: number
  areaDifferencePercent: number
  notes: string | null
  keysHandedAt: string | null
}

export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type DefectStatus = 'OPEN' | 'FIXED' | 'CONFIRMED'

export interface Defect {
  id: string
  description: string
  severity: DefectSeverity
  dueDate: string | null
  status: DefectStatus
  reportedById: string
  fixedAt: string | null
  confirmedById: string | null
  confirmedAt: string | null
  createdAt: string
}

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface MyLegalTeam {
  id: string
  market: MarketCode
  name: string
  languages: string[]
  active: boolean
  myRole: 'LEAD' | 'LAWYER' | 'ASSOCIATE'
}

/** Radnje koje punomoćje sme da obuhvati (server: POA_SCOPES). */
export const POA_SCOPES = [
  'CADASTRE_SEARCH',
  'CONTRACT_DEPOSIT',
  'PERMIT_APPLICATION',
  'COURT_SEARCH',
  'RECEIVE_DOCUMENTS',
  'TITLE_TRANSFER',
] as const
export type PoaScope = (typeof POA_SCOPES)[number]

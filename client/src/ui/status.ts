import type { ChipTone } from './components.tsx'
import type { IconName } from './icons.tsx'

/**
 * Statusi entiteta iz koda servera i njihov signal (ton + znak) po dizajn
 * sistemu. Svaki status ima svoj znak, da radi i bez boje.
 * Upotreba: <StatusBadge text={…} {...statusSignal('purchase', purchase.status)} />
 */
const SIGNALS = {
  purchase: {
    ACTIVE: { tone: 'ok', icon: 'check' },
    BLOCKED: { tone: 'risk', icon: 'lock' },
    CANCELLED: { tone: 'idle', icon: 'cancel' },
    COMPLETED: { tone: 'info', icon: 'flag' },
  },
  request: {
    NEW: { tone: 'info', icon: 'dot' },
    IN_TRIAGE: { tone: 'info', icon: 'progress' },
    WITH_LEGAL_TEAM: { tone: 'info', icon: 'doc' },
    ANSWERED: { tone: 'ok', icon: 'check' },
    CONVERTED: { tone: 'info', icon: 'forward' },
    CLOSED: { tone: 'idle', icon: 'minusCircle' },
  },
  task: {
    NEW: { tone: 'info', icon: 'dot' },
    IN_PROGRESS: { tone: 'info', icon: 'progress' },
    WAITING: { tone: 'warn', icon: 'clock' },
    DONE: { tone: 'ok', icon: 'check' },
    REJECTED: { tone: 'risk', icon: 'cancel' },
  },
  step: {
    PENDING: { tone: 'idle', icon: 'planned' },
    DONE: { tone: 'ok', icon: 'check' },
    SKIPPED: { tone: 'idle', icon: 'minusCircle' },
  },
  installment: {
    LOCKED: { tone: 'idle', icon: 'lock' },
    READY: { tone: 'warn', icon: 'pay' },
    PAID: { tone: 'ok', icon: 'check' },
    RELEASED: { tone: 'ok', icon: 'forward' },
  },
  condition: {
    PENDING: { tone: 'idle', icon: 'clock' },
    MET: { tone: 'ok', icon: 'check' },
  },
  escrow: {
    PENDING_APPROVAL: { tone: 'warn', icon: 'clock' },
    APPROVED: { tone: 'info', icon: 'check' },
    EXECUTED: { tone: 'ok', icon: 'forward' },
    RETURNED: { tone: 'risk', icon: 'back' },
  },
  phase: {
    PLANNED: { tone: 'idle', icon: 'planned' },
    IN_PROGRESS: { tone: 'info', icon: 'progress' },
    CONFIRMED: { tone: 'ok', icon: 'check' },
    REJECTED: { tone: 'risk', icon: 'xCircle' },
  },
  verdict: {
    PROGRESS: { tone: 'info', icon: 'progress' },
    PHASE_CONFIRMED: { tone: 'ok', icon: 'check' },
    PHASE_REJECTED: { tone: 'risk', icon: 'xCircle' },
    ISSUE: { tone: 'warn', icon: 'warn' },
  },
  conclusion: {
    SIGN: { tone: 'ok', icon: 'check' },
    SIGN_WITH_CONDITIONS: { tone: 'warn', icon: 'warn' },
    DO_NOT_SIGN: { tone: 'risk', icon: 'xCircle' },
  },
  defectSeverity: {
    MINOR: { tone: 'soft', icon: null },
    MAJOR: { tone: 'warn', icon: null },
    CRITICAL: { tone: 'critical', icon: 'critical' },
  },
  defect: {
    OPEN: { tone: 'warn', icon: 'clock' },
    FIXED: { tone: 'info', icon: 'progress' },
    CONFIRMED: { tone: 'ok', icon: 'check' },
  },
  project: {
    DRAFT: { tone: 'idle', icon: 'planned' },
    PUBLISHED: { tone: 'ok', icon: 'check' },
    ARCHIVED: { tone: 'idle', icon: 'minusCircle' },
  },
  unit: {
    AVAILABLE: { tone: 'ok', icon: null },
    RESERVED: { tone: 'warn', icon: null },
    SOLD: { tone: 'idle', icon: null },
  },
  findingLevel: {
    INFO: { tone: 'info', icon: 'info' },
    WARNING: { tone: 'warn', icon: 'warn' },
    BLOCKER: { tone: 'critical', icon: 'critical' },
  },
} as const satisfies Record<string, Record<string, { tone: ChipTone; icon: IconName | null }>>

export type SignalKind = keyof typeof SIGNALS

const FALLBACK = { tone: 'idle', icon: 'minusCircle' } as const

/** Ton i znak za status entiteta; nepoznat status je siv, nikad „uredan”. */
export function statusSignal(kind: SignalKind, status: string): { tone: ChipTone; icon: IconName | null } {
  const table: Record<string, { tone: ChipTone; icon: IconName | null }> = SIGNALS[kind]
  return table[status] ?? FALLBACK
}

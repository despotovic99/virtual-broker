import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, StatusBadge } from '../../../ui/components.tsx'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { isManager, matchesRoles, personName, usePurchaseT } from '../shared.tsx'
import type { PurchaseDetail, PurchaseStep } from '../types.ts'

const PHASE_ORDER = ['PREPARATION', 'CHECKS', 'CONTRACT', 'PAYMENTS_CONSTRUCTION', 'COMPLETION', 'AFTER_KEYS'] as const

/** Korak je spreman kada su svi neopcioni koraci u ranijim fazama završeni ili preskočeni (kao na serveru). */
function isReady(purchase: PurchaseDetail, step: PurchaseStep): boolean {
  const phaseIndex = PHASE_ORDER.indexOf(step.phase as (typeof PHASE_ORDER)[number])
  return purchase.steps.every((other) => {
    const otherIndex = PHASE_ORDER.indexOf(other.phase as (typeof PHASE_ORDER)[number])
    return otherIndex >= phaseIndex || other.optional || other.status !== 'PENDING'
  })
}

export function StepsTab({ purchase, onChange }: TabProps) {
  const tt = usePurchaseT()
  const { l, formatDate } = useI18n()
  const { user, can } = useAuth()
  const [active, setActive] = useState<{ code: string; mode: 'complete' | 'skip' } | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const next = purchase.steps.find((step) => step.status === 'PENDING' && !step.optional) ?? purchase.steps.find((step) => step.status === 'PENDING')
  const canAct = (step: PurchaseStep) =>
    purchase.status === 'ACTIVE' &&
    step.status === 'PENDING' &&
    can('purchase-steps:complete') &&
    (isManager(purchase) || matchesRoles(purchase, step.ownerRoles, user?.roles ?? []))

  const submit = async () => {
    if (!active) return
    setBusy(true)
    setError(null)
    try {
      const updated =
        active.mode === 'complete'
          ? await purchasesApi.completeStep(purchase.id, active.code, text.trim() || undefined)
          : await purchasesApi.skipStep(purchase.id, active.code, text.trim())
      onChange(updated)
      setActive(null)
      setText('')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {next && (
        <Card title={tt('step.next')}>
          <p>
            <strong>{next.code}</strong> · {l(next.title)}
          </p>
        </Card>
      )}
      {PHASE_ORDER.map((phase) => {
        const steps = purchase.steps.filter((step) => step.phase === phase)
        if (steps.length === 0) return null
        return (
          <Card key={phase} title={tt(`phase.${phase}`)}>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {steps.map((step) => (
                <li key={step.code} style={{ marginBottom: 10 }}>
                  <div className="row">
                    <strong>{step.code}</strong>
                    <span>{l(step.title)}</span>
                    {step.status === 'DONE' && <StatusBadge text={tt('step.done')} tone="good" />}
                    {step.status === 'SKIPPED' && <StatusBadge text={tt('step.skipped')} tone="neutral" />}
                    {step.status === 'PENDING' && (
                      <StatusBadge text={next?.code === step.code ? tt('step.next') : tt('step.pending')} tone={next?.code === step.code ? 'warn' : 'neutral'} />
                    )}
                    {step.optional && <span className="muted">({tt('step.optional')})</span>}
                    {step.requiresLegalOpinion && <span className="muted">· {tt('step.needsOpinion')}</span>}
                  </div>
                  {step.completedAt && (
                    <div className="muted">
                      {tt('step.by', { name: personName(step.completedBy), date: formatDate(step.completedAt) })}
                      {step.note ? ` · ${step.note}` : ''}
                    </div>
                  )}
                  {canAct(step) && isReady(purchase, step) && active?.code !== step.code && (
                    <div className="row" style={{ marginTop: 4 }}>
                      <button type="button" onClick={() => setActive({ code: step.code, mode: 'complete' })}>
                        {tt('step.complete')}
                      </button>
                      {step.optional && (
                        <button type="button" onClick={() => setActive({ code: step.code, mode: 'skip' })}>
                          {tt('step.skip')}
                        </button>
                      )}
                    </div>
                  )}
                  {active?.code === step.code && (
                    <div style={{ marginTop: 6 }}>
                      <input
                        aria-label={active.mode === 'complete' ? tt('step.note') : tt('step.skipReason')}
                        placeholder={active.mode === 'complete' ? tt('step.note') : tt('step.skipReason')}
                        value={text}
                        maxLength={500}
                        onChange={(event) => setText(event.target.value)}
                      />
                      <div className="row" style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="primary"
                          disabled={busy || (active.mode === 'skip' && text.trim().length < 3)}
                          onClick={() => void submit()}
                        >
                          {active.mode === 'complete' ? tt('step.complete') : tt('step.skip')}
                        </button>
                        <button type="button" onClick={() => setActive(null)}>
                          ✕
                        </button>
                      </div>
                      <ErrorBox error={error} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )
      })}
    </>
  )
}

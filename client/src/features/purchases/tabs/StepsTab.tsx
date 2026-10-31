import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Field, Notice, Progress } from '../../../ui/components.tsx'
import { Icon } from '../../../ui/icons.tsx'
import { FormModal } from '../../../ui/Modal.tsx'
import { purchasesApi } from '../api.ts'
import { useWorkspaceT, type TabProps } from '../PurchaseDetailPage.tsx'
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

type Marker = 'done' | 'current' | 'pending' | 'skipped'

/**
 * Put kupovine, uvek ceo: kupac vidi sve faze od prvog dana. Vidljivost puta
 * je proizvod, a radnja na koraku je pravo.
 */
export function StepsTab({ purchase, onChange }: TabProps) {
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { t, l, formatDate } = useI18n()
  const { user, can } = useAuth()
  const [active, setActive] = useState<{ step: PurchaseStep; mode: 'complete' | 'skip' } | null>(null)
  const [text, setText] = useState('')

  const next = purchase.steps.find((step) => step.status === 'PENDING' && !step.optional) ?? purchase.steps.find((step) => step.status === 'PENDING')
  const finished = purchase.steps.filter((step) => step.status !== 'PENDING').length
  const hasRight = (step: PurchaseStep) =>
    can('purchase-steps:complete') && (isManager(purchase) || matchesRoles(purchase, step.ownerRoles, user?.roles ?? []))
  const owners = (step: PurchaseStep) => step.ownerRoles.map((role) => t(`roleName.${role}`)).join(' · ')

  const markerOf = (step: PurchaseStep): Marker => {
    if (step.status === 'DONE') return 'done'
    if (step.status === 'SKIPPED') return 'skipped'
    return next?.code === step.code ? 'current' : 'pending'
  }

  const open = (step: PurchaseStep, mode: 'complete' | 'skip') => {
    setActive({ step, mode })
    setText('')
  }

  const skipping = active?.mode === 'skip'
  const tooShort = skipping && text.trim().length < 3

  const submit = async () => {
    if (!active) return
    const updated =
      active.mode === 'complete'
        ? await purchasesApi.completeStep(purchase.id, active.step.code, text.trim() || undefined)
        : await purchasesApi.skipStep(purchase.id, active.step.code, text.trim())
    onChange(updated)
  }

  const renderActions = (step: PurchaseStep) => {
    if (step.status !== 'PENDING' || !hasRight(step) || !isReady(purchase, step)) return null
    // Završena kupovina: još samo opcioni koraci posle ključa (server isto proverava).
    const stepOpen = purchase.status === 'ACTIVE' || (purchase.status === 'COMPLETED' && step.optional)
    const blockedReason = stepOpen ? undefined : wt('steps.notActive')

    return (
      <div className="step__actions">
        <button
          type="button"
          className={markerOf(step) === 'current' ? 'primary' : undefined}
          disabled={Boolean(blockedReason)}
          title={blockedReason}
          onClick={() => open(step, 'complete')}
        >
          {tt('step.complete')}
        </button>
        {step.optional && (
          <button type="button" disabled={Boolean(blockedReason)} title={blockedReason} onClick={() => open(step, 'skip')}>
            {tt('step.skip')}
          </button>
        )}
      </div>
    )
  }

  return (
    <Card
      title={wt('steps.title')}
      actions={<Progress done={finished} total={purchase.steps.length} label={wt('steps.progress', { done: finished, total: purchase.steps.length })} />}
    >
      {!next && <p className="empty-line">{wt('steps.allDone')}</p>}
      <div className="steps">
        {PHASE_ORDER.map((phase) => {
          const steps = purchase.steps.filter((step) => step.phase === phase)
          if (steps.length === 0) return null
          const done = steps.filter((step) => step.status !== 'PENDING').length
          const countClass = done === steps.length ? 'step-phase__count--done' : done > 0 ? 'step-phase__count--partial' : ''
          return (
            <div key={phase} className="step-group" role="list" aria-label={tt(`phase.${phase}`)}>
              <div className="step-phase">
                <span className="step-phase__name">{tt(`phase.${phase}`)}</span>
                <span className="divider" />
                <span className={`step-phase__count ${countClass}`}>
                  {done}/{steps.length}
                </span>
              </div>
              {steps.map((step) => {
                const marker = markerOf(step)
                const current = marker === 'current'
                return (
                  <div key={step.code} className={`step step--${marker}`} role="listitem" aria-current={current ? 'step' : undefined}>
                    <span className="step__rail">
                      <span className={`marker marker--${marker}`}>{marker === 'done' && <Icon name="checkBold" size={11} />}</span>
                    </span>
                    <div className="step__body">
                      <span className="step__title">
                        {l(step.title)}
                        {step.status === 'SKIPPED' ? (
                          <span className="step__note"> · {wt('steps.optionalSkipped')}</span>
                        ) : (
                          <>
                            {step.optional && <span className="step__note"> · {tt('step.optional')}</span>}
                            {step.requiresLegalOpinion && <span className="step__note"> · {tt('step.needsOpinion')}</span>}
                          </>
                        )}
                      </span>
                      {current && <span className="step__desc">{wt('steps.currentHint')}</span>}
                      {step.completedAt && (
                        <span className="meta">
                          {step.status === 'SKIPPED' && step.note ? `${wt('steps.reason', { reason: step.note })} · ` : ''}
                          {personName(step.completedBy)} · {formatDate(step.completedAt)}
                          {step.status === 'DONE' && step.note ? ` · ${step.note}` : ''}
                        </span>
                      )}
                      {current && !hasRight(step) && <span className="step__desc">{wt('steps.ownerOther', { owner: owners(step) })}</span>}
                      {renderActions(step)}
                    </div>
                    <span className="step__owner">{owners(step)}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <FormModal
        open={active !== null}
        onClose={() => setActive(null)}
        title={skipping ? tt('step.skip') : tt('step.complete')}
        description={
          active ? `${l(active.step.title)} · ${skipping ? tt('form.step.skipDescription') : tt('form.step.completeDescription')}` : undefined
        }
        submitLabel={skipping ? tt('step.skip') : tt('step.complete')}
        onSubmit={submit}
        disabledReason={tooShort ? wt('steps.skipShort') : null}
        dirty={text.length > 0}
        size="sm"
      >
        {!skipping && active?.step.requiresLegalOpinion && (
          <Notice tone="info" icon="scale">
            {tt('form.step.needsOpinion')}
          </Notice>
        )}
        <Field
          label={skipping ? tt('step.skipReason') : tt('step.note')}
          required={skipping}
          info={skipping ? tt('form.step.skipInfo') : tt('form.step.noteInfo')}
          hint={skipping ? wt('steps.skipHint') : undefined}
          error={skipping && text.length > 0 && tooShort ? wt('steps.skipShort') : null}
        >
          <textarea value={text} rows={3} maxLength={500} autoFocus onChange={(event) => setText(event.target.value)} />
        </Field>
      </FormModal>
    </Card>
  )
}

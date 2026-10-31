import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import type { Role } from '../../../core/auth/capabilities.ts'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../../core/markets/MarketsContext.tsx'
import { Button, Card, Chip, Distribution, Empty, ErrorBox, ErrorState, InfoTip, Loading, Notice, Progress, StatusBadge } from '../../../ui/components.tsx'
import { Icon } from '../../../ui/icons.tsx'
import { FormModal } from '../../../ui/Modal.tsx'
import { statusSignal } from '../../../ui/status.ts'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import { useWorkspaceT, type TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentFileFields, DocumentSelect, DownloadButton, hasRelation, isManager, matchesRoles, usePurchaseT, useUploadOnce } from '../shared.tsx'
import type { DocumentItem, Installment, PurchaseDetail } from '../types.ts'

const DAY_MS = 86_400_000

/** Broj dana kašnjenja rate koja čeka uplatu; 0 ako rok nije prošao. */
function daysLate(installment: Installment): number {
  if (installment.status !== 'READY' || !installment.dueDate) return 0
  const due = new Date(`${installment.dueDate.slice(0, 10)}T23:59:59`)
  const late = Math.floor((Date.now() - due.getTime()) / DAY_MS) + 1
  return late > 0 ? late : 0
}

/**
 * Plan plaćanja. Zaključana rata ne nudi plaćanje: pokazuje koji uslov je drži
 * i ko ga potvrđuje. Kupac nikad ne vidi dugme za uplatu pre nego što je rata
 * „za plaćanje”.
 */
export function MoneyTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { t, formatMoney } = useI18n()
  const { can } = useAuth()
  const plan = useAsync(() => purchasesApi.plan(purchase.id), [purchase.id])
  // Dokumenta za izbor dokaza uz uslov i za prikaz dokaza o uplati (najviše 100, granica servera).
  const documents = useAsync(() => purchasesApi.documents(purchase.id, { limit: 100, offset: 0 }), [purchase.id])
  const canPlan = can('payments:plan') && isManager(purchase)
  const installments = plan.data?.installments ?? []
  const anyPaid = installments.some((item) => item.status === 'PAID' || item.status === 'RELEASED')
  const market = t(`market.${purchase.market}`)

  const sum = (statuses: Installment['status'][]) =>
    installments.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + item.amount, 0)
  const paid = sum(['PAID', 'RELEASED'])
  const ready = sum(['READY'])
  const locked = sum(['LOCKED'])

  const planPath = `/purchases/${purchase.id}/plan`
  const editButton =
    canPlan &&
    (anyPaid ? (
      <Button size="sm" icon="edit" disabled title={tt('money.planLocked')}>
        {tt('money.editPlan')}
      </Button>
    ) : (
      <Link className="btn btn--sm" to={planPath}>
        <Icon name="edit" size={13} />
        {tt('money.editPlan')}
      </Link>
    ))

  if (plan.loading && !plan.data) return <Loading rows={4} />
  if (!plan.data) return <ErrorState error={plan.error} onRetry={plan.reload} />

  return (
    <div className="stack">
      <ErrorBox error={plan.error} onRetry={plan.reload} />

      <div className={`model ${purchase.moneyModel === 'ESCROW' ? 'model--active' : ''}`}>
        <Icon name={purchase.moneyModel === 'ESCROW' ? 'safe' : 'gate'} size={16} />
        <span className="stack stack--sm">
          <strong>{wt(`money.model.${purchase.moneyModel}`, { market })}</strong>
          <span>{purchase.moneyModel === 'ESCROW' ? tt('money.escrowNote') : tt('money.gateNote')}</span>
        </span>
      </div>

      {installments.length === 0 ? (
        <Card title={tt('money.plan')}>
          <Empty
            title={tt('money.noPlan')}
            text={wt('money.lockedHint')}
            action={
              canPlan ? (
                <Link className="btn btn--primary" to={planPath}>
                  <Icon name="plus" size={15} />
                  {tt('money.editPlan')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Card brass label={wt('money.totalLabel')} badge={<span className="meta">{wt('money.count', { count: installments.length })}</span>} actions={editButton}>
            <div className="ledger">
              <strong className="ledger__total">{formatMoney(plan.data.total)}</strong>
              <Distribution
                hideLegend
                parts={[
                  { tone: 'ok', count: paid, label: wt('money.paidSum') },
                  { tone: 'warn', count: ready, label: wt('money.readySum') },
                  { tone: 'idle', count: locked, label: wt('money.lockedSum') },
                ]}
              />
              <div className="ledger__rows">
                <span className="ledger__row">
                  <span>{wt('money.paidSum')}</span>
                  <span>{formatMoney(paid)}</span>
                </span>
                <span className="ledger__row">
                  <span>{wt('money.readySum')}</span>
                  <span>{formatMoney(ready)}</span>
                </span>
                <span className="ledger__row">
                  <span>{wt('money.lockedSum')}</span>
                  <span>{formatMoney(locked)}</span>
                </span>
              </div>
              {canPlan && <span className="ledger__note">{wt('money.planNote')}</span>}
            </div>
          </Card>

          <div>
            {installments.map((installment) => (
              <InstallmentCard
                key={installment.id}
                purchase={purchase}
                installment={installment}
                documents={documents.data?.items ?? []}
                onDocumentsChanged={documents.reload}
                onChanged={plan.reload}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function InstallmentCard({
  purchase,
  installment,
  documents,
  onDocumentsChanged,
  onChanged,
}: {
  purchase: PurchaseDetail
  installment: Installment
  documents: DocumentItem[]
  onDocumentsChanged: () => void
  onChanged: () => void
}) {
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { t, l, formatMoney, formatDate } = useI18n()
  const { user, can } = useAuth()
  const { get } = useMarkets()
  const definitions = get(purchase.market)?.paymentConditions ?? []
  const phaseTitle = get(purchase.market)?.constructionPhases.find((phase) => phase.code === installment.phaseCode)?.title
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [reporting, setReporting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(null)
    }
  }

  const confirmerRoles = (code: string): readonly Role[] => definitions.find((item) => item.code === code)?.confirmerRoles ?? []
  const roleNames = (roles: readonly Role[]) => roles.map((role) => t(`roleName.${role}`)).join(' · ')
  const mayConfirmByRole = (code: string) => matchesRoles(purchase, confirmerRoles(code), user?.roles ?? [])
  const isBuyer = hasRelation(purchase, 'BUYER')
  const canConfirmPayment =
    can('payments:record') && (isManager(purchase) || (purchase.moneyModel === 'ESCROW' && hasRelation(purchase, 'ESCROW')))

  const late = daysLate(installment)
  const met = installment.conditions.filter((condition) => condition.status === 'MET').length
  const variant = late > 0 ? 'late' : installment.status === 'READY' ? 'ready' : installment.status === 'LOCKED' ? 'locked' : 'paid'
  const signal = statusSignal('installment', installment.status)
  const proofDocument = installment.proofDocumentId ? documents.find((document) => document.id === installment.proofDocumentId) : undefined

  const facts = [
    phaseTitle ? wt('money.phaseLabel', { phase: l(phaseTitle) }) : wt('money.noPhaseShort'),
    installment.paidAt
      ? tt('money.paidAt', { date: formatDate(installment.paidAt) })
      : installment.dueDate
        ? wt('money.dueLabel', { date: formatDate(installment.dueDate) })
        : wt('money.noDue'),
    installment.conditions.length > 0 ? wt('money.conditionsCount', { met, total: installment.conditions.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className={`inst inst--${variant}`}>
      <div className="inst__head">
        <span className="inst__no">{installment.sequence}</span>
        <h3 className="inst__title">
          {installment.label}
          {installment.isFinal && <span className="step__note"> · {tt('money.final')}</span>}
        </h3>
        {late > 0 ? (
          <Chip tone="risk" icon="clock" outline>
            {wt(late % 10 === 1 && late % 100 !== 11 ? 'money.lateOne' : 'money.lateMany', { days: late })}
          </Chip>
        ) : (
          <StatusBadge text={tt(`installment.${installment.status}`)} {...signal} outline={installment.status === 'READY'} />
        )}
        <strong className="inst__amount">{formatMoney(installment.amount)}</strong>
      </div>

      <div className="inst__body">
        <div className="row">
          <span className="meta">{facts}</span>
          {installment.status === 'LOCKED' && installment.conditions.length > 0 && (
            <span className="grow">
              <Progress done={met} total={installment.conditions.length} tone="idle" />
            </span>
          )}
        </div>

        {installment.conditions.length === 0 ? (
          installment.status === 'LOCKED' && <span className="muted">{wt('money.noConditions')}</span>
        ) : (
          <ul className="conds" aria-label={tt('money.conditions')}>
            {installment.conditions.map((condition) => {
              const isMet = condition.status === 'MET'
              const roles = confirmerRoles(condition.code)
              const hasCapability = can('payment-conditions:confirm')
              const byRole = mayConfirmByRole(condition.code)
              const showForm = !isMet && hasCapability && byRole
              const reason = purchase.status !== 'ACTIVE' ? wt('money.notActive') : undefined
              return (
                <li key={condition.code} className={`cond ${isMet ? 'cond--met' : 'cond--open'}`}>
                  <Icon name={isMet ? 'check' : 'clock'} size={14} />
                  <span className="cond__main">
                    <span className="cond__title">{l(condition.title)}</span>
                    {condition.note && <span className="muted small">{condition.note}</span>}
                    {showForm && (
                      <span className="cond__form">
                        <DocumentSelect
                          documents={documents}
                          label={tt('money.evidence')}
                          value={evidence[condition.code] ?? ''}
                          onChange={(id) => setEvidence((current) => ({ ...current, [condition.code]: id }))}
                        />
                        <InfoTip text={tt('form.condition.confirmInfo')} label={tt('money.confirm')} />
                        <Button
                          busy={busy === condition.code}
                          disabled={Boolean(reason) || (busy !== null && busy !== condition.code)}
                          title={reason}
                          onClick={() =>
                            void run(condition.code, () =>
                              purchasesApi.confirmCondition(
                                installment.id,
                                condition.code,
                                evidence[condition.code] ? { evidenceDocumentId: evidence[condition.code] } : {},
                              ),
                            )
                          }
                        >
                          {tt('money.confirm')}
                        </Button>
                      </span>
                    )}
                    {/* Pravo postoji, ali uslov potvrđuje druga uloga: dugme ostaje, uz razlog. */}
                    {!isMet && hasCapability && !byRole && roles.length > 0 && (
                      <span className="cond__form">
                        <button type="button" disabled title={wt('money.notYours', { roles: roleNames(roles) })}>
                          {tt('money.confirm')}
                        </button>
                        <span className="small warn-text">{wt('money.notYours', { roles: roleNames(roles) })}</span>
                      </span>
                    )}
                  </span>
                  <span className="meta cond__meta">
                    {isMet
                      ? condition.confirmedAt && tt('money.confirmedAt', { date: formatDate(condition.confirmedAt) })
                      : roles.length > 0 && wt('money.confirmer', { roles: roleNames(roles) })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {installment.status === 'READY' && (isBuyer || canConfirmPayment || installment.proofDocumentId) && (
          <div className="inst__actions">
            {isBuyer && can('payments:record') && !installment.proofDocumentId && (
              <Button variant="primary" icon="upload" onClick={() => setReporting(true)}>
                {tt('money.reportPaid')}
              </Button>
            )}
            {installment.proofDocumentId && (
              <span className="row">
                <Chip tone="info" icon="doc">
                  {tt('money.proofAttached')}
                </Chip>
                {proofDocument && <DownloadButton document={proofDocument} />}
              </span>
            )}
            {canConfirmPayment && (
              <Button variant="primary" busy={busy === 'confirm'} onClick={() => void run('confirm', () => purchasesApi.recordPayment(installment.id))}>
                {tt('money.confirmPaid')}
              </Button>
            )}
            {isBuyer && <span className="muted small">{wt('money.buyerHint')}</span>}
          </div>
        )}

        {(installment.status === 'PAID' || installment.status === 'RELEASED') && proofDocument && (
          <div className="row row--between">
            <span className="meta">{proofDocument.fileName}</span>
            <DownloadButton document={proofDocument} />
          </div>
        )}

        <ErrorBox error={error} />
      </div>
      {isBuyer && can('payments:record') && (
        <ReportPaymentModal
          purchase={purchase}
          installment={installment}
          open={reporting}
          onClose={() => setReporting(false)}
          onReported={() => {
            onDocumentsChanged()
            onChanged()
          }}
        />
      )}
    </article>
  )
}

/** Prijava uplate: kupac prilaže dokaz o uplati, koordinator je posle potvrđuje. */
function ReportPaymentModal({
  purchase,
  installment,
  open,
  onClose,
  onReported,
}: {
  purchase: PurchaseDetail
  installment: Installment
  open: boolean
  onClose: () => void
  onReported: () => void
}) {
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { formatMoney } = useI18n()
  const upload = useUploadOnce(purchase.id)
  const [file, setFile] = useState<File | null>(null)

  const close = () => {
    setFile(null)
    onClose()
  }

  const submit = async () => {
    if (!file) return
    const document = await upload('PAYMENT_PROOF', file)
    await purchasesApi.recordPayment(installment.id, document.id)
    setFile(null)
    onReported()
  }

  return (
    <FormModal
      open={open}
      onClose={close}
      title={tt('money.reportPaid')}
      description={`${installment.sequence}. ${installment.label} · ${formatMoney(installment.amount)}`}
      submitLabel={tt('money.reportPaid')}
      onSubmit={submit}
      disabledReason={file ? null : wt('money.proofFirst')}
      dirty={Boolean(file)}
    >
      <DocumentFileFields
        purchase={purchase}
        typeCode="PAYMENT_PROOF"
        label={tt('money.payProof')}
        required
        info={tt('form.payment.proofInfo')}
        hint={tt('form.payment.proofHint')}
        onFile={setFile}
      />
      <Notice tone="plain">{wt('money.buyerHint')}</Notice>
    </FormModal>
  )
}

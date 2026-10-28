import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../../core/markets/MarketsContext.tsx'
import { Card, ErrorBox, Field, Loading, StatusBadge } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi, type InstallmentInput } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { DocumentSelect, DocumentUpload, hasRelation, isManager, matchesRoles, usePurchaseT } from '../shared.tsx'
import type { DocumentItem, Installment, InstallmentStatus, PurchaseDetail } from '../types.ts'

function installmentTone(status: InstallmentStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'READY') return 'warn'
  if (status === 'PAID' || status === 'RELEASED') return 'good'
  return 'neutral'
}

export function MoneyTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatMoney } = useI18n()
  const { can } = useAuth()
  const plan = useAsync(() => purchasesApi.plan(purchase.id), [purchase.id])
  const documents = useAsync(() => purchasesApi.documents(purchase.id), [purchase.id])
  const [editing, setEditing] = useState(false)
  const canPlan = can('payments:plan') && isManager(purchase)
  const anyPaid = plan.data?.installments.some((item) => item.status === 'PAID' || item.status === 'RELEASED') ?? false

  return (
    <>
      <Card>
        <p>{purchase.moneyModel === 'ESCROW' ? tt('money.escrowNote') : tt('money.gateNote')}</p>
      </Card>
      <Card
        title={tt('money.plan')}
        actions={
          canPlan &&
          !editing && (
            <button type="button" disabled={anyPaid} title={anyPaid ? tt('money.planLocked') : undefined} onClick={() => setEditing(true)}>
              {tt('money.editPlan')}
            </button>
          )
        }
      >
        <ErrorBox error={plan.error} />
        {plan.loading && !plan.data && <Loading />}
        {plan.data && !editing && plan.data.installments.length === 0 && <p className="muted">{tt('money.noPlan')}</p>}
        {plan.data && plan.data.installments.length > 0 && !editing && (
          <p className="muted">{tt('money.total', { amount: formatMoney(plan.data.total) })}</p>
        )}
        {editing && plan.data && (
          <PlanEditor
            purchase={purchase}
            initial={plan.data.installments}
            onDone={() => {
              setEditing(false)
              plan.reload()
            }}
          />
        )}
      </Card>
      {!editing &&
        plan.data?.installments.map((installment) => (
          <InstallmentCard
            key={installment.id}
            purchase={purchase}
            installment={installment}
            documents={documents.data ?? []}
            onDocumentsChanged={documents.reload}
            onChanged={plan.reload}
          />
        ))}
    </>
  )
}

function PlanEditor({ purchase, initial, onDone }: { purchase: PurchaseDetail; initial: Installment[]; onDone: () => void }) {
  const tt = usePurchaseT()
  const { t, l } = useI18n()
  const { get } = useMarkets()
  const phases = get(purchase.market)?.constructionPhases ?? []
  const [rows, setRows] = useState<{ label: string; amount: string; phaseCode: string; dueDate: string }[]>(
    initial.length > 0
      ? initial.map((item) => ({ label: item.label, amount: String(item.amount), phaseCode: item.phaseCode ?? '', dueDate: item.dueDate ?? '' }))
      : [{ label: '', amount: '', phaseCode: '', dueDate: '' }],
  )
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const update = (index: number, key: keyof (typeof rows)[number], value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))

  const valid = rows.length > 0 && rows.every((row) => row.label.trim() && Number.isInteger(Number(row.amount)) && Number(row.amount) > 0)

  const save = async () => {
    const installments: InstallmentInput[] = rows.map((row) => ({
      label: row.label.trim(),
      amount: Number(row.amount),
      ...(row.phaseCode ? { phaseCode: row.phaseCode } : {}),
      ...(row.dueDate ? { dueDate: row.dueDate } : {}),
    }))
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.replacePlan(purchase.id, installments)
      onDone()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {rows.map((row, index) => (
        <div key={index} className="grid" style={{ alignItems: 'end', marginBottom: 8 }}>
          <Field label={`${index + 1}. ${tt('money.label')}`}>
            <input value={row.label} maxLength={200} onChange={(event) => update(index, 'label', event.target.value)} />
          </Field>
          <Field label={tt('money.amount')}>
            <input type="number" min={1} step={1} value={row.amount} onChange={(event) => update(index, 'amount', event.target.value)} />
          </Field>
          <Field label={tt('money.phase')}>
            <select value={row.phaseCode} onChange={(event) => update(index, 'phaseCode', event.target.value)}>
              <option value="">{tt('money.noPhase')}</option>
              {phases.map((phase) => (
                <option key={phase.code} value={phase.code}>
                  {l(phase.title)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tt('money.due')}>
            <input type="date" value={row.dueDate} onChange={(event) => update(index, 'dueDate', event.target.value)} />
          </Field>
          <button type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={rows.length === 1}>
            {t('common.remove')}
          </button>
        </div>
      ))}
      <div className="row">
        <button type="button" onClick={() => setRows((current) => [...current, { label: '', amount: '', phaseCode: '', dueDate: '' }])}>
          {tt('money.addRow')}
        </button>
        <button type="button" className="primary" disabled={!valid || busy} onClick={() => void save()}>
          {tt('money.savePlan')}
        </button>
        <button type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
      <ErrorBox error={error} />
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
  const { l, formatMoney, formatDate } = useI18n()
  const { user, can } = useAuth()
  const { get } = useMarkets()
  const definitions = get(purchase.market)?.paymentConditions ?? []
  const phaseTitle = get(purchase.market)?.constructionPhases.find((phase) => phase.code === installment.phaseCode)?.title
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [proof, setProof] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const canConfirm = (code: string) => {
    const definition = definitions.find((item) => item.code === code)
    return (
      can('payment-conditions:confirm') &&
      definition !== undefined &&
      matchesRoles(purchase, definition.confirmerRoles, user?.roles ?? []) &&
      purchase.status === 'ACTIVE'
    )
  }
  const isBuyer = hasRelation(purchase, 'BUYER')
  const canConfirmPayment =
    can('payments:record') && (isManager(purchase) || (purchase.moneyModel === 'ESCROW' && hasRelation(purchase, 'ESCROW')))

  return (
    <Card title={`${installment.sequence}. ${installment.label}`}>
      <div className="row">
        <strong>{formatMoney(installment.amount)}</strong>
        <StatusBadge text={tt(`installment.${installment.status}`)} tone={installmentTone(installment.status)} />
        {installment.isFinal && <span className="muted">{tt('money.final')}</span>}
        {phaseTitle && <span className="muted">· {l(phaseTitle)}</span>}
        {installment.dueDate && <span className="muted">· {formatDate(installment.dueDate)}</span>}
        {installment.paidAt && <span className="muted">· {tt('money.paidAt', { date: formatDate(installment.paidAt) })}</span>}
      </div>

      <h3 style={{ fontSize: '1em' }}>{tt('money.conditions')}</h3>
      <ul style={{ paddingLeft: 18 }}>
        {installment.conditions.map((condition) => (
          <li key={condition.code} style={{ marginBottom: 6 }}>
            <div className="row">
              <span>{l(condition.title)}</span>
              <StatusBadge text={tt(`condition.${condition.status}`)} tone={condition.status === 'MET' ? 'good' : 'neutral'} />
              {condition.confirmedAt && <span className="muted">{tt('money.confirmedAt', { date: formatDate(condition.confirmedAt) })}</span>}
            </div>
            {condition.note && <div className="muted">{condition.note}</div>}
            {condition.status === 'PENDING' && canConfirm(condition.code) && (
              <div className="row" style={{ marginTop: 4 }}>
                <DocumentSelect
                  documents={documents}
                  label={tt('money.evidence')}
                  value={evidence[condition.code] ?? ''}
                  onChange={(id) => setEvidence((current) => ({ ...current, [condition.code]: id }))}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      purchasesApi.confirmCondition(
                        installment.id,
                        condition.code,
                        evidence[condition.code] ? { evidenceDocumentId: evidence[condition.code] } : {},
                      ),
                    )
                  }
                >
                  {tt('money.confirm')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {installment.status === 'READY' && isBuyer && can('payments:record') && !installment.proofDocumentId && (
        <div>
          <Field label={tt('money.payProof')}>
            <DocumentUpload purchase={purchase} typeCode="PAYMENT_PROOF" onUploaded={(document) => {
              setProof(document.id)
              onDocumentsChanged()
            }} />
          </Field>
          <button type="button" className="primary" disabled={!proof || busy} onClick={() => void run(() => purchasesApi.recordPayment(installment.id, proof))}>
            {tt('money.reportPaid')}
          </button>
        </div>
      )}
      {installment.status === 'READY' && installment.proofDocumentId && <p className="muted">{tt('money.proofAttached')}</p>}
      {installment.status === 'READY' && canConfirmPayment && (
        <button type="button" className="primary" disabled={busy} onClick={() => void run(() => purchasesApi.recordPayment(installment.id))}>
          {tt('money.confirmPaid')}
        </button>
      )}
      <ErrorBox error={error} />
    </Card>
  )
}

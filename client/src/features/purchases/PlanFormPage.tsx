import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Button, Field, FormSection, InfoTip, Notice } from '../../ui/components.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { Icon } from '../../ui/icons.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi, type InstallmentInput } from './api.ts'
import { useWorkspaceT } from './PurchaseDetailPage.tsx'
import { isManager, usePurchaseT } from './shared.tsx'

interface PlanRow {
  label: string
  amount: string
  phaseCode: string
  dueDate: string
}

const EMPTY_ROW: PlanRow = { label: '', amount: '', phaseCode: '', dueDate: '' }

/**
 * Plan rata kupovine (`/purchases/:id/plan`): dinamički redovi (opis, iznos,
 * faza, rok). Plan se menja samo dok nijedna rata nije plaćena. Posle uspeha
 * vraća na karticu „Novac”.
 */
export function PlanFormPage() {
  const { id = '' } = useParams()
  const tt = usePurchaseT()
  const wt = useWorkspaceT()
  const { l, formatMoney } = useI18n()
  const { can } = useAuth()
  const { get } = useMarkets()
  const loaded = useAsync(async () => {
    const [purchase, plan] = await Promise.all([purchasesApi.detail(id), purchasesApi.plan(id)])
    return { purchase, plan }
  }, [id])
  const [rows, setRows] = useState<PlanRow[]>([EMPTY_ROW])

  // Postojeći plan puni obrazac jednom, kad stigne.
  useEffect(() => {
    const installments = loaded.data?.plan.installments
    if (!installments) return
    setRows(
      installments.length > 0
        ? installments.map((item) => ({ label: item.label, amount: String(item.amount), phaseCode: item.phaseCode ?? '', dueDate: item.dueDate ?? '' }))
        : [EMPTY_ROW],
    )
  }, [loaded.data])

  const purchase = loaded.data?.purchase
  const phases = purchase ? (get(purchase.market)?.constructionPhases ?? []) : []
  const conditionDefs = purchase ? (get(purchase.market)?.paymentConditions ?? []) : []
  // Uslovi koje server veže za ratu po položaju i fazi (isto pravilo kao na serveru); samo za prikaz.
  const conditionsFor = (index: number, phaseCode: string) =>
    conditionDefs
      .filter((definition) => {
        if (definition.appliesTo === 'FIRST') return index === 0
        if (definition.appliesTo === 'EVERY') return true
        if (definition.appliesTo === 'PHASE') return phaseCode !== ''
        return index === rows.length - 1
      })
      .map((definition) => l(definition.title))
  const anyPaid = loaded.data?.plan.installments.some((item) => item.status === 'PAID' || item.status === 'RELEASED') ?? false
  const canPlan = purchase !== undefined && can('payments:plan') && isManager(purchase)
  const backTo = `/purchases/${id}?tab=money`

  const update = (index: number, key: keyof PlanRow, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  const amountValid = (value: string) => value !== '' && Number.isInteger(Number(value)) && Number(value) > 0
  const valid = rows.length > 0 && rows.every((row) => row.label.trim() && amountValid(row.amount))
  // Zbir rata mora biti tačno cena stana (server isto proverava).
  const planTotal = rows.reduce((sum, row) => sum + (amountValid(row.amount) ? Number(row.amount) : 0), 0)
  const unitPrice = purchase?.unit.price ?? 0
  const difference = unitPrice - planTotal

  const lockReason = !canPlan ? tt('money.planNoRight') : anyPaid ? tt('money.planLocked') : null
  const totalReason = valid && difference !== 0 ? wt('money.totalMismatch', { total: formatMoney(planTotal), price: formatMoney(unitPrice) }) : null

  const submit = async () => {
    const installments: InstallmentInput[] = rows.map((row) => ({
      label: row.label.trim(),
      amount: Number(row.amount),
      ...(row.phaseCode ? { phaseCode: row.phaseCode } : {}),
      ...(row.dueDate ? { dueDate: row.dueDate } : {}),
    }))
    await purchasesApi.replacePlan(id, installments)
    return backTo
  }

  const crumbs = [
    { label: tt('list.title'), to: '/purchases' },
    ...(purchase ? [{ label: `${purchase.project.name} · ${tt('detail.unit', { label: purchase.unit.label })}`, to: backTo }] : []),
    { label: tt('money.plan') },
  ]

  return (
    <FormPage
      title={tt('money.plan')}
      description={tt('form.plan.description')}
      crumbs={crumbs}
      backTo={backTo}
      onSubmit={submit}
      submitLabel={tt('money.savePlan')}
      disabledReason={lockReason ?? (valid ? totalReason : wt('money.invalidPlan'))}
      loading={loaded.loading && !loaded.data}
      loadError={loaded.data ? null : loaded.error}
      onRetry={loaded.reload}
      intro={
        lockReason ? (
          <Notice tone="warn" icon="lock">
            {lockReason}
          </Notice>
        ) : (
          <Notice tone="plain">{wt('money.planNote')}</Notice>
        )
      }
    >
      <FormSection title={tt('form.plan.rowsTitle')} description={tt('form.plan.rowsHint')} columns={1}>
        <div className="stack">
          {rows.map((row, index) => {
            const conditions = conditionsFor(index, row.phaseCode)
            const isFinal = index === rows.length - 1 && rows.length > 1
            return (
              <div key={index} className="plan-row">
                <span className="inst__no">{index + 1}</span>
                <div className="plan-row__fields">
                  <Field
                    label={tt('money.label')}
                    required
                    info={conditions.length > 0 ? tt('form.plan.conditionsFor', { list: conditions.join(', ') }) : tt('form.plan.noConditions')}
                    hint={index === 0 ? tt('form.plan.labelHint') : isFinal ? tt('form.plan.finalTag') : undefined}
                  >
                    <input value={row.label} maxLength={200} onChange={(event) => update(index, 'label', event.target.value)} />
                  </Field>
                  <Field
                    label={tt('form.plan.amount')}
                    required
                    suffix="€"
                    info={tt('form.plan.amountInfo')}
                    error={row.amount !== '' && !amountValid(row.amount) ? wt('money.invalidPlan') : null}
                  >
                    <input
                      type="number"
                      className="num"
                      min={1}
                      step={1}
                      value={row.amount}
                      onChange={(event) => update(index, 'amount', event.target.value)}
                    />
                  </Field>
                  <Field label={tt('money.phase')} info={tt('form.plan.phaseInfo')}>
                    <select value={row.phaseCode} onChange={(event) => update(index, 'phaseCode', event.target.value)}>
                      <option value="">{tt('money.noPhase')}</option>
                      {phases.map((phase) => (
                        <option key={phase.code} value={phase.code}>
                          {l(phase.title)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tt('money.due')} info={tt('form.plan.dueInfo')}>
                    <input type="date" value={row.dueDate} onChange={(event) => update(index, 'dueDate', event.target.value)} />
                  </Field>
                </div>
                <button
                  type="button"
                  className="icon"
                  aria-label={wt('money.removeRow', { n: index + 1 })}
                  title={rows.length === 1 ? wt('money.lastRow') : wt('money.removeRow', { n: index + 1 })}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  disabled={rows.length === 1}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            )
          })}
          <div className="row">
            <Button icon="plus" onClick={() => setRows((current) => [...current, EMPTY_ROW])}>
              {tt('money.addRow')}
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection title={tt('form.plan.totalTitle')} description={tt('form.plan.totalHint')} columns={1}>
        <div className="ledger plan-total">
          <span className="ledger__row">
            <span className="row">
              {wt('money.planSum')}
              <InfoTip text={tt('form.plan.totalInfo')} />
            </span>
            <span>{formatMoney(planTotal)}</span>
          </span>
          <span className="ledger__row">
            <span>{wt('money.unitPrice')}</span>
            <span>{formatMoney(unitPrice)}</span>
          </span>
          {difference !== 0 && (
            <span className={`ledger__row ${difference > 0 ? 'warn-text' : 'text-risk'}`}>
              <span>{difference > 0 ? wt('money.remaining') : wt('money.overPrice')}</span>
              <span>{formatMoney(Math.abs(difference))}</span>
            </span>
          )}
        </div>
      </FormSection>
    </FormPage>
  )
}

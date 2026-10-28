import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, StatusBadge } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, isManager, usePurchaseT } from '../shared.tsx'
import type { DefectSeverity, DefectStatus } from '../types.ts'

const SEVERITIES: DefectSeverity[] = ['MINOR', 'MAJOR', 'CRITICAL']

function defectTone(status: DefectStatus): 'good' | 'warn' | 'bad' {
  if (status === 'CONFIRMED') return 'good'
  if (status === 'FIXED') return 'warn'
  return 'bad'
}

export function HandoverTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate, formatNumber } = useI18n()
  const { can } = useAuth()
  const data = useAsync(() => purchasesApi.handover(purchase.id), [purchase.id])
  const isEngineer = hasRelation(purchase, 'ENGINEER')
  const canRecord = can('handover:manage') && isEngineer && !data.data?.handover?.keysHandedAt
  const canKeys = can('defects:manage') && (isManager(purchase) || isEngineer)
  const canAddDefect = can('defects:manage')
  const canFix = can('defects:manage') && isManager(purchase)
  const canConfirmFix = can('defects:manage') && hasRelation(purchase, 'BUYER', 'ENGINEER')

  const [form, setForm] = useState({ inspectedAt: '', contractArea: String(purchase.unit.area), measuredArea: '', notes: '' })
  const [defect, setDefect] = useState<{ description: string; severity: DefectSeverity; dueDate: string }>({
    description: '',
    severity: 'MINOR',
    dueDate: '',
  })
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      after?.()
      data.reload()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  const handover = data.data?.handover
  const contractArea = Number(form.contractArea)
  const measuredArea = Number(form.measuredArea)
  const formValid = Boolean(form.inspectedAt) && contractArea > 0 && measuredArea > 0

  return (
    <>
      <Card title={tt('handover.title')}>
        <ErrorBox error={data.error} />
        {data.loading && !data.data && <Loading />}
        {data.data && !handover && <p className="muted">{tt('handover.none')}</p>}
        {handover && (
          <div>
            <p>
              {formatDate(handover.inspectedAt)} · {tt('handover.contractArea')}: {formatNumber(handover.contractArea, 2)} ·{' '}
              {tt('handover.measuredArea')}: {formatNumber(handover.measuredArea, 2)}
            </p>
            <p>
              <StatusBadge
                text={tt('handover.difference', {
                  diff: formatNumber(handover.areaDifference, 2),
                  percent: formatNumber(handover.areaDifferencePercent, 2),
                })}
                tone={handover.areaDifference < 0 ? 'bad' : 'good'}
              />
            </p>
            {handover.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{handover.notes}</p>}
          </div>
        )}
        {canRecord && (
          <div style={{ marginTop: 10 }}>
            <div className="grid">
              <Field label={tt('handover.inspectedAt')}>
                <input type="date" value={form.inspectedAt} onChange={(event) => setForm({ ...form, inspectedAt: event.target.value })} />
              </Field>
              <Field label={tt('handover.contractArea')}>
                <input type="number" step="0.01" min={1} value={form.contractArea} onChange={(event) => setForm({ ...form, contractArea: event.target.value })} />
              </Field>
              <Field label={tt('handover.measuredArea')}>
                <input type="number" step="0.01" min={1} value={form.measuredArea} onChange={(event) => setForm({ ...form, measuredArea: event.target.value })} />
              </Field>
            </div>
            <Field label={tt('handover.notes')}>
              <textarea value={form.notes} maxLength={5000} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
            <button
              type="button"
              className="primary"
              disabled={!formValid || busy}
              onClick={() =>
                void run(() =>
                  purchasesApi.recordHandover(purchase.id, {
                    inspectedAt: new Date(`${form.inspectedAt}T12:00:00Z`).toISOString(),
                    contractArea,
                    measuredArea,
                    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
                  }),
                )
              }
            >
              {tt('handover.save')}
            </button>
          </div>
        )}
      </Card>

      <Card title={tt('handover.keys')}>
        {handover?.keysHandedAt ? (
          <p>{tt('handover.keysHanded', { date: formatDate(handover.keysHandedAt) })}</p>
        ) : (
          canKeys &&
          handover && (
            <button type="button" disabled={busy} onClick={() => void run(() => purchasesApi.handOverKeys(purchase.id))}>
              {tt('handover.handKeys')}
            </button>
          )
        )}
      </Card>

      <Card title={tt('defects.title')}>
        {data.data && data.data.defects.length === 0 && <Empty />}
        {data.data?.defects.map((item) => (
          <div key={item.id} style={{ marginBottom: 10 }}>
            <div className="row">
              <StatusBadge text={tt(`defectStatus.${item.status}`)} tone={defectTone(item.status)} />
              <span className="muted">{tt(`severity.${item.severity}`)}</span>
              {item.dueDate && <span className="muted">· {formatDate(item.dueDate)}</span>}
            </div>
            <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{item.description}</p>
            <div className="row">
              {item.status === 'OPEN' && canFix && (
                <button type="button" disabled={busy} onClick={() => void run(() => purchasesApi.updateDefect(item.id, 'FIXED'))}>
                  {tt('defects.markFixed')}
                </button>
              )}
              {item.status === 'FIXED' && canConfirmFix && (
                <button type="button" disabled={busy} onClick={() => void run(() => purchasesApi.updateDefect(item.id, 'CONFIRMED'))}>
                  {tt('defects.confirm')}
                </button>
              )}
            </div>
          </div>
        ))}
        {canAddDefect && (
          <div style={{ marginTop: 10 }}>
            <Field label={tt('defects.description')}>
              <textarea value={defect.description} maxLength={1000} onChange={(event) => setDefect({ ...defect, description: event.target.value })} />
            </Field>
            <div className="grid">
              <Field label={tt('defects.severity')}>
                <select value={defect.severity} onChange={(event) => setDefect({ ...defect, severity: event.target.value as DefectSeverity })}>
                  {SEVERITIES.map((value) => (
                    <option key={value} value={value}>
                      {tt(`severity.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tt('defects.due')}>
                <input type="date" value={defect.dueDate} onChange={(event) => setDefect({ ...defect, dueDate: event.target.value })} />
              </Field>
            </div>
            <button
              type="button"
              disabled={defect.description.trim().length < 3 || busy}
              onClick={() =>
                void run(
                  () =>
                    purchasesApi.createDefect(purchase.id, {
                      description: defect.description.trim(),
                      severity: defect.severity,
                      ...(defect.dueDate ? { dueDate: defect.dueDate } : {}),
                    }),
                  () => setDefect({ description: '', severity: 'MINOR', dueDate: '' }),
                )
              }
            >
              {tt('defects.add')}
            </button>
          </div>
        )}
      </Card>
      <ErrorBox error={error} />
    </>
  )
}

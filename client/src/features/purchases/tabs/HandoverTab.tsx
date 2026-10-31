import { useEffect, useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Button, Card, Chip, Empty, ErrorBox, Field, FormSection, Loading, StatusBadge } from '../../../ui/components.tsx'
import { DataTable, type Column } from '../../../ui/DataTable.tsx'
import { ConfirmDialog, FormModal } from '../../../ui/Modal.tsx'
import { statusSignal } from '../../../ui/status.ts'
import { useAsync } from '../../../ui/useAsync.ts'
import { useClientPagination } from '../../../ui/usePagination.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, isAdmin, isManager, usePurchaseT } from '../shared.tsx'
import type { Defect, DefectSeverity, Handover, PurchaseDetail } from '../types.ts'

const SEVERITIES: DefectSeverity[] = ['MINOR', 'MAJOR', 'CRITICAL']

/** Primopredaja: zapisnik pregleda (modal), predaja ključeva (potvrda) i nedostaci (tabela). */
export function HandoverTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { formatDate, formatNumber } = useI18n()
  const { can } = useAuth()
  const data = useAsync(() => purchasesApi.handover(purchase.id), [purchase.id])
  const defects = useClientPagination(data.data?.defects)
  // Admin na tržištu sme sve što i inženjer.
  const isEngineer = hasRelation(purchase, 'ENGINEER') || isAdmin(purchase)
  const canRecord = can('handover:manage') && isEngineer && !data.data?.handover?.keysHandedAt
  const canKeys = can('defects:manage') && (isManager(purchase) || isEngineer)
  const canAddDefect = can('defects:manage')
  const canFix = can('defects:manage') && isManager(purchase)
  const canConfirmFix = can('defects:manage') && (hasRelation(purchase, 'BUYER') || isEngineer)

  const [recording, setRecording] = useState(false)
  const [keys, setKeys] = useState(false)
  const [addingDefect, setAddingDefect] = useState(false)
  const [busyDefect, setBusyDefect] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const updateDefect = async (id: string, status: 'FIXED' | 'CONFIRMED') => {
    setBusyDefect(id)
    setError(null)
    try {
      await purchasesApi.updateDefect(id, status)
      data.reload()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusyDefect(null)
    }
  }

  const handover = data.data?.handover

  const columns: Column<Defect>[] = [
    {
      key: 'description',
      header: tt('defects.description'),
      cell: (item) => (
        <span className="cell-title">
          <span className="pre">{item.description}</span>
        </span>
      ),
    },
    {
      key: 'severity',
      header: tt('defects.severity'),
      cell: (item) => <StatusBadge text={tt(`severity.${item.severity}`)} {...statusSignal('defectSeverity', item.severity)} />,
    },
    {
      key: 'status',
      header: tt('defects.statusLabel'),
      cell: (item) => <StatusBadge text={tt(`defectStatus.${item.status}`)} {...statusSignal('defect', item.status)} />,
    },
    { key: 'due', header: tt('defects.due'), mono: true, hideOnMobile: true, cell: (item) => (item.dueDate ? formatDate(item.dueDate) : '—') },
  ]

  return (
    <div className="stack">
      <Card
        title={tt('handover.title')}
        actions={
          canRecord && (
            <Button size="sm" variant={handover ? 'secondary' : 'primary'} icon={handover ? 'edit' : 'plus'} onClick={() => setRecording(true)}>
              {handover ? tt('handover.edit') : tt('handover.record')}
            </Button>
          )
        }
      >
        <ErrorBox error={data.error} onRetry={data.reload} />
        {data.loading && !data.data && !data.error && <Loading />}
        {data.data && !handover && <Empty text={tt('handover.none')} />}
        {handover && (
          <dl className="dl">
            <dt>{tt('handover.inspected')}</dt>
            <dd className="mono">{formatDate(handover.inspectedAt)}</dd>
            <dt>{tt('handover.contractArea')}</dt>
            <dd>
              <span className="num">{formatNumber(handover.contractArea, 2)}</span>
            </dd>
            <dt>{tt('handover.measuredArea')}</dt>
            <dd>
              <span className="num">{formatNumber(handover.measuredArea, 2)}</span>
            </dd>
            <dt>{tt('handover.differenceLabel')}</dt>
            <dd>
              <StatusBadge
                text={`${formatNumber(handover.areaDifference, 2)} m² (${formatNumber(handover.areaDifferencePercent, 2)}%)`}
                tone={handover.areaDifference < 0 ? 'risk' : 'ok'}
              />
            </dd>
            {handover.notes && (
              <>
                <dt>{tt('handover.notes')}</dt>
                <dd className="pre">{handover.notes}</dd>
              </>
            )}
          </dl>
        )}
      </Card>

      <Card title={tt('handover.keys')}>
        {handover?.keysHandedAt ? (
          <Chip tone="ok" icon="check">
            {tt('handover.keysHanded', { date: formatDate(handover.keysHandedAt) })}
          </Chip>
        ) : canKeys ? (
          <div className="stack stack--sm">
            <div className="row">
              <Button disabled={!handover} title={handover ? undefined : tt('handover.keysNeedInspection')} onClick={() => setKeys(true)}>
                {tt('handover.handKeys')}
              </Button>
            </div>
            {!handover && data.data && <span className="field-hint">{tt('handover.keysNeedInspection')}</span>}
          </div>
        ) : (
          <p className="muted">{tt('handover.keysPending')}</p>
        )}
      </Card>

      <ErrorBox error={error} />
      <DataTable
        title={tt('defects.title')}
        badge={data.data && data.data.defects.length > 0 ? <span className="count">{data.data.defects.length}</span> : undefined}
        actions={
          canAddDefect && (
            <Button variant="primary" size="sm" icon="plus" onClick={() => setAddingDefect(true)}>
              {tt('defects.add')}
            </Button>
          )
        }
        caption={tt('defects.title')}
        columns={columns}
        rows={defects.rows}
        rowKey={(item) => item.id}
        loading={data.loading}
        error={data.error}
        onRetry={data.reload}
        pagination={defects.pagination}
        empty={tt('defects.none')}
        rowClassName={(item) => (item.status === 'OPEN' && item.severity === 'CRITICAL' ? 'row--risk' : undefined)}
        rowActions={(item) =>
          item.status === 'OPEN' && canFix ? (
            <Button size="sm" busy={busyDefect === item.id} disabled={busyDefect !== null} onClick={() => void updateDefect(item.id, 'FIXED')}>
              {tt('defects.markFixed')}
            </Button>
          ) : item.status === 'FIXED' && canConfirmFix ? (
            <Button
              size="sm"
              icon="check"
              busy={busyDefect === item.id}
              disabled={busyDefect !== null}
              onClick={() => void updateDefect(item.id, 'CONFIRMED')}
            >
              {tt('defects.confirm')}
            </Button>
          ) : null
        }
      />

      {canRecord && <HandoverModal purchase={purchase} existing={handover ?? null} open={recording} onClose={() => setRecording(false)} onSaved={data.reload} />}
      {canAddDefect && <DefectModal purchaseId={purchase.id} open={addingDefect} onClose={() => setAddingDefect(false)} onSaved={data.reload} />}
      <ConfirmDialog
        open={keys}
        onClose={() => setKeys(false)}
        title={tt('handover.keysTitle')}
        text={tt('handover.keysConfirm')}
        confirmLabel={tt('handover.handKeys')}
        onConfirm={async () => {
          await purchasesApi.handOverKeys(purchase.id)
          data.reload()
        }}
      />
    </div>
  )
}

/** Zapisnik pregleda i merenja: datum, površina iz ugovora, izmerena površina, napomene. */
function HandoverModal({
  purchase,
  existing,
  open,
  onClose,
  onSaved,
}: {
  purchase: PurchaseDetail
  /** Postojeći zapisnik puni obrazac (ponovni pregled). */
  existing: Handover | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const tt = usePurchaseT()
  const { formatNumber } = useI18n()
  const [form, setForm] = useState({ inspectedAt: '', contractArea: String(purchase.unit.area), measuredArea: '', notes: '' })

  useEffect(() => {
    if (!open) return
    setForm(
      existing
        ? {
            inspectedAt: existing.inspectedAt.slice(0, 10),
            contractArea: String(existing.contractArea),
            measuredArea: String(existing.measuredArea),
            notes: existing.notes ?? '',
          }
        : { inspectedAt: '', contractArea: String(purchase.unit.area), measuredArea: '', notes: '' },
    )
  }, [open, existing, purchase.unit.area])

  const contractArea = Number(form.contractArea)
  const measuredArea = Number(form.measuredArea)
  const valid = Boolean(form.inspectedAt) && contractArea > 0 && measuredArea > 0

  const submit = async () => {
    await purchasesApi.recordHandover(purchase.id, {
      inspectedAt: new Date(`${form.inspectedAt}T12:00:00Z`).toISOString(),
      contractArea,
      measuredArea,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    })
    onSaved()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tt('handover.title')}
      description={tt('form.handover.description')}
      size="lg"
      submitLabel={tt('handover.save')}
      onSubmit={submit}
      disabledReason={valid ? null : tt('handover.recordRequired')}
      dirty={Boolean(form.inspectedAt || form.measuredArea || form.notes)}
    >
      <FormSection title={tt('form.handover.dateTitle')} description={tt('form.handover.dateHint')} columns={2}>
        <Field label={tt('handover.inspectedAt')} required>
          <input type="date" value={form.inspectedAt} onChange={(event) => setForm({ ...form, inspectedAt: event.target.value })} />
        </Field>
      </FormSection>
      <FormSection title={tt('form.handover.areaTitle')} description={tt('form.handover.areaHint')} columns={2}>
        <Field label={tt('form.handover.contractArea')} required suffix="m²" info={tt('form.handover.contractInfo')}>
          <input
            type="number"
            className="num"
            step="0.01"
            min={1}
            value={form.contractArea}
            onChange={(event) => setForm({ ...form, contractArea: event.target.value })}
          />
        </Field>
        <Field
          label={tt('form.handover.measuredArea')}
          required
          suffix="m²"
          info={tt('form.handover.measuredInfo')}
          hint={
            contractArea > 0 && measuredArea > 0
              ? tt('handover.difference', {
                  diff: formatNumber(measuredArea - contractArea, 2),
                  percent: formatNumber(((measuredArea - contractArea) / contractArea) * 100, 2),
                })
              : undefined
          }
        >
          <input
            type="number"
            className="num"
            step="0.01"
            min={1}
            value={form.measuredArea}
            onChange={(event) => setForm({ ...form, measuredArea: event.target.value })}
          />
        </Field>
        <Field label={tt('handover.notes')} info={tt('form.handover.notesInfo')} hint={`${formatNumber(form.notes.length)} / ${formatNumber(5000)}`} wide>
          <textarea value={form.notes} rows={3} maxLength={5000} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Field>
      </FormSection>
    </FormModal>
  )
}

/** Nov nedostatak: opis, ozbiljnost i rok za otklanjanje. */
function DefectModal({ purchaseId, open, onClose, onSaved }: { purchaseId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const tt = usePurchaseT()
  const { formatNumber } = useI18n()
  const [defect, setDefect] = useState<{ description: string; severity: DefectSeverity; dueDate: string }>({
    description: '',
    severity: 'MINOR',
    dueDate: '',
  })

  useEffect(() => {
    if (open) setDefect({ description: '', severity: 'MINOR', dueDate: '' })
  }, [open])

  const valid = defect.description.trim().length >= 3

  const submit = async () => {
    await purchasesApi.createDefect(purchaseId, {
      description: defect.description.trim(),
      severity: defect.severity,
      ...(defect.dueDate ? { dueDate: defect.dueDate } : {}),
    })
    onSaved()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tt('defects.add')}
      description={tt('form.defect.description')}
      submitLabel={tt('defects.add')}
      onSubmit={submit}
      disabledReason={valid ? null : tt('defects.required')}
      dirty={defect.description.length > 0}
    >
      <Field
        label={tt('defects.description')}
        required
        hint={`${formatNumber(defect.description.length)} / ${formatNumber(1000)}`}
        error={defect.description.length > 0 && !valid ? tt('defects.required') : null}
      >
        <textarea
          value={defect.description}
          rows={3}
          maxLength={1000}
          onChange={(event) => setDefect({ ...defect, description: event.target.value })}
        />
      </Field>
      <div className="grid">
        <Field label={tt('defects.severity')} required info={tt('form.defect.severityInfo')}>
          <select value={defect.severity} onChange={(event) => setDefect({ ...defect, severity: event.target.value as DefectSeverity })}>
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {tt(`severity.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tt('defects.due')} info={tt('form.defect.dueInfo')}>
          <input type="date" value={defect.dueDate} onChange={(event) => setDefect({ ...defect, dueDate: event.target.value })} />
        </Field>
      </div>
    </FormModal>
  )
}

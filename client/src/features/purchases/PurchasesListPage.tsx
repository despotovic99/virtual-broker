import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { purchasesApi } from './api.ts'
import { usePurchaseT } from './shared.tsx'
import type { PurchaseStatus } from './types.ts'

const STATUSES: PurchaseStatus[] = ['ACTIVE', 'BLOCKED', 'COMPLETED', 'CANCELLED']

export function statusTone(status: PurchaseStatus): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'ACTIVE') return 'good'
  if (status === 'BLOCKED') return 'bad'
  if (status === 'COMPLETED') return 'neutral'
  return 'warn'
}

export function PurchasesListPage() {
  const tt = usePurchaseT()
  const { t, l, formatMoney, formatDate } = useI18n()
  const { can } = useAuth()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<PurchaseStatus | ''>('')
  const [showNew, setShowNew] = useState(Boolean(searchParams.get('requestId')))
  const { data, error, loading } = useAsync(() => purchasesApi.list({ status, limit: 100 }), [status])

  return (
    <Page
      title={tt('list.title')}
      actions={
        can('purchases:manage') && (
          <button type="button" className="primary" onClick={() => setShowNew((value) => !value)}>
            {tt('list.new')}
          </button>
        )
      }
    >
      {showNew && can('purchases:manage') && <NewPurchaseForm initialRequestId={searchParams.get('requestId') ?? ''} />}

      <div className="row" style={{ marginBottom: 12 }}>
        <select aria-label={t('common.status')} value={status} onChange={(event) => setStatus(event.target.value as PurchaseStatus | '')}>
          <option value="">{tt('list.allStatuses')}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {tt(`status.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && <Empty />}
      {data && data.items.length > 0 && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{tt('list.project')}</th>
                  <th>{t('common.market')}</th>
                  <th>{t('common.status')}</th>
                  <th>{tt('list.currentStep')}</th>
                  <th>{tt('list.price')}</th>
                  <th>{tt('list.created')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/purchases/${item.id}`}>
                        {item.projectName} · {tt('detail.unit', { label: item.unitLabel })}
                      </Link>
                      <div className="muted">{item.city}</div>
                    </td>
                    <td>{t(`market.${item.market}`)}</td>
                    <td>
                      <StatusBadge text={tt(`status.${item.status}`)} tone={statusTone(item.status)} />
                    </td>
                    <td>{item.currentStep ? `${item.currentStep.code} · ${l(item.currentStep.title)}` : tt('list.done')}</td>
                    <td>{formatMoney(item.price)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function NewPurchaseForm({ initialRequestId }: { initialRequestId: string }) {
  const tt = usePurchaseT()
  const navigate = useNavigate()
  const [requestId, setRequestId] = useState(initialRequestId)
  const [buyerId, setBuyerId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const valid = UUID.test(unitId.trim()) && (UUID.test(requestId.trim()) || UUID.test(buyerId.trim()))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await purchasesApi.create({
        unitId: unitId.trim(),
        ...(requestId.trim() ? { requestId: requestId.trim() } : {}),
        ...(buyerId.trim() ? { buyerId: buyerId.trim() } : {}),
      })
      void navigate(`/purchases/${created.id}`)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tt('new.title')}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="grid">
          <Field label={tt('new.requestId')}>
            <input value={requestId} onChange={(event) => setRequestId(event.target.value)} maxLength={36} />
          </Field>
          <Field label={tt('new.buyerId')} hint={tt('new.buyerHint')}>
            <input value={buyerId} onChange={(event) => setBuyerId(event.target.value)} maxLength={36} />
          </Field>
          <Field label={tt('new.unitId')}>
            <input value={unitId} onChange={(event) => setUnitId(event.target.value)} maxLength={36} required />
          </Field>
        </div>
        <ErrorBox error={error} />
        <button type="submit" className="primary" disabled={!valid || busy}>
          {tt('new.create')}
        </button>
      </form>
    </Card>
  )
}

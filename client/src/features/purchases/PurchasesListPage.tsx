import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Page, Segmented, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { statusSignal } from '../../ui/status.ts'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { purchasesApi } from './api.ts'
import { usePurchaseT } from './shared.tsx'
import type { PurchaseStatus, PurchaseSummary } from './types.ts'

const STATUSES: PurchaseStatus[] = ['ACTIVE', 'BLOCKED', 'COMPLETED', 'CANCELLED']

/**
 * Lista kupovina sa serverskom paginacijom (20/50/100) i filterom po stanju.
 * Nova kupovina se otvara na posebnoj strani (`/purchases/new`).
 */
export function PurchasesListPage() {
  const tt = usePurchaseT()
  const { t, l, formatMoney, formatDate } = useI18n()
  const { can } = useAuth()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<PurchaseStatus | ''>('')
  const list = usePagedQuery((page) => purchasesApi.list({ status, ...page }), [status])

  // Stari link iz zahteva (`/purchases?requestId=`) vodi na stranu nove kupovine.
  const requestId = searchParams.get('requestId')
  if (requestId) return <Navigate to={`/purchases/new?requestId=${encodeURIComponent(requestId)}`} replace />

  const segments: { value: PurchaseStatus | ''; label: string; risk?: boolean }[] = [
    { value: '', label: tt('list.all') },
    ...STATUSES.map((value) => ({ value, label: tt(`list.seg.${value}`), risk: value === 'BLOCKED' })),
  ]

  const columns: Column<PurchaseSummary>[] = [
    {
      key: 'project',
      header: tt('list.project'),
      cell: (item) => (
        <span className="cell-title">
          <Link to={`/purchases/${item.id}`}>
            {item.projectName} · {tt('detail.unit', { label: item.unitLabel })}
          </Link>
          <span className="meta">{item.city}</span>
        </span>
      ),
    },
    { key: 'market', header: t('common.market'), hideOnMobile: true, cell: (item) => t(`market.${item.market}`) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (item) => <StatusBadge text={tt(`status.${item.status}`)} {...statusSignal('purchase', item.status)} />,
    },
    {
      key: 'step',
      header: tt('list.currentStep'),
      cell: (item) => {
        const step = item.currentStep ? l(item.currentStep.title) : tt('list.done')
        return (
          <span className="cell-title">
            {item.status === 'BLOCKED' ? (
              <span className="text-risk">
                <Icon name="lock" size={13} />
                {step}
              </span>
            ) : (
              <span>{step}</span>
            )}
            {item.currentStep && <span className="meta">{item.currentStep.code}</span>}
          </span>
        )
      },
    },
    { key: 'price', header: tt('list.price'), align: 'end', cell: (item) => formatMoney(item.price) },
    { key: 'created', header: tt('list.created'), mono: true, hideOnMobile: true, cell: (item) => formatDate(item.createdAt) },
  ]

  return (
    <Page
      title={tt('list.title')}
      actions={
        can('purchases:manage') && (
          <Link className="btn btn--primary" to="/purchases/new">
            <Icon name="plus" size={15} />
            {tt('list.new')}
          </Link>
        )
      }
    >
      <DataTable
        caption={tt('list.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(item) => item.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={status ? tt('list.noMatch') : tt('list.none')}
        rowClassName={(item) => (item.status === 'BLOCKED' ? 'row--risk' : undefined)}
        toolbar={<Segmented label={tt('list.filterLabel')} options={segments} value={status} onChange={setStatus} />}
        rowActions={(item) => (
          <Link className="btn btn--quiet btn--sm" to={`/purchases/${item.id}`}>
            {tt('list.open')}
          </Link>
        )}
      />
    </Page>
  )
}

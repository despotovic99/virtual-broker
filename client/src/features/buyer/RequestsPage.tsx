import { Link } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Page, StatusBadge, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { statusSignal } from '../../ui/status.ts'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { buyerDictionary } from './i18n.ts'
import type { BuyerRequestItem, BuyerRequestPage } from './types.ts'

/** Moji zahtevi (F-35): vrsta, status, tržište, datum i rok za prvi odgovor; tabela sa paginacijom. */
export function RequestsPage() {
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const list = usePagedQuery((page) => api<BuyerRequestPage>(`/requests/mine${query({ ...page })}`), [])

  const newLink = (
    <Link className="btn btn--primary" to="/requests/new">
      <Icon name="plus" size={15} />
      {bt('requests.new')}
    </Link>
  )

  const columns: Column<BuyerRequestItem>[] = [
    {
      key: 'kind',
      header: bt('requests.kind'),
      cell: (request) => {
        const target = request.developerName ?? request.address ?? request.registrationNumber
        return (
          <span className="cell-title">
            <strong>{bt(`kind.${request.kind}`)}</strong>
            {target && <span className="meta">{target}</span>}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (request) => <StatusBadge text={bt(`status.${request.status}`)} {...statusSignal('request', request.status)} />,
    },
    {
      key: 'market',
      header: t('common.market'),
      hideOnMobile: true,
      cell: (request) => <Tag tone="info">{t(`market.${request.market}`)}</Tag>,
    },
    { key: 'created', header: bt('requests.created'), mono: true, hideOnMobile: true, cell: (request) => formatDate(request.createdAt) },
    { key: 'due', header: bt('requests.due'), mono: true, cell: (request) => formatDate(request.firstResponseDueAt) },
  ]

  // Kad nema nijednog zahteva, radnja je u praznom stanju (bez dupliranja u zaglavlju).
  const isEmpty = list.data !== undefined && list.data.total === 0

  return (
    <Page title={bt('requests.title')} actions={isEmpty ? undefined : newLink}>
      <DataTable
        caption={bt('requests.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(request) => request.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={{ title: bt('requests.emptyTitle'), text: bt('requests.empty'), action: newLink, icon: 'doc' }}
        rowActions={(request) => (
          <Link className="btn btn--quiet btn--sm" to={`/requests/${request.id}`}>
            {bt('requests.open')}
          </Link>
        )}
      />
    </Page>
  )
}

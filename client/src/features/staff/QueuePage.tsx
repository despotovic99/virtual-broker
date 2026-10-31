import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Button, Field, Page, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { statusSignal } from '../../ui/status.ts'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { isRequestLate, LateChip, MarketSelect, useStaffT } from './shared.tsx'
import type { BuyerRequest, RequestStatus } from './types.ts'

const STATUSES: RequestStatus[] = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM', 'ANSWERED', 'CONVERTED', 'CLOSED']

/** Red zahteva: naš tim (requests:triage) i advokati (requests:answer-legal). Dve tabele, svaka sa svojom stranom u URL-u. */
export function QueuePage() {
  const { can } = useAuth()
  const st = useStaffT()
  const isTriage = can('requests:triage')
  const isLegal = can('requests:answer-legal')

  return (
    <Page title={st('queue.title')}>
      {isTriage && <TriageQueue />}
      {isLegal && <LegalQueue />}
    </Page>
  )
}

function TriageQueue() {
  const st = useStaffT()
  const { t } = useI18n()
  const [status, setStatus] = useState<RequestStatus | ''>('')
  const [market, setMarket] = useState<MarketCode | ''>('')
  const list = usePagedQuery((page) => staffApi.queue({ status, market, ...page }), [status, market], { prefix: 'triage' })

  return (
    <RequestTable
      list={list}
      empty={status || market ? st('queue.noMatch') : st('queue.none')}
      toolbar={
        <>
          <Field label={t('common.status')}>
            <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus | '')}>
              <option value="">{st('all')}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {st(`reqStatus.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('common.market')}>
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </Field>
        </>
      }
    />
  )
}

function LegalQueue() {
  const st = useStaffT()
  const list = usePagedQuery((page) => staffApi.legalQueue(page), [], { prefix: 'legal' })
  return <RequestTable title={st('queue.legalTitle')} list={list} empty={st('queue.none')} />
}

function RequestTable({
  title,
  list,
  empty,
  toolbar,
}: {
  title?: string
  list: ReturnType<typeof usePagedQuery<BuyerRequest>>
  empty: string
  toolbar?: ReactNode
}) {
  const { t, formatDate } = useI18n()
  const st = useStaffT()
  const now = Date.now()

  const columns: Column<BuyerRequest>[] = [
    {
      key: 'subject',
      header: st('queue.subject'),
      cell: (request) => (
        <span className="cell-title">
          <strong>{request.developerName ?? request.registrationNumber ?? request.address ?? request.question?.slice(0, 60) ?? '—'}</strong>
          {request.registrationNumber && request.developerName && <span className="meta">{request.registrationNumber}</span>}
        </span>
      ),
    },
    { key: 'kind', header: st('queue.kind'), cell: (request) => st(`kind.${request.kind}`) },
    { key: 'market', header: t('common.market'), hideOnMobile: true, cell: (request) => t(`market.${request.market}`) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (request) => <StatusBadge text={st(`reqStatus.${request.status}`)} {...statusSignal('request', request.status)} />,
    },
    {
      key: 'due',
      header: st('queue.due'),
      cell: (request) => (
        <span className="row">
          <span className="mono">{formatDate(request.firstResponseDueAt)}</span>
          {isRequestLate(request, now) && <LateChip text={st('queue.late')} />}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      title={title}
      caption={title ?? st('queue.title')}
      columns={columns}
      rows={list.rows}
      rowKey={(request) => request.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      pagination={list.pagination}
      empty={empty}
      toolbar={toolbar}
      rowClassName={(request) => (isRequestLate(request, now) ? 'row--risk' : undefined)}
      actions={
        <Button size="sm" variant="quiet" busy={list.loading && list.rows !== undefined} onClick={list.reload}>
          {st('refresh')}
        </Button>
      }
      rowActions={(request) => (
        <Link className="btn btn--quiet btn--sm" to={`/queue/${request.id}`}>
          {st('open')}
        </Link>
      )}
    />
  )
}

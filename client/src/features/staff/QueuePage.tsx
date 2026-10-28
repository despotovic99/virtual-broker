import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useStaffT } from './shared.tsx'
import type { BuyerRequest, RequestStatus } from './types.ts'

const STATUSES: RequestStatus[] = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM', 'ANSWERED', 'CONVERTED', 'CLOSED']

export function requestTone(status: RequestStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'NEW') return 'warn'
  if (status === 'ANSWERED' || status === 'CONVERTED') return 'good'
  if (status === 'CLOSED') return 'neutral'
  return 'neutral'
}

/** Red zahteva: naš tim (requests:triage) i advokati (requests:answer-legal). */
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
  const [status, setStatus] = useState<RequestStatus | ''>('')
  const [market, setMarket] = useState<MarketCode | ''>('')
  const { data, error, loading, reload } = useAsync(() => staffApi.queue({ status, market }), [status, market])

  return (
    <Card
      actions={
        <div className="row">
          <select value={status} onChange={(event) => setStatus(event.target.value as RequestStatus | '')} aria-label="status">
            <option value="">{st('all')}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {st(`reqStatus.${value}`)}
              </option>
            ))}
          </select>
          <MarketSelect value={market} onChange={setMarket} allowAll />
          <button type="button" onClick={reload}>
            {st('refresh')}
          </button>
        </div>
      }
    >
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : <RequestTable requests={data ?? []} />}
    </Card>
  )
}

function LegalQueue() {
  const st = useStaffT()
  const { data, error, loading } = useAsync(() => staffApi.legalQueue(), [])
  return (
    <Card title={st('queue.legalTitle')}>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : <RequestTable requests={data ?? []} />}
    </Card>
  )
}

function RequestTable({ requests }: { requests: BuyerRequest[] }) {
  const { t, formatDate } = useI18n()
  const st = useStaffT()
  if (requests.length === 0) return <Empty />
  const now = Date.now()
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>{st('queue.kind')}</th>
            <th>{t('common.market')}</th>
            <th>{st('queue.subject')}</th>
            <th>{t('common.status')}</th>
            <th>{st('queue.due')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const late =
              new Date(request.firstResponseDueAt).getTime() < now &&
              ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM'].includes(request.status)
            return (
              <tr key={request.id}>
                <td>{st(`kind.${request.kind}`)}</td>
                <td>{t(`market.${request.market}`)}</td>
                <td>{request.developerName ?? request.registrationNumber ?? request.address ?? request.question?.slice(0, 60) ?? '—'}</td>
                <td>
                  <StatusBadge text={st(`reqStatus.${request.status}`)} tone={requestTone(request.status)} />
                </td>
                <td>
                  {formatDate(request.firstResponseDueAt)} {late && <StatusBadge text={st('queue.late')} tone="bad" />}
                </td>
                <td>
                  <Link to={`/queue/${request.id}`}>{st('open')}</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

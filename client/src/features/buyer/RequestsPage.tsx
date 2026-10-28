import { Link } from 'react-router'
import { api } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Empty, ErrorBox, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { buyerDictionary } from './i18n.ts'
import type { BuyerRequestItem, RequestStatus } from './types.ts'

export function statusTone(status: RequestStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'ANSWERED' || status === 'CONVERTED') return 'good'
  if (status === 'CLOSED') return 'neutral'
  return 'warn'
}

/** Moji zahtevi (F-35): vrsta, status, tržište, datum i rok za prvi odgovor. */
export function RequestsPage() {
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const { data, error, loading } = useAsync(() => api<BuyerRequestItem[]>('/requests/mine'), [])

  return (
    <Page
      title={bt('requests.title')}
      actions={
        <Link to="/requests/new">
          <button type="button" className="primary">
            {bt('requests.new')}
          </button>
        </Link>
      }
    >
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty text={bt('requests.empty')} />}
      {data && data.length > 0 && (
        <div className="card buyer-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{bt('requests.kind')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.market')}</th>
                <th>{bt('requests.created')}</th>
                <th>{bt('requests.due')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div>{bt(`kind.${request.kind}`)}</div>
                    <div className="muted">{request.developerName ?? request.address ?? request.registrationNumber ?? ''}</div>
                  </td>
                  <td>
                    <StatusBadge text={bt(`status.${request.status}`)} tone={statusTone(request.status)} />
                  </td>
                  <td>{t(`market.${request.market}`)}</td>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>{formatDate(request.firstResponseDueAt)}</td>
                  <td>
                    <Link to={`/requests/${request.id}`}>{bt('requests.open')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}

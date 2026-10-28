import { Link, useParams } from 'react-router'
import { api } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { buyerDictionary } from './i18n.ts'
import { statusTone } from './RequestsPage.tsx'
import { SemaphoreDisclaimer, SemaphoreItems } from './SemaphoreView.tsx'
import type { BuyerRequestItem, FreeSemaphore } from './types.ts'

/** Besplatni semafor zahteva: investitor i parcela, uz izvor, datum i oznaku dummy podatka. */
export function FreeSemaphoreView({ semaphore }: { semaphore: FreeSemaphore }) {
  const bt = useLocalT(buyerDictionary)
  const { formatDate } = useI18n()
  return (
    <Card title={bt('detail.freeSemaphore')}>
      <p className="muted">
        {bt('semaphore.checkedAt')}: {formatDate(semaphore.checkedAt)}
      </p>
      {semaphore.developer && <SemaphoreItems title={bt('detail.developer')} result={semaphore.developer} />}
      {semaphore.parcel && <SemaphoreItems title={bt('detail.parcel')} result={semaphore.parcel} />}
      {!semaphore.developer && !semaphore.parcel && <p className="muted">{bt('detail.noSemaphore')}</p>}
      <SemaphoreDisclaimer text={semaphore.disclaimer} />
    </Card>
  )
}

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const { data, error, loading } = useAsync(() => api<BuyerRequestItem>(`/requests/${encodeURIComponent(id)}`), [id])

  const rows: [string, string | null][] = data
    ? [
        [t('common.market'), t(`market.${data.market}`)],
        [bt('newRequest.listingUrl'), data.listingUrl],
        [bt('newRequest.developerName'), data.developerName],
        [bt('newRequest.registrationNumber'), data.registrationNumber],
        [bt('newRequest.parcelReference'), data.parcelReference],
        [bt('newRequest.address'), data.address],
        [bt('newRequest.question'), data.question],
        [bt('requests.created'), formatDate(data.createdAt)],
        [bt('requests.due'), formatDate(data.firstResponseDueAt)],
      ]
    : []

  return (
    <Page
      title={data ? `${bt('detail.title')}: ${bt(`kind.${data.kind}`)}` : bt('detail.title')}
      actions={<Link to="/requests">{t('common.back')}</Link>}
    >
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card title={bt('detail.data')} actions={<StatusBadge text={bt(`status.${data.status}`)} tone={statusTone(data.status)} />}>
            <dl className="buyer-dl">
              {rows
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} style={{ display: 'contents' }}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </Card>

          {data.freeSemaphore && <FreeSemaphoreView semaphore={data.freeSemaphore} />}

          <Card title={bt('detail.answer')}>
            {data.answer ? (
              <>
                {data.answerScope && (
                  <p>
                    <StatusBadge
                      text={bt(data.answerScope === 'ENGAGED_ADVICE' ? 'detail.scopeENGAGED_ADVICE' : 'detail.scopeINFORMATION')}
                      tone={data.answerScope === 'ENGAGED_ADVICE' ? 'good' : 'neutral'}
                    />
                    {data.answeredAt && <span className="muted"> · {formatDate(data.answeredAt)}</span>}
                  </p>
                )}
                <p className="buyer-answer">{data.answer}</p>
              </>
            ) : (
              <p className="muted">{bt('detail.noAnswer')}</p>
            )}
          </Card>

          {data.purchaseId && (
            <Card title={bt('detail.purchase')}>
              <Link to={`/purchases/${data.purchaseId}`}>{bt('detail.openPurchase')}</Link>
            </Card>
          )}
        </>
      )}
    </Page>
  )
}

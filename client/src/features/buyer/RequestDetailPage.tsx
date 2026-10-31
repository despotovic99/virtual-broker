import { Fragment } from 'react'
import { Link, useParams } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorState, Loading, Notice, Page, StatusBadge, Tag } from '../../ui/components.tsx'
import { Icon } from '../../ui/icons.tsx'
import { statusSignal } from '../../ui/status.ts'
import { useAsync } from '../../ui/useAsync.ts'
import { buyerDictionary } from './i18n.ts'
import { SemaphoreDisclaimer, SemaphoreItems, SemaphoreSummary } from './SemaphoreView.tsx'
import type { BuyerRequestItem, FreeSemaphore } from './types.ts'

/** Veza ka obrascu za vođenje kupovine, sa podacima iz besplatne provere (bez novog API poziva). */
export function fullCheckLink(request: Pick<BuyerRequestItem, 'market' | 'developerName'>): string {
  return `/requests/new${query({ kind: 'GUIDED_PURCHASE', market: request.market, developerName: request.developerName ?? undefined })}`
}

/**
 * Besplatni semafor zahteva: investitor i parcela, uz izvor, datum i oznaku dummy podatka.
 * Crveno se uvek prikazuje; ostale provere su zaključane do angažovanja pravnog tima.
 */
export function FreeSemaphoreView({ semaphore, fullCheckTo }: { semaphore: FreeSemaphore; fullCheckTo?: string }) {
  const bt = useLocalT(buyerDictionary)
  const { formatDate } = useI18n()
  const empty = !semaphore.developer && !semaphore.parcel
  return (
    <Card
      title={bt('detail.freeSemaphore')}
      actions={
        <span className="meta">
          {bt('semaphore.checkedAt')} {formatDate(semaphore.checkedAt)}
        </span>
      }
    >
      <div className="stack">
        {semaphore.developer && <SemaphoreItems title={bt('detail.developer')} result={semaphore.developer} />}
        {semaphore.parcel && <SemaphoreItems title={bt('detail.parcel')} result={semaphore.parcel} />}
        {empty && <Empty text={bt('detail.noSemaphore')} />}
        {fullCheckTo && (
          <>
            <div className="locked-row">
              <span className="locked-row__icon">
                <Icon name="lock" size={14} />
              </span>
              <span>{bt('free.locked')}</span>
            </div>
            <div className="row">
              <Link className="btn btn--primary" to={fullCheckTo}>
                {bt('free.requestFull')}
              </Link>
              <span className="meta">{bt('free.redShown')}</span>
            </div>
          </>
        )}
        <SemaphoreDisclaimer text={semaphore.disclaimer} />
      </div>
    </Card>
  )
}

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const { data, error, loading, reload } = useAsync(() => api<BuyerRequestItem>(`/requests/${encodeURIComponent(id)}`), [id])

  // [oznaka, vrednost, mono] — šifre, brojevi i datumi idu u mono.
  const rows: [string, string | null, boolean][] = data
    ? [
        [bt('newRequest.listingUrl'), data.listingUrl, false],
        [bt('newRequest.developerName'), data.developerName, false],
        [bt('newRequest.registrationNumber'), data.registrationNumber, true],
        [bt('newRequest.parcelReference'), data.parcelReference, true],
        [bt('newRequest.address'), data.address, false],
        [bt('requests.created'), formatDate(data.createdAt), true],
        [bt('requests.due'), formatDate(data.firstResponseDueAt), true],
      ]
    : []

  const title = data ? `${bt('detail.title')}: ${bt(`kind.${data.kind}`)}` : bt('detail.title')

  return (
    <Page
      title={title}
      crumbs={[{ label: bt('requests.title'), to: '/requests' }, { label: bt('detail.title') }]}
      meta={
        data && (
          <>
            <StatusBadge text={bt(`status.${data.status}`)} {...statusSignal('request', data.status)} />
            <Tag tone="info">{t(`market.${data.market}`)}</Tag>
          </>
        )
      }
    >
      {Boolean(error) && <ErrorState error={error} onRetry={reload} backTo={{ to: '/requests', label: t('common.back') }} />}
      {loading && !data && !error && <Loading />}
      {data && (
        <div className="layout-aside">
          <div className="layout-aside__main">
            {data.purchaseId && (
              <Notice
                tone="ok"
                icon="forward"
                title={bt('detail.purchase')}
                actions={
                  <Link className="btn" to={`/purchases/${data.purchaseId}`}>
                    {bt('detail.openPurchase')}
                  </Link>
                }
              />
            )}

            {data.freeSemaphore && (
              <FreeSemaphoreView semaphore={data.freeSemaphore} fullCheckTo={data.kind === 'CHECK' && !data.purchaseId ? fullCheckLink(data) : undefined} />
            )}

            <Card
              title={bt('detail.answer')}
              badge={
                data.answer && data.answerScope ? (
                  <StatusBadge
                    text={bt(data.answerScope === 'ENGAGED_ADVICE' ? 'detail.scopeENGAGED_ADVICE' : 'detail.scopeINFORMATION')}
                    tone={data.answerScope === 'ENGAGED_ADVICE' ? 'ok' : 'info'}
                    icon={data.answerScope === 'ENGAGED_ADVICE' ? 'check' : 'info'}
                  />
                ) : undefined
              }
              actions={data.answer && data.answeredAt ? <span className="meta">{formatDate(data.answeredAt)}</span> : undefined}
            >
              {data.question && (
                <div className="stack stack--sm">
                  <span className="eyebrow">{bt('newRequest.question')}</span>
                  <p className="pre">{data.question}</p>
                  <hr />
                </div>
              )}
              {data.answer ? <p className="pre">{data.answer}</p> : <Empty text={bt('detail.noAnswer')} />}
            </Card>

          </div>

          <div className="layout-aside__side">
            {data.freeSemaphore && (data.freeSemaphore.developer || data.freeSemaphore.parcel) && (
              <Card label={t('semaphore.overall')}>
                <SemaphoreSummary results={[data.freeSemaphore.developer, data.freeSemaphore.parcel]} />
              </Card>
            )}
            <Card label={bt('detail.data')}>
              <dl className="dl">
                {rows
                  .filter(([, value]) => value)
                  .map(([label, value, mono]) => (
                    <Fragment key={label}>
                      <dt>{label}</dt>
                      <dd className={mono ? 'mono' : undefined}>{value}</dd>
                    </Fragment>
                  ))}
              </dl>
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}

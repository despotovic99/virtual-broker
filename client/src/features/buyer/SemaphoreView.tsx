import { useI18n, useLocalT, type Localized } from '../../core/i18n/I18nContext.tsx'
import { DummyTag, SemaphoreBadge } from '../../ui/components.tsx'
import { buyerDictionary } from './i18n.ts'
import { isDummy, type SemaphoreResult } from './types.ts'

/** Stavke jednog semafora: naziv, boja, objašnjenje, izvor, datum i oznaka dummy podatka. */
export function SemaphoreItems({ title, result }: { title: string; result: SemaphoreResult }) {
  const { t, l, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  return (
    <div className="buyer-semaphore-group">
      <div className="row">
        <strong>{title}</strong>
        <SemaphoreBadge status={result.overall} />
        {result.containsDummyData && <DummyTag />}
      </div>
      {result.hardBlocked && (
        <p role="alert" className="error">
          {t('semaphore.hardBlocked')}
        </p>
      )}
      <ul className="buyer-semaphore-list">
        {result.items.map((item) => (
          <li key={item.code}>
            <div className="row">
              <SemaphoreBadge status={item.status} />
              <span>{l(item.title)}</span>
              {item.mandatory && <span className="muted">({bt('semaphore.mandatory')})</span>}
              {isDummy(item) && <DummyTag />}
            </div>
            {item.summary && <p className="buyer-semaphore-summary">{item.summary}</p>}
            <p className="muted buyer-semaphore-meta">
              {item.source && (
                <>
                  {bt('semaphore.source')}: {item.source}
                </>
              )}
              {item.checkedAt && (
                <>
                  {item.source ? ' · ' : ''}
                  {bt('semaphore.checkedAt')}: {formatDate(item.checkedAt)}
                </>
              )}
              {item.expired && <> · {bt('semaphore.expired')}</>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tekst koji uvek ide uz semafor (README pravilo 7, F-35 P5). */
export function SemaphoreDisclaimer({ text }: { text?: Localized }) {
  const { t, l } = useI18n()
  return <p className="muted buyer-disclaimer">{text ? l(text) : t('common.notLegalAdvice')}</p>
}

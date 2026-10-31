import { useI18n, type Localized } from '../../core/i18n/I18nContext.tsx'
import { Chip, Distribution, DummyTag, HardBlock, Notice, SemaphoreBadge, type SemaphoreStatus } from '../../ui/components.tsx'
import { isDummy, type SemaphoreItem, type SemaphoreResult } from './types.ts'

/**
 * Stavke jednog semafora. Svaka nosi status, naziv i obrazloženje, metod,
 * izvor, datum provere i rok važnosti u istom redu, ne u tooltipu: bez njih
 * boja ne znači ništa.
 */
export function SemaphoreItems({ title, result }: { title: string; result: SemaphoreResult }) {
  const { t } = useI18n()
  return (
    <div className="buyer-semaphore-group">
      {result.hardBlocked && (
        <HardBlock title={t('semaphore.hardBlocked')}>{t('semaphore.hardBlockedBody')}</HardBlock>
      )}
      <div className="sem-group">
        <h3 className="eyebrow">{title}</h3>
        <SemaphoreBadge status={result.overall} size="sm" />
        {result.containsDummyData && <DummyTag />}
        <span className="divider" />
      </div>
      <ul className="sem-list">
        {result.items.map((item) => (
          <SemaphoreRow key={item.code} item={item} />
        ))}
      </ul>
    </div>
  )
}

function SemaphoreRow({ item }: { item: SemaphoreItem }) {
  const { t, l, formatDate } = useI18n()
  const blocking = item.status === 'RED' && item.hardBlockOnRed
  const className = ['sem-item', blocking && 'sem-item--block', item.expired && 'sem-item--expired'].filter(Boolean).join(' ')
  const notes = [
    item.mandatory ? t('semaphore.mandatory') : null,
    blocking ? t('semaphore.hardBlock') : null,
    item.expired ? t('semaphore.expiredTag') : null,
  ].filter(Boolean)

  return (
    <li className={className}>
      <span className="sem-item__status">
        {blocking ? (
          <Chip tone="critical" icon="xCircle">
            {t(`semaphore.${item.status}`)}
          </Chip>
        ) : (
          <SemaphoreBadge status={item.status} />
        )}
      </span>
      <span className="sem-item__text">
        <span className="sem-item__title">
          {l(item.title)}
          {notes.length > 0 && <span className="sem-item__note"> · {notes.join(' · ')}</span>}
        </span>
        {item.summary && <span className="sem-item__summary">{item.summary}</span>}
      </span>
      <span className="sem-item__method">{t(`semaphore.method.${item.method}`)}</span>
      <span className="sem-item__source">
        {item.source || item.checkedAt ? (
          <>
            <span className="row">
              {[item.source, item.checkedAt ? formatDate(item.checkedAt) : null].filter(Boolean).join(' · ')}
              {isDummy(item) && <DummyTag />}
            </span>
            {item.validUntil && (
              <span>
                {item.expired
                  ? t('semaphore.expiredOn', { date: formatDate(item.validUntil) })
                  : t('semaphore.validUntil', { date: formatDate(item.validUntil) })}
              </span>
            )}
          </>
        ) : (
          <span>{t('semaphore.notChecked')}</span>
        )}
      </span>
    </li>
  )
}

/** Zbirni prikaz po bojama. Ukupna ocena nije prosek, ovo je samo raspodela. */
export function SemaphoreSummary({ results }: { results: (SemaphoreResult | null | undefined)[] }) {
  const { t } = useI18n()
  const items = results.flatMap((result) => result?.items ?? [])
  if (items.length === 0) return null
  const count = (status: SemaphoreStatus) => items.filter((item) => item.status === status).length
  return (
    <div className="stack stack--sm">
      <span className="eyebrow">{t('semaphore.summaryTitle', { count: items.length })}</span>
      <Distribution
        parts={[
          { tone: 'ok', count: count('GREEN'), label: t('semaphore.count.GREEN') },
          { tone: 'warn', count: count('YELLOW'), label: t('semaphore.count.YELLOW') },
          { tone: 'risk', count: count('RED'), label: t('semaphore.count.RED') },
          { tone: 'idle', count: count('GRAY'), label: t('semaphore.count.GRAY') },
        ]}
      />
      <span className="muted small">{t('semaphore.notAverage')}</span>
    </div>
  )
}

/** Tekst koji uvek ide uz semafor (README pravilo 7, F-35 P5). */
export function SemaphoreDisclaimer({ text }: { text?: Localized }) {
  const { t, l } = useI18n()
  return (
    <div className="buyer-disclaimer">
      <Notice tone="plain">{text ? l(text) : t('common.notLegalAdvice')}</Notice>
    </div>
  )
}

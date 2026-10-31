import { useEffect, useState } from 'react'
import { api, query, type Page } from '../core/api/http.ts'
import { useAuth } from '../core/auth/AuthContext.tsx'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import type { Dictionary } from '../core/i18n/sr.ts'
import { Avatar, Empty, ErrorBox, Loading } from './components.tsx'
import { Icon } from './icons.tsx'

export type AuditValue = string | number | boolean | null | string[]
export type AuditChangeSet = Record<string, { from: AuditValue; to: AuditValue }>

export interface AuditEvent {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actor: { id: string; firstName: string; lastName: string; email: string } | null
  ip: string | null
  data: ({ changes?: AuditChangeSet } & Record<string, unknown>) | null
  createdAt: string
}

const PAGE = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/

/** „plannedDate” → „Planned date” (kad polje nema prevod). */
function humanize(key: string): string {
  const spaced = key.replace(/[._]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Prevodi radnje, entiteta i polja iz audit loga; bez prevoda vraća čitljiv naziv iz koda. */
export function useAuditFormat() {
  const { t, formatDateTime, formatDate } = useI18n()

  const label = (key: string, fallback: string) => {
    const text = t(key as keyof Dictionary)
    return text === key ? fallback : text
  }

  // „check.RS_APR_STATUS” → „Provera · RS_APR_STATUS”; „phase.STRUCTURE.plannedDate” → „Faza · STRUCTURE · Planirani datum”.
  const field = (key: string): string => {
    const [group, code, sub] = key.split('.')
    if (code === undefined || !['check', 'condition', 'phase', 'step'].includes(group)) return label(`audit.field.${key}`, humanize(key))
    const parts = [label(`audit.dynamic.${group}`, humanize(group)), code]
    if (sub) parts.push(label(`audit.field.${sub}`, humanize(sub)))
    return parts.join(' · ')
  }

  const value = (raw: AuditValue): string => {
    if (raw === null || raw === '') return '—'
    if (Array.isArray(raw)) return raw.length === 0 ? '—' : raw.join(', ')
    if (typeof raw === 'boolean') return raw ? t('common.yes') : t('common.no')
    if (typeof raw === 'string' && UUID.test(raw)) return `${raw.slice(0, 8)}…`
    if (typeof raw === 'string' && ISO.test(raw)) return raw.length > 10 ? formatDateTime(raw) : formatDate(raw)
    return String(raw)
  }

  return {
    action: (action: string) => label(`audit.action.${action}`, humanize(action)),
    entity: (entityType: string) => label(`audit.entity.${entityType}`, humanize(entityType)),
    field,
    value,
  }
}

/** Izmene jednog događaja: polje, staro → novo. */
export function AuditChanges({ changes }: { changes: AuditChangeSet | undefined }) {
  const { t } = useI18n()
  const format = useAuditFormat()
  const entries = Object.entries(changes ?? {})
  if (entries.length === 0) return null
  return (
    <dl className="audit-changes">
      {entries.map(([key, change]) => (
        <div key={key} className="audit-change">
          <dt>{format.field(key)}</dt>
          <dd>
            {change.from !== null && change.from !== '' && (
              <>
                <del>{format.value(change.from)}</del>
                <span className="audit-change__arrow" aria-label={t('audit.changedTo')}>
                  →
                </span>
              </>
            )}
            <ins>{format.value(change.to)}</ins>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Audit log entiteta (desna kolona na pregledu): ko je, kada, sa koje IP
 * adrese i šta tačno promenio (polje: staro → novo). Obuhvata i ono što
 * entitetu pripada (npr. stanove projekta, rate kupovine). Vide ga samo
 * nalozi sa pravom audit:read.
 */
export function AuditTrail({ entityId, title }: { entityId: string; title?: string }) {
  const { t, formatDateTime } = useI18n()
  const format = useAuditFormat()
  const { can } = useAuth()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [version, setVersion] = useState(0)
  const allowed = can('audit:read')

  useEffect(() => {
    if (!allowed) return
    let active = true
    setLoading(true)
    setError(null)
    api<Page<AuditEvent>>(`/audit${query({ relatedTo: entityId, limit: PAGE, offset: 0 })}`)
      .then((page) => {
        if (!active) return
        setEvents(page.items)
        setTotal(page.total)
      })
      .catch((reason: unknown) => active && setError(reason))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [entityId, allowed, version])

  if (!allowed) return null

  const loadMore = async () => {
    setLoading(true)
    try {
      const page = await api<Page<AuditEvent>>(`/audit${query({ relatedTo: entityId, limit: PAGE, offset: events.length })}`)
      setEvents((current) => [...current, ...page.items])
      setTotal(page.total)
    } catch (reason) {
      setError(reason)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card audit-trail" aria-label={title ?? t('audit.title')}>
      <div className="card-header">
        <div className="card-header__title">
          <h2 className="eyebrow">{title ?? t('audit.title')}</h2>
          {total > 0 && <span className="count count--quiet">{total}</span>}
        </div>
        <button type="button" className="icon sm" onClick={() => setVersion((value) => value + 1)} aria-label={t('audit.refresh')} title={t('audit.refresh')}>
          <Icon name="progress" size={13} />
        </button>
      </div>
      <div className="audit-trail__body">
        {loading && events.length === 0 ? (
          <Loading rows={3} inline />
        ) : events.length === 0 && !error ? (
          <Empty text={t('audit.empty')} />
        ) : (
          <ol className="audit-list">
            {events.map((event) => {
              const own = event.entityId === entityId
              return (
                <li key={event.id} className="audit-item">
                  <div className="audit-item__head">
                    <strong className="audit-item__action">{format.action(event.action)}</strong>
                    {!own && <span className="tag tag--sm">{format.entity(event.entityType)}</span>}
                  </div>
                  <AuditChanges changes={event.data?.changes} />
                  <div className="audit-item__meta">
                    {event.actor ? (
                      <span className="audit-item__who">
                        <Avatar firstName={event.actor.firstName} lastName={event.actor.lastName} />
                        <span className="audit-item__who-text">
                          <span className="audit-item__name">
                            {event.actor.firstName} {event.actor.lastName}
                          </span>
                          <span className="meta">{event.actor.email}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="audit-item__who">
                        <span className="avatar avatar--muted" aria-hidden="true">
                          <Icon name="settings" size={13} />
                        </span>
                        <span className="audit-item__name">{t('audit.system')}</span>
                      </span>
                    )}
                    <span className="audit-item__when">
                      <time className="meta" dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                      <span className="meta" title={t('audit.ip')}>
                        {t('audit.ip')} {event.ip ?? '—'}
                      </span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <ErrorBox error={error} onRetry={() => setVersion((value) => value + 1)} />
        {events.length < total && (
          <button type="button" className="quiet block" onClick={() => void loadMore()} disabled={loading} aria-busy={loading || undefined}>
            {t('audit.loadMore', { count: total - events.length })}
          </button>
        )}
      </div>
    </section>
  )
}

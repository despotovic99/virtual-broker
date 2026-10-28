import { useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Loading, Page } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { useStaffT } from './shared.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Poslednji događaji iz audit loga (ko, šta, kada) na tržištima korisnika. */
export function AuditPage() {
  const st = useStaffT()
  const { t } = useI18n()
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const validId = entityId.trim() === '' || UUID.test(entityId.trim())
  const { data, error, loading } = useAsync(
    () =>
      validId
        ? staffApi.audit({ entityType: entityType.trim() || undefined, entityId: entityId.trim() || undefined, limit: 200 })
        : Promise.resolve([]),
    [entityType, entityId, validId],
  )

  return (
    <Page title={st('audit.title')} actions={<Link to="/admin/users">{t('common.back')}</Link>}>
      <Card
        actions={
          <div className="row">
            <input placeholder={st('audit.entityType')} value={entityType} onChange={(event) => setEntityType(event.target.value)} maxLength={64} />
            <input placeholder={st('audit.entityId')} value={entityId} onChange={(event) => setEntityId(event.target.value)} maxLength={36} />
          </div>
        }
      >
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data || data.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{st('audit.action')}</th>
                  <th>{st('audit.entityType')}</th>
                  <th>{st('audit.actor')}</th>
                  <th>{t('common.details')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td>{event.action}</td>
                    <td>
                      {event.entityType}
                      {event.entityId && <div className="muted">{event.entityId}</div>}
                    </td>
                    <td>{event.actorId ?? st('audit.system')}</td>
                    <td>
                      <code style={{ whiteSpace: 'pre-wrap', fontSize: '0.85em' }}>{event.data ? JSON.stringify(event.data) : '—'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  )
}

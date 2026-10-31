import { useState } from 'react'
import { Link } from 'react-router'
import type { Page as PageOf } from '../../core/api/http.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditChanges, useAuditFormat } from '../../ui/AuditTrail.tsx'
import { Avatar, Field, Page } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { useStaffT } from './shared.tsx'
import type { AuditEvent } from './types.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Događaji iz audit loga (ko, šta, kada) na tržištima korisnika, sa paginacijom (najviše 100 po strani). */
export function AuditPage() {
  const st = useStaffT()
  const { t, formatDateTime } = useI18n()
  const format = useAuditFormat()
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const type = entityType.trim()
  const idValue = entityId.trim()
  const validId = idValue === '' || UUID.test(idValue)
  const list = usePagedQuery(
    (page) =>
      validId
        ? staffApi.audit({ entityType: type || undefined, entityId: idValue || undefined, ...page })
        : Promise.resolve<PageOf<AuditEvent>>({ items: [], total: 0, limit: page.limit, offset: page.offset }),
    [type, idValue, validId],
  )

  const columns: Column<AuditEvent>[] = [
    {
      key: 'date',
      header: t('common.date'),
      mono: true,
      cell: (event) => (
        <span className="cell-title">
          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          <span className="meta">
            {t('audit.ip')} {event.ip ?? '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'action',
      header: st('audit.action'),
      cell: (event) => (
        <span className="cell-title">
          <strong>{format.action(event.action)}</strong>
          <span className="meta mono">{event.action}</span>
        </span>
      ),
    },
    {
      key: 'entity',
      header: st('audit.entityType'),
      cell: (event) => (
        <span className="cell-title">
          <strong>{format.entity(event.entityType)}</strong>
          {event.entityId && <span className="meta mono">{event.entityId}</span>}
        </span>
      ),
    },
    {
      key: 'actor',
      header: st('audit.actor'),
      hideOnMobile: true,
      cell: (event) =>
        event.actor ? (
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
          <span className="muted">{st('audit.system')}</span>
        ),
    },
    {
      key: 'changes',
      header: t('common.details'),
      hideOnMobile: true,
      cell: (event) => (event.data?.changes && Object.keys(event.data.changes).length > 0 ? <AuditChanges changes={event.data.changes} /> : '—'),
    },
  ]

  return (
    <Page
      title={st('audit.title')}
      crumbs={[{ label: st('users.title'), to: '/admin/users' }, { label: st('audit.title') }]}
      actions={
        <Link className="btn" to="/admin/users">
          {t('common.back')}
        </Link>
      }
    >
      <DataTable
        caption={st('audit.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(event) => event.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={!validId ? st('audit.invalidId') : type || idValue ? st('audit.noMatch') : st('audit.none')}
        toolbar={
          <>
            <Field label={st('audit.entityType')}>
              <input value={entityType} onChange={(event) => setEntityType(event.target.value)} maxLength={64} />
            </Field>
            <Field label={st('audit.entityId')} error={validId ? null : st('audit.invalidId')}>
              <input className="mono" value={entityId} onChange={(event) => setEntityId(event.target.value)} maxLength={36} />
            </Field>
          </>
        }
      />
    </Page>
  )
}

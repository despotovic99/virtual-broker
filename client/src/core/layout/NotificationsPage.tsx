import { useState } from 'react'
import { Link } from 'react-router'
import { api, query, type Page as ListPage } from '../api/http.ts'
import { useI18n, useLocalT, type FeatureDictionary } from '../i18n/I18nContext.tsx'
import { Button, ErrorBox, Page, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

/** Strana obaveštenja sa servera, uz broj nepročitanih. */
interface NotificationPage extends ListPage<NotificationItem> {
  unread: number
}

type Key = 'markAll' | 'nothingUnread' | 'unread' | 'empty' | 'unreadMark' | 'notification' | 'state'

const dictionary: FeatureDictionary<Key> = {
  sr: {
    markAll: 'Označi sve kao pročitano',
    nothingUnread: 'Nema nepročitanih obaveštenja.',
    unread: 'Nepročitano: {count}',
    empty: 'Još nema obaveštenja.',
    unreadMark: 'Nepročitano',
    notification: 'Obaveštenje',
    state: 'Stanje',
  },
  en: {
    markAll: 'Mark all as read',
    nothingUnread: 'There are no unread notifications.',
    unread: 'Unread: {count}',
    empty: 'No notifications yet.',
    unreadMark: 'Unread',
    notification: 'Notification',
    state: 'State',
  },
}

export function NotificationsPage() {
  const { t, formatDate } = useI18n()
  const nt = useLocalT(dictionary)
  const list = usePagedQuery((page) => api<NotificationPage>(`/notifications${query({ ...page })}`), [])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  const markAll = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await api('/notifications/read-all', { method: 'POST' })
      list.reload()
    } catch (reason) {
      setActionError(reason)
    } finally {
      setBusy(false)
    }
  }

  const data = list.data
  const unread = data && 'unread' in data ? Number(data.unread) : 0

  const columns: Column<NotificationItem>[] = [
    {
      key: 'state',
      header: nt('state'),
      cell: (item) => (item.readAt ? <span className="muted">—</span> : <StatusBadge text={nt('unreadMark')} tone="info" icon="dot" />),
    },
    {
      key: 'text',
      header: nt('notification'),
      cell: (item) => (
        <span className="cell-title">
          {item.readAt ? <span>{item.title}</span> : <strong>{item.title}</strong>}
          <span className={item.readAt ? 'muted' : undefined}>{item.body}</span>
        </span>
      ),
    },
    { key: 'date', header: t('common.date'), mono: true, hideOnMobile: true, cell: (item) => formatDate(item.createdAt) },
  ]

  return (
    <Page
      title={t('nav.notifications')}
      meta={data && unread > 0 ? <span className="meta">{nt('unread', { count: unread })}</span> : undefined}
      actions={
        data && (
          <Button icon="check" busy={busy} disabled={!unread} title={unread ? undefined : nt('nothingUnread')} onClick={() => void markAll()}>
            {nt('markAll')}
          </Button>
        )
      }
    >
      <div className="stack">
        <ErrorBox error={actionError} />
        <DataTable
          caption={t('nav.notifications')}
          columns={columns}
          rows={list.rows}
          rowKey={(item) => item.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          pagination={list.pagination}
          empty={nt('empty')}
          rowActions={(item) =>
            item.link?.startsWith('/') ? (
              <Link className="btn btn--quiet btn--sm" to={item.link}>
                {t('common.details')}
              </Link>
            ) : null
          }
        />
      </div>
    </Page>
  )
}

import { Link } from 'react-router'
import { api } from '../api/http.ts'
import { useI18n } from '../i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Loading, Page } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

export function NotificationsPage() {
  const { t, formatDate } = useI18n()
  const { data, error, loading, reload } = useAsync(() => api<{ items: NotificationItem[]; unread: number }>('/notifications'), [])

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' })
    reload()
  }

  return (
    <Page
      title={t('nav.notifications')}
      actions={
        <button type="button" onClick={() => void markAll()} disabled={!data?.unread}>
          ✓
        </button>
      }
    >
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && <Empty />}
      {data?.items.map((item) => (
        <Card key={item.id}>
          <p className={item.readAt ? 'muted' : undefined}>
            <strong>{item.title}</strong> · {formatDate(item.createdAt)}
          </p>
          <p>{item.body}</p>
          {item.link?.startsWith('/') && <Link to={item.link}>{t('common.details')}</Link>}
        </Card>
      ))}
    </Page>
  )
}

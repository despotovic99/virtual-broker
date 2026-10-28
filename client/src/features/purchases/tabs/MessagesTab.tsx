import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Loading } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, personName, usePurchaseT } from '../shared.tsx'

export function MessagesTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { t, formatDate } = useI18n()
  const { user, can } = useAuth()
  const messages = useAsync(() => purchasesApi.messages(purchase.id), [purchase.id])
  // Interne poruke šalju samo naš tim, advokat i inženjer, nikad kupac.
  const canInternal = hasRelation(purchase, 'COORDINATOR', 'INTERNAL', 'LAWYER', 'ENGINEER')
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await purchasesApi.sendMessage(purchase.id, { body: body.trim(), ...(canInternal && internal ? { internal: true } : {}) })
      setBody('')
      messages.reload()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tt('messages.title')}>
      <ErrorBox error={messages.error} />
      {messages.loading && !messages.data && <Loading />}
      {messages.data && messages.data.length === 0 && <Empty text={tt('messages.empty')} />}
      {messages.data?.map((message) => (
        <div
          key={message.id}
          style={{
            borderLeft: `3px solid ${message.authorId === user?.id ? 'var(--primary)' : 'var(--border)'}`,
            padding: '4px 10px',
            marginBottom: 10,
          }}
        >
          <div className="muted">
            {personName(message.author) || '—'} · {formatDate(message.createdAt)}
            {message.internal && <strong> · {tt('messages.internalTag')}</strong>}
          </div>
          <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{message.body}</p>
        </div>
      ))}
      {can('messages:write') && (
        <div style={{ marginTop: 12 }}>
          <textarea
            aria-label={tt('messages.placeholder')}
            placeholder={tt('messages.placeholder')}
            value={body}
            maxLength={4000}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="row" style={{ marginTop: 6 }}>
            {canInternal && (
              <label className="row">
                <input type="checkbox" style={{ width: 'auto' }} checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                {tt('messages.internal')}
              </label>
            )}
            <button type="button" className="primary" disabled={!body.trim() || busy} onClick={() => void send()}>
              {t('common.send')}
            </button>
          </div>
          <ErrorBox error={error} />
        </div>
      )}
    </Card>
  )
}

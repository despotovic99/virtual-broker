import { useState } from 'react'
import { useAuth } from '../../../core/auth/AuthContext.tsx'
import { useI18n } from '../../../core/i18n/I18nContext.tsx'
import { Avatar, Button, Card, Empty, ErrorBox, Field, Loading, Tag } from '../../../ui/components.tsx'
import { useAsync } from '../../../ui/useAsync.ts'
import { purchasesApi } from '../api.ts'
import type { TabProps } from '../PurchaseDetailPage.tsx'
import { hasRelation, personName, usePurchaseT } from '../shared.tsx'

const MAX_LENGTH = 4000

export function MessagesTab({ purchase }: TabProps) {
  const tt = usePurchaseT()
  const { t, formatDate, formatNumber } = useI18n()
  const { can } = useAuth()
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

  /** Uloga autora na ovoj kupovini (samo za prikaz); nepoznat autor je iz našeg tima. */
  const roleOf = (authorId: string): string | null => {
    if (authorId === purchase.buyer?.id) return tt('people.buyer')
    if (authorId === purchase.coordinator?.id) return tt('people.coordinator')
    if (authorId === purchase.lawyer?.id) return tt('people.lawyer')
    if (authorId === purchase.engineer?.id) return tt('people.engineer')
    if (authorId === purchase.escrowAgent?.id) return tt('people.escrow')
    return null
  }

  const ready = body.trim().length > 0

  return (
    <Card title={tt('messages.title')}>
      <div className="stack">
        <ErrorBox error={messages.error} onRetry={messages.reload} />
        {messages.loading && !messages.data && !messages.error && <Loading />}
        {messages.data && messages.data.length === 0 && <Empty text={tt('messages.empty')} />}
        {messages.data && messages.data.length > 0 && (
          <div className="messages">
            {messages.data.map((message) => {
              const role = roleOf(message.authorId)
              const fromBuyer = message.authorId === purchase.buyer?.id
              const variant = message.internal ? ' message--internal' : fromBuyer ? '' : ' message--team'
              return (
                <div key={message.id} className={`message${variant}`}>
                  <Avatar firstName={message.author?.firstName} lastName={message.author?.lastName} muted={!message.author} />
                  <div className="message__bubble">
                    <div className="message__head">
                      <span className="message__author">{personName(message.author) || '—'}</span>
                      <span className="meta">{[role, formatDate(message.createdAt)].filter(Boolean).join(' · ')}</span>
                      {message.internal && <Tag tone="info">{tt('messages.teamOnly')}</Tag>}
                    </div>
                    <div className="message__text">{message.body}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {can('messages:write') && (
          <div>
            <Field label={tt('messages.new')} hint={`${formatNumber(body.length)} / ${formatNumber(MAX_LENGTH)}`}>
              <textarea
                rows={3}
                placeholder={tt('messages.placeholder')}
                value={body}
                maxLength={MAX_LENGTH}
                onChange={(event) => setBody(event.target.value)}
              />
            </Field>
            <div className="row row--between">
              {canInternal ? (
                <label className="check" title={tt('messages.internal')}>
                  <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                  {tt('messages.teamOnlyCheck')}
                </label>
              ) : (
                <span />
              )}
              <Button
                variant="primary"
                busy={busy}
                disabled={!ready}
                title={ready ? undefined : tt('messages.bodyRequired')}
                onClick={() => void send()}
              >
                {t('common.send')}
              </Button>
            </div>
          </div>
        )}
        <ErrorBox error={error} />
      </div>
    </Card>
  )
}

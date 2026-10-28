import { useState, type FormEvent } from 'react'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Card, DummyTag, Empty, ErrorBox, Field, SemaphoreBadge, type SemaphoreStatus } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { isDummySource, useStaffT } from './shared.tsx'
import type { DocumentItem } from './types.ts'

const STATUSES: SemaphoreStatus[] = ['GREEN', 'YELLOW', 'RED', 'GRAY']

/**
 * Provere za investitora ili projekat (F-05, F-06): pokretanje automatskih
 * (DUMMY) izvora, ručni unos sa dokumentom i istorija.
 */
export function ChecksPanel({
  target,
  market,
  documents,
  onChanged,
}: {
  target: { developerId: string } | { projectId: string }
  market: MarketCode
  documents: DocumentItem[] | undefined
  onChanged: () => void
}) {
  const st = useStaffT()
  const { l, formatDate } = useI18n()
  const { user, can } = useAuth()
  const { get } = useMarkets()
  const subject = 'developerId' in target ? 'DEVELOPER' : 'PROJECT'
  const definitions = (get(market)?.checks ?? []).filter((check) => check.subject === subject)
  const isLawyer = user?.roles.includes('LAWYER') ?? false
  const isAnalyst = user?.roles.includes('ANALYST') ?? false
  // Analitičar: MANUAL i DOCUMENT. Advokat: LAWYER i DOCUMENT. Automatske se pokreću dugmetom.
  const manualDefinitions = definitions.filter(
    (check) =>
      (isAnalyst && (check.method === 'MANUAL' || check.method === 'DOCUMENT')) ||
      (isLawyer && (check.method === 'LAWYER' || check.method === 'DOCUMENT')),
  )
  const history = useAsync(() => staffApi.checkHistory(target), ['developerId' in target ? target.developerId : target.projectId])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const titleOf = (code: string) => {
    const definition = definitions.find((check) => check.code === code)
    return definition ? l(definition.title) : code
  }

  const runAutomatic = async () => {
    setRunning(true)
    setError(null)
    try {
      await staffApi.runChecks(target)
      history.reload()
      onChanged()
    } catch (reason) {
      setError(reason)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card title={st('checks.title')}>
      <ErrorBox error={error} />
      {can('checks:manage') && definitions.some((check) => check.method === 'AUTOMATIC') && (
        <div>
          <button type="button" className="primary" onClick={() => void runAutomatic()} disabled={running}>
            {st('checks.run')}
          </button>{' '}
          <DummyTag />
          <p className="muted">{st('checks.runHint')}</p>
        </div>
      )}
      {can('checks:manage') && manualDefinitions.length > 0 && (
        <ManualCheckForm
          target={target}
          definitions={manualDefinitions.map((check) => ({ code: check.code, title: l(check.title), method: check.method }))}
          documents={documents}
          onSaved={() => {
            history.reload()
            onChanged()
          }}
        />
      )}
      <h3>{st('checks.history')}</h3>
      <ErrorBox error={history.error} />
      {!history.data || history.data.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{st('checks.definition')}</th>
                <th>{st('method')}</th>
                <th>{st('source')}</th>
                <th>{st('checkedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <SemaphoreBadge status={item.status} /> {titleOf(item.definitionCode)}
                    <div className="muted">{item.summary}</div>
                  </td>
                  <td>{st(`method.${item.method}`)}</td>
                  <td>
                    {item.source} {isDummySource(item) && <DummyTag />}
                  </td>
                  <td>
                    {formatDate(item.checkedAt)}
                    <div className="muted">
                      {st('validUntil')}: {formatDate(item.validUntil)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ManualCheckForm({
  target,
  definitions,
  documents,
  onSaved,
}: {
  target: { developerId: string } | { projectId: string }
  definitions: { code: string; title: string; method: string }[]
  documents: DocumentItem[] | undefined
  onSaved: () => void
}) {
  const st = useStaffT()
  const { t } = useI18n()
  const [definitionCode, setDefinitionCode] = useState(definitions[0]?.code ?? '')
  const [status, setStatus] = useState<SemaphoreStatus>('GREEN')
  const [summary, setSummary] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const definition = definitions.find((item) => item.code === definitionCode)
  const needsDocument = definition?.method === 'DOCUMENT' && status !== 'GRAY'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await staffApi.recordCheck({ ...target, definitionCode, status, summary: summary.trim(), documentId: documentId || undefined })
      setSummary('')
      setDocumentId('')
      onSaved()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <h3>{st('checks.manual')}</h3>
      <div className="grid">
        <Field label={st('checks.definition')}>
          <select value={definitionCode} onChange={(event) => setDefinitionCode(event.target.value)}>
            {definitions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.title} · {st(`method.${item.method as 'MANUAL'}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.status')}>
          <select value={status} onChange={(event) => setStatus(event.target.value as SemaphoreStatus)}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`semaphore.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('checks.document')}>
          <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} required={needsDocument}>
            <option value="">{st('checks.noDocument')}</option>
            {(documents ?? []).map((document) => (
              <option key={document.id} value={document.id}>
                {document.fileName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={st('checks.summary')}>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={500} />
      </Field>
      <ErrorBox error={error} />
      <button type="submit" className="primary" disabled={!definitionCode || summary.trim().length < 3 || (needsDocument && !documentId)}>
        {st('checks.save')}
      </button>
    </form>
  )
}

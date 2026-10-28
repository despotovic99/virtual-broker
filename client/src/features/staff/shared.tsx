import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { useMarkets } from '../../core/markets/MarketsContext.tsx'
import { Card, DummyTag, Empty, ErrorBox, SemaphoreBadge } from '../../ui/components.tsx'
import { staffApi } from './api.ts'
import { staffDictionary } from './i18n.ts'
import type { DocumentItem, SemaphoreItem, SemaphoreResult } from './types.ts'

export function useStaffT() {
  return useLocalT(staffDictionary)
}

/** Tržišta na kojima korisnik radi. Super admin vidi sva. */
export function useMyMarkets(): MarketCode[] {
  const { user } = useAuth()
  if (!user) return []
  if (user.roles.includes('SUPER_ADMIN')) return [...MARKETS]
  return user.markets
}

export function MarketSelect({
  value,
  onChange,
  allowAll,
}: {
  value: MarketCode | ''
  onChange: (value: MarketCode | '') => void
  allowAll?: boolean
}) {
  const { t } = useI18n()
  const st = useStaffT()
  const markets = useMyMarkets()
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as MarketCode | '')} aria-label={t('common.market')}>
      {allowAll && <option value="">{st('allMarkets')}</option>}
      {markets.map((market) => (
        <option key={market} value={market}>
          {t(`market.${market}`)}
        </option>
      ))}
    </select>
  )
}

/** Izvor provere je dummy ako tako kaže server ili ako počinje sa „DUMMY:”. */
export function isDummySource(item: { dummy: boolean; source: string | null }): boolean {
  return item.dummy || (item.source?.startsWith('DUMMY:') ?? false)
}

export function SemaphoreTable({ result, title }: { result: SemaphoreResult | null | undefined; title: string }) {
  const { t, l, formatDate } = useI18n()
  const st = useStaffT()
  if (!result) return null
  return (
    <Card
      title={title}
      actions={
        <span className="row">
          <span className="muted">{t('semaphore.overall')}:</span> <SemaphoreBadge status={result.overall} />
          {result.containsDummyData && <DummyTag />}
        </span>
      }
    >
      {result.hardBlocked && (
        <p role="alert" className="error">
          {t('semaphore.hardBlocked')}
        </p>
      )}
      {result.items.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{st('checks.definition')}</th>
                <th>{t('common.status')}</th>
                <th>{st('method')}</th>
                <th>{st('source')}</th>
                <th>{st('checkedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item: SemaphoreItem) => (
                <tr key={item.code}>
                  <td>
                    {l(item.title)}
                    {item.mandatory && <span className="muted"> · {st('mandatory')}</span>}
                    {item.summary && <div className="muted">{item.summary}</div>}
                  </td>
                  <td>
                    <SemaphoreBadge status={item.status} />
                    {item.expired && <span className="muted"> ({st('expired')})</span>}
                  </td>
                  <td>{st(`method.${item.method}`)}</td>
                  <td>
                    {item.source ?? '—'} {isDummySource(item) && <DummyTag />}
                  </td>
                  <td>
                    {formatDate(item.checkedAt)}
                    {item.validUntil && (
                      <div className="muted">
                        {st('validUntil')}: {formatDate(item.validUntil)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">{result.disclaimer ? l(result.disclaimer) : t('common.notLegalAdvice')}</p>
    </Card>
  )
}

/**
 * Dokumenta projekta ili investitora: spisak, preuzimanje i otpremanje.
 * Vrste dokumenata dolaze iz paketa tržišta (scope PROJECT ili DEVELOPER).
 */
export function DocumentsPanel({
  owner,
  market,
  documents,
  onUploaded,
  canUpload,
}: {
  owner: { scope: 'PROJECT'; projectId: string } | { scope: 'DEVELOPER'; developerId: string }
  market: MarketCode
  documents: DocumentItem[] | undefined
  onUploaded: (document: DocumentItem) => void
  canUpload: boolean
}) {
  const { l, formatDate } = useI18n()
  const st = useStaffT()
  const { get } = useMarkets()
  const types = (get(market)?.documentTypes ?? []).filter((type) => type.scopes.includes(owner.scope))
  const [typeCode, setTypeCode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const typeTitle = (code: string) => {
    const type = get(market)?.documentTypes.find((candidate) => candidate.code === code)
    return type ? l(type.title) : code
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !typeCode) return
    setBusy(true)
    setError(null)
    try {
      const document = await staffApi.uploadDocument(owner, typeCode, file)
      setFile(null)
      onUploaded(document)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={st('documents')}>
      <ErrorBox error={error} />
      {!documents ? null : documents.length === 0 ? (
        <Empty />
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <button type="button" onClick={() => void staffApi.downloadDocument(document).catch(setError)}>
                {document.fileName}
              </button>{' '}
              <span className="muted">
                {typeTitle(document.typeCode)} · {formatDate(document.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <form onSubmit={(event) => void submit(event)} className="row">
          <select value={typeCode} onChange={(event) => setTypeCode(event.target.value)} aria-label={st('documentType')} required>
            <option value="">{st('documentType')}</option>
            {types.map((type) => (
              <option key={type.code} value={type.code}>
                {l(type.title)}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-label={st('file')}
          />
          <button type="submit" className="primary" disabled={busy || !file || !typeCode}>
            {st('uploadDocument')}
          </button>
        </form>
      )}
    </Card>
  )
}

/** Mali obrazac sa jednim tekstualnim poljem i dugmetom (odgovor, razlog, napomena). */
export function TextAction({
  label,
  button,
  minLength = 1,
  maxLength,
  multiline,
  onSubmit,
  children,
}: {
  label: string
  button: string
  minLength?: number
  maxLength: number
  multiline?: boolean
  onSubmit: (value: string) => Promise<unknown>
  children?: ReactNode
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(value.trim())
      setValue('')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label className="field">
        <span className="field-label">{label}</span>
        {multiline ? (
          <textarea value={value} onChange={(event) => setValue(event.target.value)} maxLength={maxLength} />
        ) : (
          <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={maxLength} />
        )}
      </label>
      {children}
      <ErrorBox error={error} />
      <button type="submit" className="primary" disabled={busy || value.trim().length < minLength}>
        {button}
      </button>
    </form>
  )
}

/** Datum u obliku YYYY-MM-DD za <input type="date">. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

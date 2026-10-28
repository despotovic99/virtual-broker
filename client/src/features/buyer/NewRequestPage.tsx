import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, ApiError } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, Field, Page } from '../../ui/components.tsx'
import { buyerDictionary } from './i18n.ts'
import { FreeSemaphoreView } from './RequestDetailPage.tsx'
import type { BuyerRequestItem, CreateRequestBody, RequestKind } from './types.ts'

const KINDS: RequestKind[] = ['CHECK', 'QUESTION', 'GUIDED_PURCHASE']

function readKind(value: string | null): RequestKind {
  return value === 'QUESTION' || value === 'GUIDED_PURCHASE' ? value : 'CHECK'
}

function readMarket(value: string | null): MarketCode {
  return value === 'CY' ? 'CY' : 'RS'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Nova provera ili zahtev (F-35). Projekat i stan mogu doći iz stranice projekta (query parametri). */
export function NewRequestPage() {
  const { t } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const [params] = useSearchParams()
  const projectId = UUID.test(params.get('projectId') ?? '') ? (params.get('projectId') ?? undefined) : undefined
  const unitId = UUID.test(params.get('unitId') ?? '') ? (params.get('unitId') ?? undefined) : undefined

  const [kind, setKind] = useState<RequestKind>(readKind(params.get('kind')))
  const [market, setMarket] = useState<MarketCode>(readMarket(params.get('market')))
  const [form, setForm] = useState({
    listingUrl: '',
    developerName: params.get('developerName') ?? '',
    registrationNumber: '',
    parcelReference: '',
    address: '',
    question: '',
  })
  const [error, setError] = useState<unknown>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<BuyerRequestItem | null>(null)

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLocalError(null)
    const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as typeof form
    const hasTarget =
      Boolean(projectId) ||
      [trimmed.listingUrl, trimmed.developerName, trimmed.registrationNumber, trimmed.parcelReference, trimmed.address].some(Boolean)
    if (kind === 'QUESTION' && !trimmed.question) {
      setLocalError(bt('newRequest.questionRequired'))
      return
    }
    if (kind !== 'QUESTION' && !hasTarget) {
      setLocalError(bt('newRequest.atLeastOne'))
      return
    }
    const body: CreateRequestBody = { kind, market }
    if (trimmed.listingUrl) body.listingUrl = trimmed.listingUrl
    if (trimmed.developerName) body.developerName = trimmed.developerName
    if (trimmed.registrationNumber) body.registrationNumber = trimmed.registrationNumber
    if (trimmed.parcelReference) body.parcelReference = trimmed.parcelReference
    if (trimmed.address) body.address = trimmed.address
    if (trimmed.question) body.question = trimmed.question
    if (projectId) body.projectId = projectId
    if (unitId) body.unitId = unitId

    setSubmitting(true)
    try {
      setCreated(await api<BuyerRequestItem>('/requests', { method: 'POST', body }))
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'REQUEST_QUOTA_EXCEEDED') setLocalError(bt('newRequest.quotaExceeded'))
      else setError(reason)
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Page title={bt('newRequest.title')}>
        <Card>
          <p>{bt('newRequest.sent')}</p>
          <Link to={`/requests/${created.id}`}>{bt('newRequest.openDetail')}</Link>
        </Card>
        {created.freeSemaphore && <FreeSemaphoreView semaphore={created.freeSemaphore} />}
      </Page>
    )
  }

  const kindLabel: Record<RequestKind, string> = {
    CHECK: bt('newRequest.kindCheck'),
    QUESTION: bt('newRequest.kindQuestion'),
    GUIDED_PURCHASE: bt('newRequest.kindGuided'),
  }

  return (
    <Page title={bt('newRequest.title')}>
      <Card>
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field label={t('common.market')}>
            <select value={market} onChange={(event) => setMarket(readMarket(event.target.value))}>
              {MARKETS.map((code) => (
                <option key={code} value={code}>
                  {t(`market.${code}`)}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="buyer-radio">
            <legend className="field-label">{bt('newRequest.kind')}</legend>
            {KINDS.map((value) => (
              <label key={value}>
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                {kindLabel[value]}
              </label>
            ))}
          </fieldset>

          {projectId && <p className="muted">{bt('newRequest.linkedProject')}</p>}

          <Field label={bt('newRequest.listingUrl')} hint={bt('newRequest.listingUrlHint')}>
            <input
              type="url"
              inputMode="url"
              value={form.listingUrl}
              onChange={(event) => set('listingUrl')(event.target.value)}
              maxLength={500}
              placeholder="https://"
            />
          </Field>
          <Field label={bt('newRequest.developerName')}>
            <input value={form.developerName} onChange={(event) => set('developerName')(event.target.value)} maxLength={200} />
          </Field>
          <Field label={bt('newRequest.registrationNumber')} hint={bt('newRequest.registrationHint')}>
            <input
              value={form.registrationNumber}
              onChange={(event) => set('registrationNumber')(event.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
              maxLength={32}
            />
          </Field>
          <Field label={bt('newRequest.parcelReference')} hint={bt('newRequest.parcelHint')}>
            <input value={form.parcelReference} onChange={(event) => set('parcelReference')(event.target.value)} maxLength={120} />
          </Field>
          <Field label={bt('newRequest.address')}>
            <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} />
          </Field>
          {kind !== 'CHECK' && (
            <Field label={bt('newRequest.question')}>
              <textarea value={form.question} onChange={(event) => set('question')(event.target.value)} maxLength={2000} />
            </Field>
          )}

          {localError && (
            <p role="alert" className="error">
              {localError}
            </p>
          )}
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={submitting}>
            {bt('newRequest.submit')}
          </button>
        </form>
      </Card>
    </Page>
  )
}

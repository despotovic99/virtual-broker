import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, ApiError } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Button, ErrorBox, Field, FormSection, InfoTip, Notice, Page } from '../../ui/components.tsx'
import { buyerDictionary } from './i18n.ts'
import { FreeSemaphoreView, fullCheckLink } from './RequestDetailPage.tsx'
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
  const { t, formatNumber } = useI18n()
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
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<BuyerRequestItem | null>(null)

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLocalError(null)
    setQuestionError(null)
    setQuotaExceeded(false)
    const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as typeof form
    const hasTarget =
      Boolean(projectId) ||
      [trimmed.listingUrl, trimmed.developerName, trimmed.registrationNumber, trimmed.parcelReference, trimmed.address].some(Boolean)
    if (kind === 'QUESTION' && !trimmed.question) {
      setQuestionError(bt('newRequest.questionRequired'))
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
      if (reason instanceof ApiError && reason.code === 'REQUEST_QUOTA_EXCEEDED') setQuotaExceeded(true)
      else setError(reason)
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Page title={bt('newRequest.title')} crumbs={[{ label: bt('requests.title'), to: '/requests' }, { label: bt('newRequest.title') }]}>
        <div className="stack">
          <Notice
            tone="ok"
            title={bt('newRequest.sent')}
            actions={
              <Link className="btn" to={`/requests/${created.id}`}>
                {bt('newRequest.openDetail')}
              </Link>
            }
          />
          {created.freeSemaphore && (
            <FreeSemaphoreView semaphore={created.freeSemaphore} fullCheckTo={created.kind === 'CHECK' ? fullCheckLink(created) : undefined} />
          )}
        </div>
      </Page>
    )
  }

  const kindLabel: Record<RequestKind, string> = {
    CHECK: bt('newRequest.kindCheck'),
    QUESTION: bt('newRequest.kindQuestion'),
    GUIDED_PURCHASE: bt('newRequest.kindGuided'),
  }
  const kindDescription: Record<RequestKind, string> = {
    CHECK: bt('form.request.kindCheckDesc'),
    QUESTION: bt('form.request.kindQuestionDesc'),
    GUIDED_PURCHASE: bt('form.request.kindGuidedDesc'),
  }

  return (
    <Page
      title={bt('newRequest.title')}
      crumbs={[{ label: bt('requests.title'), to: '/requests' }, { label: bt('newRequest.title') }]}
      meta={<span className="page-description">{bt('form.request.description')}</span>}
    >
      <div className="form-page">
        <form className="card form-page__card" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="form-page__body">
            <FormSection title={bt('form.request.kindTitle')} description={bt('form.request.kindHint')}>
              <fieldset>
                <legend>{bt('newRequest.kind')}</legend>
                <div className="checks">
                  {KINDS.map((value) => (
                    <label key={value} className="check">
                      <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                      <span className="stack stack--sm">
                        <span className="row">
                          {kindLabel[value]}
                          {value === 'CHECK' && <InfoTip text={bt('form.request.quotaInfo')} />}
                        </span>
                        <span className="muted small">{kindDescription[value]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label={t('common.market')} required info={bt('form.request.marketInfo')}>
                <select value={market} onChange={(event) => setMarket(readMarket(event.target.value))}>
                  {MARKETS.map((code) => (
                    <option key={code} value={code}>
                      {t(`market.${code}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {projectId && (
                <Notice tone="info" icon="home">
                  {bt('newRequest.linkedProject')}
                </Notice>
              )}
            </FormSection>

            <FormSection title={bt('form.request.developerTitle')} description={bt('form.request.developerHint')}>
              <Field label={bt('newRequest.developerName')}>
                <input value={form.developerName} onChange={(event) => set('developerName')(event.target.value)} maxLength={200} />
              </Field>
              <Field
                label={bt('newRequest.registrationNumber')}
                info={market === 'RS' ? bt('form.request.registrationInfoRS') : bt('form.request.registrationInfoCY')}
                hint={bt('newRequest.registrationHint')}
              >
                <input
                  className="mono"
                  value={form.registrationNumber}
                  onChange={(event) => set('registrationNumber')(event.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
                  maxLength={32}
                />
              </Field>
              <Field label={bt('newRequest.listingUrl')} info={bt('form.request.listingInfo')} hint={bt('newRequest.listingUrlHint')} wide>
                <input
                  type="url"
                  inputMode="url"
                  value={form.listingUrl}
                  onChange={(event) => set('listingUrl')(event.target.value)}
                  maxLength={500}
                  placeholder="https://"
                />
              </Field>
            </FormSection>

            <FormSection title={bt('form.request.locationTitle')} description={bt('form.request.locationHint')}>
              <Field
                label={bt('newRequest.parcelReference')}
                info={market === 'RS' ? bt('form.request.parcelInfoRS') : bt('form.request.parcelInfoCY')}
                hint={bt('newRequest.parcelHint')}
              >
                <input className="mono" value={form.parcelReference} onChange={(event) => set('parcelReference')(event.target.value)} maxLength={120} />
              </Field>
              <Field label={bt('newRequest.address')}>
                <input value={form.address} onChange={(event) => set('address')(event.target.value)} maxLength={300} />
              </Field>
            </FormSection>

            {kind !== 'CHECK' && (
              <FormSection title={bt('form.request.questionTitle')} description={bt('form.request.questionHint')} columns={1}>
                <Field
                  label={bt('newRequest.question')}
                  required={kind === 'QUESTION'}
                  info={bt('form.request.questionInfo')}
                  hint={`${formatNumber(form.question.length)} / ${formatNumber(2000)}`}
                  error={questionError}
                >
                  <textarea value={form.question} rows={5} onChange={(event) => set('question')(event.target.value)} maxLength={2000} />
                </Field>
              </FormSection>
            )}

            {(localError || quotaExceeded || Boolean(error)) && (
              <div className="form-page__error stack">
                {localError && <Notice tone="risk">{localError}</Notice>}
                {quotaExceeded && <Notice tone="warn">{bt('newRequest.quotaExceeded')}</Notice>}
                <ErrorBox error={error} />
              </div>
            )}
          </div>
          <div className="form-page__footer">
            <span className="form-page__footer-note">
              <span className="muted small">{t('form.requiredNote')}</span>
            </span>
            <Button type="submit" variant="primary" busy={submitting}>
              {bt('newRequest.submit')}
            </Button>
          </div>
        </form>
      </div>
    </Page>
  )
}

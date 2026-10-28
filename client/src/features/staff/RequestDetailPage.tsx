import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { requestTone } from './QueuePage.tsx'
import { SemaphoreTable, TextAction, useStaffT } from './shared.tsx'
import type { AnswerScope, BuyerRequest } from './types.ts'

const OPEN_STATUSES = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM', 'ANSWERED']

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { t, formatDate } = useI18n()
  const st = useStaffT()
  const { can } = useAuth()
  const { data: loaded, error, loading } = useAsync(() => staffApi.request(id), [id])
  const [updated, setUpdated] = useState<BuyerRequest | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const request = updated && updated.id === id ? updated : loaded

  const run = async (action: () => Promise<BuyerRequest>) => {
    setActionError(null)
    try {
      setUpdated(await action())
    } catch (reason) {
      setActionError(reason)
    }
  }

  if (loading && !request) return <Loading />
  if (!request) return <ErrorBox error={error} />

  const isTriage = can('requests:triage')
  const isLegal = can('requests:answer-legal')
  const open = OPEN_STATUSES.includes(request.status)

  return (
    <Page
      title={`${st('request.title')} · ${st(`kind.${request.kind}`)}`}
      actions={<Link to="/queue">{t('common.back')}</Link>}
    >
      <ErrorBox error={actionError} />
      <Card
        actions={<StatusBadge text={st(`reqStatus.${request.status}`)} tone={requestTone(request.status)} />}
        title={`${t(`market.${request.market}`)} · ${formatDate(request.createdAt)}`}
      >
        <dl className="grid">
          <Info label={st('request.developerName')} value={request.developerName} />
          <Info label={st('request.registrationNumber')} value={request.registrationNumber} />
          <Info label={st('request.parcelReference')} value={request.parcelReference} />
          <Info label={st('request.address')} value={request.address} />
          <Info label={st('queue.due')} value={formatDate(request.firstResponseDueAt)} />
        </dl>
        {request.listingUrl?.startsWith('https://') && (
          <p>
            {st('request.listingUrl')}:{' '}
            <a href={request.listingUrl} target="_blank" rel="noopener noreferrer nofollow">
              {request.listingUrl}
            </a>
          </p>
        )}
        {request.question && (
          <>
            <h3>{st('request.question')}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{request.question}</p>
          </>
        )}
        {request.answer && (
          <>
            <h3>
              {st('request.existingAnswer')}
              {request.answerScope && <span className="muted"> · {st(`scope.${request.answerScope}`)}</span>}
            </h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{request.answer}</p>
          </>
        )}
        <div className="row">
          {isTriage && request.status === 'NEW' && (
            <button type="button" className="primary" onClick={() => void run(() => staffApi.takeRequest(request.id))}>
              {st('request.take')}
            </button>
          )}
          {request.purchaseId && <Link to={`/purchases/${request.purchaseId}`}>{st('request.goToPurchase')}</Link>}
          {isTriage && can('purchases:manage') && open && (
            <Link to={`/purchases?requestId=${request.id}`}>{st('request.openPurchase')}</Link>
          )}
          {isTriage && open && (
            <button type="button" onClick={() => void run(() => staffApi.closeRequest(request.id))}>
              {st('request.close')}
            </button>
          )}
        </div>
      </Card>

      {request.freeSemaphore && (
        <>
          <SemaphoreTable
            title={`${st('request.freeSemaphore')} · ${st('request.developerChecks')}`}
            result={request.freeSemaphore.developer ? { ...request.freeSemaphore.developer, disclaimer: request.freeSemaphore.disclaimer } : null}
          />
          <SemaphoreTable
            title={`${st('request.freeSemaphore')} · ${st('request.parcelChecks')}`}
            result={request.freeSemaphore.parcel ? { ...request.freeSemaphore.parcel, disclaimer: request.freeSemaphore.disclaimer } : null}
          />
        </>
      )}

      {isTriage && open && <LinkCard request={request} onDone={(next) => setUpdated(next)} />}

      {isTriage && open && (
        <Card title={st('request.answer')}>
          <TextAction
            label={st('request.answerHint')}
            button={st('request.sendAnswer')}
            maxLength={5000}
            multiline
            onSubmit={(answer) => run(() => staffApi.answerRequest(request.id, answer))}
          />
        </Card>
      )}

      {isTriage && open && <ForwardCard request={request} onDone={(next) => setUpdated(next)} />}

      {isLegal && request.status !== 'CLOSED' && request.status !== 'CONVERTED' && (
        <LegalAnswerCard request={request} onDone={(next) => setUpdated(next)} />
      )}
    </Page>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="muted">{label}</dt>
      <dd style={{ margin: 0 }}>{value || '—'}</dd>
    </div>
  )
}

/** Povezivanje zahteva sa investitorom, projektom i stanom iz kataloga (isto tržište). */
function LinkCard({ request, onDone }: { request: BuyerRequest; onDone: (request: BuyerRequest) => void }) {
  const st = useStaffT()
  const { t, formatMoney } = useI18n()
  const [search, setSearch] = useState(request.developerName ?? '')
  const [developerId, setDeveloperId] = useState(request.developerId ?? '')
  const [projectId, setProjectId] = useState(request.projectId ?? '')
  const [unitId, setUnitId] = useState(request.unitId ?? '')
  const [error, setError] = useState<unknown>(null)

  const developers = useAsync(() => staffApi.developers({ market: request.market, search: search.trim() || undefined }), [request.market, search])
  const projects = useAsync(
    () => (developerId ? staffApi.projects({ market: request.market, developerId }) : Promise.resolve(null)),
    [request.market, developerId],
  )
  const project = useAsync(() => (projectId ? staffApi.project(projectId) : Promise.resolve(null)), [projectId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      onDone(
        await staffApi.linkRequest(request.id, {
          developerId: developerId || undefined,
          projectId: projectId || undefined,
          unitId: unitId || undefined,
        }),
      )
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('request.link')}>
      <form onSubmit={(event) => void submit(event)}>
        <Field label={t('common.search')}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
        </Field>
        <Field label={st('request.linkDeveloper')}>
          <select
            value={developerId}
            onChange={(event) => {
              setDeveloperId(event.target.value)
              setProjectId('')
              setUnitId('')
            }}
          >
            <option value="">—</option>
            {(developers.data ?? []).map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name} · {developer.registrationNumber}
              </option>
            ))}
          </select>
        </Field>
        {developerId && (
          <Field label={st('request.linkProject')}>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value)
                setUnitId('')
              }}
            >
              <option value="">—</option>
              {(projects.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.city}
                </option>
              ))}
            </select>
          </Field>
        )}
        {projectId && (
          <Field label={st('request.linkUnit')}>
            <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="">—</option>
              {(project.data?.units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id} disabled={unit.status !== 'AVAILABLE'}>
                  {unit.label} · {unit.area} m² · {formatMoney(unit.price)} · {st(`unitStatus.${unit.status}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ErrorBox error={error ?? developers.error} />
        <button type="submit" className="primary" disabled={!developerId && !projectId}>
          {t('common.save')}
        </button>
      </form>
    </Card>
  )
}

/** Prosleđivanje pravnom timu: aktivni timovi tržišta bez sukoba interesa sa investitorom. */
function ForwardCard({ request, onDone }: { request: BuyerRequest; onDone: (request: BuyerRequest) => void }) {
  const st = useStaffT()
  const teams = useAsync(() => staffApi.availableTeams(request.market, request.developerId), [request.market, request.developerId])
  const [teamId, setTeamId] = useState(request.legalTeamId ?? '')
  const [error, setError] = useState<unknown>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      onDone(await staffApi.forwardRequest(request.id, teamId.trim()))
    } catch (reason) {
      setError(reason)
    }
  }

  const options = teams.data ?? []

  return (
    <Card title={st('request.forward')}>
      <form onSubmit={(event) => void submit(event)}>
        <Field label={st('request.legalTeamId')}>
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">—</option>
            {options.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorBox error={teams.error} />
        <ErrorBox error={error} />
        <button type="submit" className="primary" disabled={teamId.trim().length !== 36}>
          {st('request.forward')}
        </button>
      </form>
    </Card>
  )
}

function LegalAnswerCard({ request, onDone }: { request: BuyerRequest; onDone: (request: BuyerRequest) => void }) {
  const st = useStaffT()
  const [scope, setScope] = useState<AnswerScope>('INFORMATION')
  return (
    <Card title={st('request.answer')}>
      <TextAction
        label={st('request.answer')}
        button={st('request.sendAnswer')}
        maxLength={5000}
        multiline
        onSubmit={async (answer) => onDone(await staffApi.legalAnswerRequest(request.id, answer, scope))}
      >
        <Field label={st('request.answerScope')}>
          <select value={scope} onChange={(event) => setScope(event.target.value as AnswerScope)}>
            <option value="INFORMATION">{st('scope.INFORMATION')}</option>
            <option value="ENGAGED_ADVICE">{st('scope.ENGAGED_ADVICE')}</option>
          </select>
        </Field>
      </TextAction>
    </Card>
  )
}

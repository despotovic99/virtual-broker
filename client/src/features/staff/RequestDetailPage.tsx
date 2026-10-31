import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Button, Card, ErrorBox, ErrorState, Field, FormSection, Loading, Notice, Page, StatusBadge, Tag } from '../../ui/components.tsx'
import { ConfirmDialog, FormModal } from '../../ui/Modal.tsx'
import { statusSignal } from '../../ui/status.ts'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { isRequestLate, LateChip, PICK_PAGE, SemaphoreTable, useStaffT } from './shared.tsx'
import type { AnswerScope, BuyerRequest } from './types.ts'

const OPEN_STATUSES = ['NEW', 'IN_TRIAGE', 'WITH_LEGAL_TEAM', 'ANSWERED']

type Dialog = 'answer' | 'legalAnswer' | 'forward' | 'link' | 'close' | null

/**
 * Detalj zahteva za naš tim i pravni tim. Sve radnje su u bočnoj kartici
 * „Radnje”; one koje traže unos otvaraju modal, zatvaranje traži potvrdu.
 */
export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { t, formatDate } = useI18n()
  const st = useStaffT()
  const { can } = useAuth()
  const { data: loaded, error, loading, reload } = useAsync(() => staffApi.request(id), [id])
  const [updated, setUpdated] = useState<BuyerRequest | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const [taking, setTaking] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const request = updated && updated.id === id ? updated : loaded

  if (loading && !request) return <Loading />
  if (!request) return <ErrorState error={error} onRetry={reload} backTo={{ to: '/queue', label: st('queue.title') }} />

  const isTriage = can('requests:triage')
  const isLegal = can('requests:answer-legal')
  const open = OPEN_STATUSES.includes(request.status)
  const late = isRequestLate(request)
  const closedReason = open ? undefined : st('request.notOpen')
  const legalOpen = request.status !== 'CLOSED' && request.status !== 'CONVERTED'
  const canTake = isTriage && request.status === 'NEW'
  const canOpenPurchase = isTriage && can('purchases:manage') && open
  const hasActions = isTriage || isLegal || Boolean(request.purchaseId)

  const take = async () => {
    setActionError(null)
    setTaking(true)
    try {
      setUpdated(await staffApi.takeRequest(request.id))
    } catch (reason) {
      setActionError(reason)
    } finally {
      setTaking(false)
    }
  }

  return (
    <Page
      title={`${st('request.title')} · ${st(`kind.${request.kind}`)}`}
      crumbs={[{ label: st('queue.title'), to: '/queue' }, { label: st('request.title') }]}
      meta={
        <>
          <StatusBadge text={st(`reqStatus.${request.status}`)} {...statusSignal('request', request.status)} />
          <Tag>{t(`market.${request.market}`)}</Tag>
          {late && <LateChip text={st('queue.late')} />}
        </>
      }
      actions={
        <Link className="btn" to="/queue">
          {t('common.back')}
        </Link>
      }
    >
      <div className="layout-aside">
        <div className="layout-aside__main">
          <Card title={t('common.details')}>
            <dl className="dl">
              <Info label={st('request.developerName')} value={request.developerName} />
              <Info label={st('request.registrationNumber')} value={request.registrationNumber} mono />
              <Info label={st('request.parcelReference')} value={request.parcelReference} mono />
              <Info label={st('request.address')} value={request.address} />
              {request.listingUrl?.startsWith('https://') && (
                <Info
                  label={st('request.listingUrl')}
                  value={
                    <a href={request.listingUrl} target="_blank" rel="noopener noreferrer nofollow">
                      {request.listingUrl}
                    </a>
                  }
                />
              )}
              <Info label={st('request.created')} value={formatDate(request.createdAt)} mono />
              <Info
                label={st('queue.due')}
                value={
                  <span className="row">
                    <span className="mono">{formatDate(request.firstResponseDueAt)}</span>
                    {late && <LateChip text={st('queue.late')} />}
                  </span>
                }
              />
            </dl>
          </Card>

          {request.question && (
            <Card title={st('request.question')}>
              <p className="pre">{request.question}</p>
            </Card>
          )}

          {request.answer && (
            <Card
              title={st('request.existingAnswer')}
              badge={request.answerScope ? <Tag tone="info">{st(`scope.${request.answerScope}`)}</Tag> : undefined}
              footer={request.answeredAt ? <span className="meta">{formatDate(request.answeredAt)}</span> : undefined}
            >
              <p className="pre">{request.answer}</p>
            </Card>
          )}

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
        </div>

        <aside className="layout-aside__side">
          {hasActions && (
            <Card label={t('common.actions')}>
              <div className="stack">
                <ErrorBox error={actionError} />
                <div className="stack stack--sm">
                  {canTake && (
                    <Button variant="primary" busy={taking} onClick={() => void take()}>
                      {st('request.take')}
                    </Button>
                  )}
                  {isTriage && (
                    <Button icon="edit" disabled={!open} title={closedReason} onClick={() => setDialog('answer')}>
                      {st('request.answer')}
                    </Button>
                  )}
                  {isLegal && (
                    <Button
                      icon="edit"
                      disabled={!legalOpen}
                      title={legalOpen ? undefined : st('request.notOpen')}
                      onClick={() => setDialog('legalAnswer')}
                    >
                      {st('request.legalAnswer')}
                    </Button>
                  )}
                  {isTriage && (
                    <Button disabled={!open} title={closedReason} onClick={() => setDialog('link')}>
                      {st('request.link')}
                    </Button>
                  )}
                  {isTriage && (
                    <Button icon="forward" disabled={!open} title={closedReason} onClick={() => setDialog('forward')}>
                      {st('request.forward')}
                    </Button>
                  )}
                  {request.purchaseId && (
                    <Link className="btn" to={`/purchases/${request.purchaseId}`}>
                      {st('request.goToPurchase')}
                    </Link>
                  )}
                  {canOpenPurchase && (
                    <Link className="btn" to={`/purchases/new?requestId=${request.id}`}>
                      {st('request.openPurchase')}
                    </Link>
                  )}
                  {isTriage && (
                    <Button variant="quiet" disabled={!open} title={closedReason} onClick={() => setDialog('close')}>
                      {st('request.close')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {(request.developerId || request.projectId) && (
            <Card label={st('request.linked')}>
              <dl className="dl">
                {request.developerId && (
                  <Info label={st('request.linkDeveloper')} value={<Link to={`/catalog/developers/${request.developerId}`}>{st('open')}</Link>} />
                )}
                {request.projectId && (
                  <Info label={st('request.linkProject')} value={<Link to={`/catalog/projects/${request.projectId}`}>{st('open')}</Link>} />
                )}
              </dl>
            </Card>
          )}

          <AuditTrail entityId={request.id} />
        </aside>
      </div>

      {isTriage && (
        <>
          <AnswerModal
            open={dialog === 'answer'}
            onClose={() => setDialog(null)}
            title={st('request.answer')}
            description={st('form.request.answerDescription')}
            onSubmit={async (answer) => setUpdated(await staffApi.answerRequest(request.id, answer))}
          />
          <LinkModal request={request} open={dialog === 'link'} onClose={() => setDialog(null)} onDone={setUpdated} />
          <ForwardModal request={request} open={dialog === 'forward'} onClose={() => setDialog(null)} onDone={setUpdated} />
          <ConfirmDialog
            open={dialog === 'close'}
            onClose={() => setDialog(null)}
            title={st('request.close')}
            text={st('request.closeConfirm')}
            confirmLabel={st('request.close')}
            onConfirm={async () => setUpdated(await staffApi.closeRequest(request.id))}
          />
        </>
      )}
      {isLegal && (
        <AnswerModal
          open={dialog === 'legalAnswer'}
          onClose={() => setDialog(null)}
          title={st('request.legalAnswer')}
          description={st('form.request.legalAnswerDescription')}
          withScope
          onSubmit={async (answer, scope) => setUpdated(await staffApi.legalAnswerRequest(request.id, answer, scope))}
        />
      )}
    </Page>
  )
}

function Info({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono && value ? 'mono' : undefined}>{value || '—'}</dd>
    </>
  )
}

/** Odgovor kupcu (naš tim) ili pravni odgovor sa obimom (advokat). */
function AnswerModal({
  open,
  onClose,
  title,
  description,
  withScope = false,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  withScope?: boolean
  onSubmit: (answer: string, scope: AnswerScope) => Promise<unknown>
}) {
  const st = useStaffT()
  const [answer, setAnswer] = useState('')
  const [scope, setScope] = useState<AnswerScope>('INFORMATION')

  useEffect(() => {
    if (open) {
      setAnswer('')
      setScope('INFORMATION')
    }
  }, [open])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      submitLabel={st('request.sendAnswer')}
      dirty={answer.length > 0}
      disabledReason={answer.trim().length < 1 ? st('minChars', { n: 1 }) : null}
      onSubmit={() => onSubmit(answer.trim(), scope)}
    >
      {withScope ? (
        <Field label={st('request.answerScope')} required info={st('form.request.scopeInfo')}>
          <select value={scope} onChange={(event) => setScope(event.target.value as AnswerScope)}>
            <option value="INFORMATION">{st('scope.INFORMATION')}</option>
            <option value="ENGAGED_ADVICE">{st('scope.ENGAGED_ADVICE')}</option>
          </select>
        </Field>
      ) : (
        <Notice tone="plain">{st('request.answerHint')}</Notice>
      )}
      <Field label={st('request.answer')} required info={st('form.request.answerInfo')} hint={`${answer.length} / 5000`}>
        <textarea value={answer} rows={8} autoFocus onChange={(event) => setAnswer(event.target.value)} maxLength={5000} />
      </Field>
    </FormModal>
  )
}

/** Povezivanje zahteva sa investitorom, projektom i stanom iz kataloga (isto tržište). */
function LinkModal({
  request,
  open,
  onClose,
  onDone,
}: {
  request: BuyerRequest
  open: boolean
  onClose: () => void
  onDone: (request: BuyerRequest) => void
}) {
  const st = useStaffT()
  const { t, formatMoney } = useI18n()
  const [search, setSearch] = useState(request.developerName ?? '')
  const [developerId, setDeveloperId] = useState(request.developerId ?? '')
  const [projectId, setProjectId] = useState(request.projectId ?? '')
  const [unitId, setUnitId] = useState(request.unitId ?? '')

  // Svako otvaranje počinje od trenutne veze zahteva.
  useEffect(() => {
    if (!open) return
    setSearch(request.developerName ?? '')
    setDeveloperId(request.developerId ?? '')
    setProjectId(request.projectId ?? '')
    setUnitId(request.unitId ?? '')
  }, [open, request.developerName, request.developerId, request.projectId, request.unitId])

  const term = search.trim()
  const developers = useAsync(
    () => (open ? staffApi.developers({ market: request.market, search: term || undefined, ...PICK_PAGE }) : Promise.resolve(null)),
    [open, request.market, term],
  )
  const projects = useAsync(
    () => (open && developerId ? staffApi.projects({ market: request.market, developerId, ...PICK_PAGE }) : Promise.resolve(null)),
    [open, request.market, developerId],
  )
  const project = useAsync(() => (open && projectId ? staffApi.project(projectId) : Promise.resolve(null)), [open, projectId])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('request.link')}
      description={st('form.request.linkDescription')}
      size="lg"
      disabledReason={!developerId && !projectId ? st('request.pickLink') : null}
      onSubmit={async () =>
        onDone(
          await staffApi.linkRequest(request.id, {
            developerId: developerId || undefined,
            projectId: projectId || undefined,
            unitId: unitId || undefined,
          }),
        )
      }
    >
      <FormSection title={st('form.request.linkDeveloperSection')} columns={2}>
        <Field label={t('common.search')} hint={st('form.request.searchHint')}>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
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
            {(developers.data?.items ?? []).map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name} · {developer.registrationNumber}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <FormSection title={st('form.request.linkProjectSection')} columns={2}>
        <Field label={st('request.linkProject')} info={st('form.request.projectInfo')} hint={developerId ? undefined : st('request.pickDeveloperFirst')} disabled={!developerId}>
          <select
            value={projectId}
            disabled={!developerId}
            title={developerId ? undefined : st('request.pickDeveloperFirst')}
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
        <Field label={st('request.linkUnit')} info={st('form.request.unitInfo')} hint={projectId ? undefined : st('request.pickProjectFirst')} disabled={!projectId}>
          <select
            value={unitId}
            disabled={!projectId}
            title={projectId ? undefined : st('request.pickProjectFirst')}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="">—</option>
            {(project.data?.units ?? []).map((unit) => (
              <option key={unit.id} value={unit.id} disabled={unit.status !== 'AVAILABLE'}>
                {unit.label} · {unit.area} m² · {formatMoney(unit.price)} · {st(`unitStatus.${unit.status}`)}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <ErrorBox error={developers.error ?? projects.error ?? project.error} />
    </FormModal>
  )
}

/** Prosleđivanje pravnom timu: aktivni timovi tržišta bez sukoba interesa sa investitorom. */
function ForwardModal({
  request,
  open,
  onClose,
  onDone,
}: {
  request: BuyerRequest
  open: boolean
  onClose: () => void
  onDone: (request: BuyerRequest) => void
}) {
  const st = useStaffT()
  const teams = useAsync(
    () => (open ? staffApi.availableTeams(request.market, request.developerId) : Promise.resolve(null)),
    [open, request.market, request.developerId],
  )
  const [teamId, setTeamId] = useState(request.legalTeamId ?? '')

  useEffect(() => {
    if (open) setTeamId(request.legalTeamId ?? '')
  }, [open, request.legalTeamId])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('request.forward')}
      description={st('form.request.forwardDescription')}
      submitLabel={st('request.forward')}
      disabledReason={teamId.trim().length !== 36 ? st('request.pickTeam') : null}
      onSubmit={async () => onDone(await staffApi.forwardRequest(request.id, teamId.trim()))}
    >
      {teams.data && teams.data.length === 0 && (
        <Notice tone="warn" icon="warn">
          {st('form.request.noTeams')}
        </Notice>
      )}
      <Field label={st('request.legalTeamId')} required info={st('form.request.teamInfo')}>
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">—</option>
          {(teams.data ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
              {team.languages.length > 0 ? ` · ${team.languages.join(', ').toUpperCase()}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <ErrorBox error={teams.error} />
    </FormModal>
  )
}

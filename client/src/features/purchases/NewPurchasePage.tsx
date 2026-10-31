import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Avatar, Field, FormSection, InfoTip, Notice, SemaphoreBadge } from '../../ui/components.tsx'
import { Combobox } from '../../ui/Combobox.tsx'
import { FormPage } from '../../ui/FormPage.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from '../staff/api.ts'
import { purchasesApi } from './api.ts'
import { NewBuyerDrawer } from './NewBuyerDrawer.tsx'
import { usePurchaseT } from './shared.tsx'
import type { StaffMember } from './types.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Nova kupovina (`/purchases/new`).
 * - Iz zahteva (`?requestId=`): kupac i stan dolaze iz zahteva, koordinator samo potvrđuje.
 * - Bez zahteva: kupac se bira iz padajućeg menija sa pretragom (po stranama, uz „Dodaj novog kupca”
 *   koji otvara bočni panel), a stan kroz tržište → projekat → slobodan stan.
 * U oba slučaja se pre otvaranja vidi semafor: tvrda blokada sprečava otvaranje,
 * a sive obavezne provere ne sprečavaju, ali se beleže u audit.
 */
export function NewPurchasePage() {
  const tt = usePurchaseT()
  const { t, l, formatMoney, formatNumber } = useI18n()
  const { user, can } = useAuth()
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('requestId') ?? ''
  const fromRequest = UUID.test(requestId)

  // Ručni izbor
  const markets: MarketCode[] = user?.markets ?? []
  const [market, setMarket] = useState<MarketCode | ''>(markets.length === 1 ? markets[0] : '')
  const [buyer, setBuyer] = useState<StaffMember | null>(null)
  const [newBuyer, setNewBuyer] = useState<{ open: boolean; search: string }>({
    open: false,
    search: '',
  })
  const [pickedProjectId, setPickedProjectId] = useState('')
  const [pickedUnitId, setPickedUnitId] = useState('')

  const request = useAsync(() => (fromRequest ? staffApi.request(requestId) : Promise.resolve(null)), [requestId])
  const projects = useAsync(
    () => (fromRequest || !market ? Promise.resolve(null) : staffApi.projects({ market, limit: 100, offset: 0 })),
    [fromRequest, market],
  )

  const projectId = fromRequest ? (request.data?.projectId ?? null) : pickedProjectId || null
  const project = useAsync(() => (projectId ? staffApi.project(projectId) : Promise.resolve(null)), [projectId])

  if (!can('purchases:manage')) return <Navigate to="/purchases" replace />

  const unitId = fromRequest ? (request.data?.unitId ?? '') : pickedUnitId
  const loadedProject = project.data && project.data.project.id === projectId ? project.data : null
  const unit = loadedProject?.units.find((candidate) => candidate.id === unitId)
  const availableUnits = loadedProject?.units.filter((candidate) => candidate.status === 'AVAILABLE') ?? []
  const takenUnits = (loadedProject?.units.length ?? 0) - availableUnits.length
  const projectOptions = (projects.data?.items ?? []).filter((item) => item.status !== 'ARCHIVED')
  const semaphore = loadedProject?.semaphore
  const unchecked = semaphore ? [...semaphore.developer.items, ...semaphore.project.items].filter((item) => item.mandatory && item.status === 'GRAY') : []

  const disabledReason = fromRequest
    ? !request.data
      ? tt('new.loading')
      : !request.data.unitId
        ? tt('new.requestNoUnit')
        : semaphore?.hardBlocked
          ? t('semaphore.hardBlocked')
          : null
    : !buyer
      ? tt('form.newPurchase.pickBuyer')
      : !unit
        ? tt('form.newPurchase.pickUnit')
        : semaphore?.hardBlocked
          ? t('semaphore.hardBlocked')
          : null

  const submit = async () => {
    const created = await purchasesApi.create(fromRequest ? { requestId } : { unitId, buyerId: buyer?.id ?? '' })
    return `/purchases/${created.id}`
  }

  const unitText = (value: { label: string; area: number; rooms: number | null; price: number }) =>
    [value.label, `${formatNumber(value.area, 2)} m²`, value.rooms ? tt('form.newPurchase.rooms', { count: value.rooms }) : null, formatMoney(value.price)]
      .filter(Boolean)
      .join(' · ')

  const checks = semaphore && (
    <FormSection title={tt('form.newPurchase.checksTitle')} description={tt('form.newPurchase.checksHint')} columns={1}>
      <dl className="dl">
        <dt>
          <span className="row">
            {t('semaphore.overall')}
            <InfoTip text={tt('form.newPurchase.semaphoreInfo')} />
          </span>
        </dt>
        <dd>
          <SemaphoreBadge status={semaphore.overall} />
        </dd>
      </dl>
      {semaphore.hardBlocked && (
        <Notice tone="risk" icon="lock">
          {t('semaphore.hardBlocked')}
        </Notice>
      )}
      {unchecked.length > 0 && (
        <Notice
          tone="warn"
          title={
            <span className="row">
              {tt('new.uncheckedTitle')}
              <InfoTip text={tt('form.newPurchase.uncheckedInfo')} />
            </span>
          }
        >
          {tt('new.uncheckedBody', {
            items: unchecked.map((item) => l(item.title)).join(', '),
          })}
        </Notice>
      )}
    </FormSection>
  )

  return (
    <>
      <FormPage
        title={tt('new.title')}
        description={tt('form.newPurchase.description')}
        crumbs={[{ label: tt('list.title'), to: '/purchases' }, { label: tt('new.title') }]}
        backTo={fromRequest ? `/queue/${requestId}` : '/purchases'}
        onSubmit={submit}
        submitLabel={tt('new.create')}
        disabledReason={disabledReason}
        loading={fromRequest && request.loading && !request.data}
        loadError={fromRequest && !request.data ? request.error : null}
        onRetry={request.reload}
      >
        {fromRequest ? (
          <FormSection title={tt('form.newPurchase.sourceTitle')} description={tt('form.newPurchase.sourceHint')} columns={1}>
            <dl className="dl">
              <dt>{tt('new.request')}</dt>
              <dd>
                <Link to={`/queue/${requestId}`}>{request.data?.developerName ?? request.data?.address ?? requestId}</Link>
              </dd>
              <dt>{t('common.market')}</dt>
              <dd>{request.data ? t(`market.${request.data.market}`) : '—'}</dd>
              <dt>{tt('new.project')}</dt>
              <dd>{loadedProject ? `${loadedProject.project.name} · ${loadedProject.developer.name}` : '—'}</dd>
              <dt>
                <span className="row">
                  {tt('new.unit')}
                  <InfoTip text={tt('form.newPurchase.unitInfo')} />
                </span>
              </dt>
              <dd>{unit ? <span className="mono">{unitText(unit)}</span> : '—'}</dd>
            </dl>
            {request.data && !request.data.unitId && (
              <Notice
                tone="warn"
                actions={
                  <Link className="btn" to={`/queue/${requestId}`}>
                    {tt('new.linkRequest')}
                  </Link>
                }
              >
                {tt('new.requestNoUnit')}
              </Notice>
            )}
          </FormSection>
        ) : (
          <>
            <FormSection title={tt('form.newPurchase.buyerTitle')} description={tt('form.newPurchase.buyerHint')} columns={1}>
              <Field label={tt('form.newPurchase.buyer')} required info={tt('form.newPurchase.buyerInfo')}>
                <Combobox<StaffMember>
                  value={buyer}
                  onChange={setBuyer}
                  load={purchasesApi.buyers}
                  getKey={(item) => item.id}
                  getLabel={(item) => `${item.firstName} ${item.lastName} · ${item.email}`}
                  renderOption={(item) => (
                    <span className="person">
                      <Avatar firstName={item.firstName} lastName={item.lastName} />
                      <span className="person__text">
                        <span className="person__name">
                          {item.firstName} {item.lastName}
                        </span>
                        <span className="person__email">{item.email}</span>
                      </span>
                    </span>
                  )}
                  placeholder={tt('form.newPurchase.buyerPlaceholder')}
                  emptyText={(term) => (term ? tt('form.newPurchase.buyerNone', { term }) : tt('form.newPurchase.buyerEmpty'))}
                  action={{
                    label: tt('form.newPurchase.addBuyer'),
                    icon: 'plus',
                    onSelect: (search) => setNewBuyer({ open: true, search }),
                  }}
                />
              </Field>
            </FormSection>

            <FormSection title={tt('form.newPurchase.unitTitle')} description={tt('form.newPurchase.unitHint')}>
              {markets.length > 1 && (
                <Field label={t('common.market')} required>
                  <select
                    value={market}
                    onChange={(event) => {
                      setMarket(event.target.value as MarketCode | '')
                      setPickedProjectId('')
                      setPickedUnitId('')
                    }}
                  >
                    <option value="">{tt('form.newPurchase.choose')}</option>
                    {markets.map((code) => (
                      <option key={code} value={code}>
                        {t(`market.${code}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field
                label={tt('new.project')}
                required
                info={tt('form.newPurchase.projectInfo')}
                hint={market && projects.data && projectOptions.length === 0 ? tt('form.newPurchase.noProjects') : undefined}
                disabled={!market}
              >
                <select
                  value={pickedProjectId}
                  onChange={(event) => {
                    setPickedProjectId(event.target.value)
                    setPickedUnitId('')
                  }}
                  disabled={!market || projects.loading}
                >
                  <option value="">{projects.loading ? t('common.loading') : tt('form.newPurchase.choose')}</option>
                  {projectOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.city}
                      {item.developerName ? ` · ${item.developerName}` : ''}
                      {item.status === 'DRAFT' ? ` (${tt('form.newPurchase.draft')})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={tt('new.unit')}
                required
                info={tt('form.newPurchase.unitIdInfo')}
                hint={
                  loadedProject
                    ? availableUnits.length === 0
                      ? tt('form.newPurchase.noUnits')
                      : takenUnits > 0
                        ? tt('form.newPurchase.takenUnits', {
                            count: takenUnits,
                          })
                        : undefined
                    : undefined
                }
                disabled={!loadedProject}
              >
                <select value={pickedUnitId} onChange={(event) => setPickedUnitId(event.target.value)} disabled={!loadedProject || availableUnits.length === 0}>
                  <option value="">{projectId && !loadedProject ? t('common.loading') : tt('form.newPurchase.choose')}</option>
                  {availableUnits.map((item) => (
                    <option key={item.id} value={item.id}>
                      {unitText(item)}
                    </option>
                  ))}
                </select>
              </Field>
            </FormSection>
          </>
        )}

        {checks}
      </FormPage>

      {/* Van obrasca strane (panel ima svoj obrazac). */}
      {!fromRequest && (
        <NewBuyerDrawer
          open={newBuyer.open}
          initialSearch={newBuyer.search}
          onClose={() => setNewBuyer((current) => ({ ...current, open: false }))}
          onCreated={setBuyer}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import {
  Button,
  Card,
  DummyTag,
  ErrorBox,
  ErrorState,
  Loading,
  Notice,
  Page,
  SemaphoreBadge,
  StatusBadge,
  Tag,
} from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { statusSignal } from '../../ui/status.ts'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination } from '../../ui/usePagination.ts'
import { CostBreakdownView } from './CostBreakdownView.tsx'
import { buyerDictionary } from './i18n.ts'
import { SemaphoreDisclaimer, SemaphoreItems, SemaphoreSummary } from './SemaphoreView.tsx'
import { isDummy, type CostCalculation, type PriceEstimate, type ProjectDetail, type UnitItem } from './types.ts'

/** Procena cene i ukupan trošak za izabran stan. Tržišni indeks je DUMMY (F-09). */
function UnitInsight({ detail, unit }: { detail: ProjectDetail; unit: UnitItem }) {
  const { l, formatMoney } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const market = detail.project.market

  const estimate = useAsync(
    () =>
      api<PriceEstimate>(
        `/costs/price-estimate${query({ market, city: detail.project.city, area: unit.area, price: unit.price })}`,
      ),
    [market, detail.project.city, unit.id],
  )
  const costs = useAsync(
    () =>
      api<CostCalculation>('/costs/calculate', {
        method: 'POST',
        body: { market, price: unit.price, area: unit.area },
      }),
    [market, unit.id],
  )

  const guidedLink = `/requests/new${query({ kind: 'GUIDED_PURCHASE', market, projectId: detail.project.id, unitId: unit.id })}`
  const askLink = `/requests/new${query({ kind: 'QUESTION', market, projectId: detail.project.id, unitId: unit.id })}`
  const verdict = estimate.data?.verdict ?? null

  return (
    <>
      <div className="row row--between">
        <h2>{bt('project.selected', { label: unit.label })}</h2>
        <div className="row">
          <Link className="btn" to={askLink}>
            {bt('project.askLegal')}
          </Link>
          <Link className="btn btn--primary" to={guidedLink}>
            {bt('project.guided')}
          </Link>
        </div>
      </div>

      <Card title={bt('project.priceEstimate')} badge={estimate.data && isDummy(estimate.data) ? <DummyTag /> : undefined}>
        <ErrorBox error={estimate.error} onRetry={estimate.reload} />
        {estimate.loading && !estimate.data && <Loading inline rows={2} />}
        {estimate.data && (
          <div className="stack">
            <div className="ledger__rows">
              <div className="ledger__row">
                <span>{bt('project.marketAverage')}</span>
                <span>{formatMoney(estimate.data.averagePricePerM2)}</span>
              </div>
              {estimate.data.pricePerM2 !== null && (
                <div className="ledger__row">
                  <span>{bt('project.thisUnit')}</span>
                  <span>{formatMoney(estimate.data.pricePerM2)}</span>
                </div>
              )}
              {estimate.data.deviationPercent !== null && (
                <div className="ledger__row">
                  <span>{bt('project.deviation')}</span>
                  <span>
                    {estimate.data.deviationPercent > 0 ? '+' : ''}
                    {estimate.data.deviationPercent}%
                  </span>
                </div>
              )}
            </div>
            {verdict && (
              <div className="row">
                <StatusBadge
                  text={bt(`project.verdict${verdict}`)}
                  tone={verdict === 'FAIR' ? 'ok' : 'warn'}
                  icon={verdict === 'FAIR' ? 'check' : 'warn'}
                />
              </div>
            )}
            <span className="meta">
              {bt('semaphore.source')}: {estimate.data.source}
            </span>
            <Notice tone="plain">{l(estimate.data.disclaimer)}</Notice>
          </div>
        )}
      </Card>

      <Card title={bt('project.costs')} flush={Boolean(costs.data)} footer={costs.data ? l(costs.data.disclaimer) : undefined}>
        <ErrorBox error={costs.error} onRetry={costs.reload} />
        {costs.loading && !costs.data && <Loading inline rows={3} />}
        {costs.data && <CostBreakdownView result={costs.data} />}
      </Card>
    </>
  )
}

/** Detalj projekta (F-04): opis, investitor, semafor, stanovi i, za izabran stan, procena cene i troškovi. */
export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { t, formatMoney, formatNumber, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const { data, error, loading, reload } = useAsync(() => api<ProjectDetail>(`/catalog/projects/${encodeURIComponent(id)}`), [id])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = data?.units.find((unit) => unit.id === selectedId) ?? null
  const units = useClientPagination(data?.units)

  const unitColumns: Column<UnitItem>[] = [
    { key: 'label', header: bt('project.unit'), mono: true, cell: (unit) => unit.label },
    { key: 'floor', header: bt('project.floor'), align: 'end', hideOnMobile: true, cell: (unit) => unit.floor ?? '—' },
    {
      key: 'rooms',
      header: bt('project.rooms'),
      align: 'end',
      cell: (unit) => (unit.rooms === null ? '—' : formatNumber(unit.rooms, unit.rooms % 1 === 0 ? 0 : 1)),
    },
    { key: 'area', header: bt('project.area'), align: 'end', cell: (unit) => `${formatNumber(unit.area, 2)} m²` },
    { key: 'price', header: bt('project.price'), align: 'end', cell: (unit) => formatMoney(unit.price) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (unit) => <StatusBadge text={bt(`project.unit${unit.status}`)} {...statusSignal('unit', unit.status)} />,
    },
  ]

  return (
    <Page
      title={data?.project.name ?? bt('projects.title')}
      crumbs={[{ label: bt('projects.title'), to: '/projects' }, ...(data ? [{ label: data.project.name }] : [])]}
      meta={
        data && (
          <>
            <Tag tone="info">{t(`market.${data.project.market}`)}</Tag>
            <span className="meta">{data.project.city}</span>
            <span className="muted">
              {bt('projects.developer')}: <strong>{data.developer.name}</strong>
            </span>
          </>
        )
      }
    >
      {Boolean(error) && <ErrorState error={error} onRetry={reload} backTo={{ to: '/projects', label: t('common.back') }} />}
      {loading && !data && !error && <Loading />}
      {data && (
        <div className="layout-aside">
          <div className="layout-aside__main">
            <Card
              title={t('semaphore.overall')}
              badge={
                <>
                  <SemaphoreBadge status={data.semaphore.overall} />
                  {data.semaphore.containsDummyData && <DummyTag />}
                </>
              }
            >
              <SemaphoreItems title={bt('semaphore.developer')} result={data.semaphore.developer} />
              <SemaphoreItems title={bt('semaphore.project')} result={data.semaphore.project} />
              <SemaphoreDisclaimer text={data.semaphore.disclaimer} />
            </Card>

            <DataTable
              title={bt('project.units')}
              caption={bt('project.units')}
              badge={<span className="meta">{data.project.market === 'RS' ? bt('project.priceNoteRS') : bt('project.priceNoteCY')}</span>}
              columns={unitColumns}
              rows={units.rows}
              rowKey={(unit) => unit.id}
              pagination={units.pagination}
              rowClassName={(unit) => (unit.id === selectedId ? 'selected' : undefined)}
              rowActions={(unit) => {
                const isSelected = unit.id === selectedId
                return (
                  <Button
                    size="sm"
                    variant={isSelected ? 'secondary' : 'quiet'}
                    onClick={() => setSelectedId(unit.id)}
                    disabled={isSelected}
                    title={isSelected ? bt('project.selected', { label: unit.label }) : undefined}
                  >
                    {bt('project.select')}
                  </Button>
                )
              }}
            />
            {!selected && data.units.length > 0 && <p className="muted">{bt('project.selectUnitHint')}</p>}

            {selected && <UnitInsight detail={data} unit={selected} />}
          </div>

          <div className="layout-aside__side">
            <Card label={t('semaphore.overall')}>
              <SemaphoreSummary results={[data.semaphore.developer, data.semaphore.project]} />
            </Card>

            <Card label={bt('project.about')}>
              <div className="stack">
                <dl className="dl">
                  <dt>{bt('projects.developer')}</dt>
                  <dd>{data.developer.name}</dd>
                  <dt>{bt('project.registration')}</dt>
                  <dd className="mono">{data.developer.registrationNumber}</dd>
                  <dt>{bt('newRequest.address')}</dt>
                  <dd>
                    {data.project.city}, {data.project.address}
                  </dd>
                  {data.project.parcelReference && (
                    <>
                      <dt>{bt('newRequest.parcelReference')}</dt>
                      <dd className="mono">{data.project.parcelReference}</dd>
                    </>
                  )}
                  {data.project.expectedCompletion && (
                    <>
                      <dt>{bt('projects.completion')}</dt>
                      <dd className="mono">{formatDate(data.project.expectedCompletion)}</dd>
                    </>
                  )}
                </dl>
                {data.project.description && <p className="pre muted">{data.project.description}</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}

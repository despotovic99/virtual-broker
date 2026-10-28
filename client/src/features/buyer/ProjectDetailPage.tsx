import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, DummyTag, ErrorBox, Loading, Page, SemaphoreBadge, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { CostBreakdownView } from './CostBreakdownView.tsx'
import { buyerDictionary } from './i18n.ts'
import { SemaphoreDisclaimer, SemaphoreItems } from './SemaphoreView.tsx'
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

  return (
    <>
      <Card title={bt('project.priceEstimate')} actions={estimate.data && isDummy(estimate.data) ? <DummyTag /> : undefined}>
        <ErrorBox error={estimate.error} />
        {estimate.loading && !estimate.data && <Loading />}
        {estimate.data && (
          <>
            <p>{bt('project.averagePerM2', { value: formatMoney(estimate.data.averagePricePerM2) })}</p>
            {estimate.data.pricePerM2 !== null && <p>{bt('project.thisPerM2', { value: formatMoney(estimate.data.pricePerM2) })}</p>}
            {estimate.data.verdict && (
              <p>
                <StatusBadge
                  text={bt(`project.verdict${estimate.data.verdict}`)}
                  tone={estimate.data.verdict === 'FAIR' ? 'good' : 'warn'}
                />
                {estimate.data.deviationPercent !== null && (
                  <span className="muted">
                    {' '}
                    {estimate.data.deviationPercent > 0 ? '+' : ''}
                    {estimate.data.deviationPercent}%
                  </span>
                )}
              </p>
            )}
            <p className="muted">{estimate.data.source}</p>
            <p className="muted">{l(estimate.data.disclaimer)}</p>
          </>
        )}
      </Card>

      <Card title={bt('project.costs')}>
        <ErrorBox error={costs.error} />
        {costs.loading && !costs.data && <Loading />}
        {costs.data && <CostBreakdownView result={costs.data} />}
      </Card>

      <div className="row">
        <Link to={askLink}>
          <button type="button">{bt('project.askLegal')}</button>
        </Link>
        <Link to={guidedLink}>
          <button type="button" className="primary">
            {bt('project.guided')}
          </button>
        </Link>
      </div>
    </>
  )
}

/** Detalj projekta (F-04): opis, investitor, semafor, stanovi i, za izabran stan, procena cene i troškovi. */
export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { t, formatMoney, formatNumber, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const { data, error, loading } = useAsync(() => api<ProjectDetail>(`/catalog/projects/${encodeURIComponent(id)}`), [id])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = data?.units.find((unit) => unit.id === selectedId) ?? null

  return (
    <Page title={data?.project.name ?? bt('projects.title')} actions={<Link to="/projects">{t('common.back')}</Link>}>
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card>
            <p className="muted">
              {data.project.city}, {data.project.address} · {t(`market.${data.project.market}`)}
            </p>
            <p>
              {bt('projects.developer')}: <strong>{data.developer.name}</strong> ({data.developer.registrationNumber})
            </p>
            {data.project.expectedCompletion && (
              <p className="muted">
                {bt('projects.completion')}: {formatDate(data.project.expectedCompletion)}
              </p>
            )}
            {data.project.description && <p className="buyer-answer">{data.project.description}</p>}
          </Card>

          <Card
            title={t('semaphore.overall')}
            actions={
              <div className="row">
                <SemaphoreBadge status={data.semaphore.overall} />
                {data.semaphore.containsDummyData && <DummyTag />}
              </div>
            }
          >
            {data.semaphore.hardBlocked && (
              <p role="alert" className="error">
                <strong>{t('semaphore.hardBlocked')}</strong>
              </p>
            )}
            <SemaphoreItems title={bt('semaphore.developer')} result={data.semaphore.developer} />
            <SemaphoreItems title={bt('semaphore.project')} result={data.semaphore.project} />
            <SemaphoreDisclaimer text={data.semaphore.disclaimer} />
          </Card>

          <Card title={bt('project.units')}>
            <p className="muted">{data.project.market === 'RS' ? bt('project.priceNoteRS') : bt('project.priceNoteCY')}</p>
            <div className="buyer-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{bt('project.unit')}</th>
                    <th>{bt('project.floor')}</th>
                    <th>{bt('project.rooms')}</th>
                    <th>{bt('project.area')}</th>
                    <th>{bt('project.price')}</th>
                    <th>{t('common.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.units.map((unit) => (
                    <tr key={unit.id} className={unit.id === selectedId ? 'selected' : undefined}>
                      <td>{unit.label}</td>
                      <td>{unit.floor ?? '—'}</td>
                      <td>{unit.rooms === null ? '—' : formatNumber(unit.rooms, unit.rooms % 1 === 0 ? 0 : 1)}</td>
                      <td>{formatNumber(unit.area, 2)} m²</td>
                      <td>{formatMoney(unit.price)}</td>
                      <td>
                        <StatusBadge
                          text={bt(`project.unit${unit.status}`)}
                          tone={unit.status === 'AVAILABLE' ? 'good' : unit.status === 'RESERVED' ? 'warn' : 'neutral'}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => setSelectedId(unit.id)} disabled={unit.id === selectedId}>
                          {bt('project.select')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!selected && <p className="muted">{bt('project.selectUnitHint')}</p>}
          </Card>

          {selected && (
            <>
              <h2>{bt('project.selected', { label: selected.label })}</h2>
              <UnitInsight detail={data} unit={selected} />
            </>
          )}
        </>
      )}
    </Page>
  )
}

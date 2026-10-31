import { useState } from 'react'
import { Link } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Field, Page, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { buyerDictionary } from './i18n.ts'
import type { ProjectItem, ProjectList } from './types.ts'

/**
 * Pretraga objavljenih projekata (F-04). Server kupcu vraća samo PUBLISHED projekte.
 * Filteri se primenjuju odmah (kao u ostalim tabelama); promena filtera vraća na prvu stranu.
 */
export function ProjectsPage() {
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [city, setCity] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minRooms, setMinRooms] = useState('')

  // Šalju se samo ispravne vrednosti, pa nedovršen unos (npr. „2.”) ne pokreće novu pretragu.
  const cityTerm = city.trim()
  const priceTerm = /^\d+$/.test(maxPrice) ? maxPrice : ''
  const roomsTerm = /^\d+(\.\d)?$/.test(minRooms) ? minRooms : ''
  const filtered = Boolean(market || cityTerm || priceTerm || roomsTerm)

  const list = usePagedQuery(
    (page) =>
      api<ProjectList>(
        `/catalog/projects${query({
          market,
          city: cityTerm,
          maxPrice: priceTerm || undefined,
          minRooms: roomsTerm || undefined,
          ...page,
        })}`,
      ),
    [market, cityTerm, priceTerm, roomsTerm],
  )

  const columns: Column<ProjectItem>[] = [
    {
      key: 'name',
      header: bt('projects.title'),
      cell: (project) => (
        <span className="cell-title">
          <strong>
            <Link to={`/projects/${project.id}`}>{project.name}</Link>
          </strong>
          <span className="meta">
            {project.city} · {project.address}
          </span>
        </span>
      ),
    },
    {
      key: 'market',
      header: t('common.market'),
      hideOnMobile: true,
      cell: (project) => <Tag tone="info">{t(`market.${project.market}`)}</Tag>,
    },
    { key: 'developer', header: bt('projects.developer'), cell: (project) => project.developerName ?? '—' },
    {
      key: 'completion',
      header: bt('projects.completion'),
      mono: true,
      hideOnMobile: true,
      cell: (project) => (project.expectedCompletion ? formatDate(project.expectedCompletion) : '—'),
    },
  ]

  return (
    <Page title={bt('projects.title')}>
      <DataTable
        caption={bt('projects.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(project) => project.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={filtered ? { icon: 'search', title: bt('projects.emptyTitle'), text: bt('projects.empty') } : bt('projects.none')}
        toolbar={
          <>
            <Field label={t('common.market')}>
              <select value={market} onChange={(event) => setMarket(event.target.value === 'RS' || event.target.value === 'CY' ? event.target.value : '')}>
                <option value="">{bt('projects.allMarkets')}</option>
                {MARKETS.map((code) => (
                  <option key={code} value={code}>
                    {t(`market.${code}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={bt('projects.city')}>
              <input type="search" value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} />
            </Field>
            <Field label={bt('projects.maxPrice')}>
              <input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ''))} maxLength={9} />
            </Field>
            <Field label={bt('projects.minRooms')}>
              <input
                inputMode="decimal"
                value={minRooms}
                onChange={(event) => setMinRooms(event.target.value.replace(/[^\d.]/g, ''))}
                maxLength={4}
              />
            </Field>
          </>
        }
        rowActions={(project) => (
          <Link className="btn btn--quiet btn--sm" to={`/projects/${project.id}`}>
            {t('common.details')}
          </Link>
        )}
      />
    </Page>
  )
}

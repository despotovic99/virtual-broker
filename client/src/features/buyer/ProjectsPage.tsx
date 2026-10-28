import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, query } from '../../core/api/http.ts'
import { MARKETS, type MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n, useLocalT } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { buyerDictionary } from './i18n.ts'
import type { ProjectList } from './types.ts'

interface Filters {
  market: MarketCode | ''
  city: string
  maxPrice: string
  minRooms: string
}

const EMPTY: Filters = { market: '', city: '', maxPrice: '', minRooms: '' }

/** Pretraga objavljenih projekata (F-04). Server kupcu vraća samo PUBLISHED projekte. */
export function ProjectsPage() {
  const { t, formatDate } = useI18n()
  const bt = useLocalT(buyerDictionary)
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [filters, setFilters] = useState<Filters>(EMPTY)

  const { data, error, loading } = useAsync(
    () =>
      api<ProjectList>(
        `/catalog/projects${query({
          market: filters.market,
          city: filters.city.trim(),
          maxPrice: /^\d+$/.test(filters.maxPrice) ? filters.maxPrice : undefined,
          minRooms: /^\d+(\.\d)?$/.test(filters.minRooms) ? filters.minRooms : undefined,
          limit: 50,
        })}`,
      ),
    [filters],
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFilters(draft)
  }

  return (
    <Page title={bt('projects.title')}>
      <Card>
        <form className="buyer-filters" onSubmit={onSubmit}>
          <Field label={t('common.market')}>
            <select
              value={draft.market}
              onChange={(event) => setDraft({ ...draft, market: event.target.value === 'RS' || event.target.value === 'CY' ? event.target.value : '' })}
            >
              <option value="">{bt('projects.allMarkets')}</option>
              {MARKETS.map((code) => (
                <option key={code} value={code}>
                  {t(`market.${code}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={bt('projects.city')}>
            <input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} maxLength={120} />
          </Field>
          <Field label={bt('projects.maxPrice')}>
            <input
              inputMode="numeric"
              value={draft.maxPrice}
              onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value.replace(/\D/g, '') })}
              maxLength={9}
            />
          </Field>
          <Field label={bt('projects.minRooms')}>
            <input
              inputMode="decimal"
              value={draft.minRooms}
              onChange={(event) => setDraft({ ...draft, minRooms: event.target.value.replace(/[^\d.]/g, '') })}
              maxLength={4}
            />
          </Field>
          <Field label=" ">
            <button type="submit" className="primary">
              {t('common.search')}
            </button>
          </Field>
        </form>
      </Card>

      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {data && data.items.length === 0 && <Empty text={bt('projects.empty')} />}
      {data && data.items.length > 0 && (
        <>
          <p className="muted">{bt('projects.total', { count: data.total })}</p>
          <div className="grid">
            {data.items.map((project) => (
              <Card key={project.id} title={project.name}>
                <p className="muted">
                  {project.city} · {t(`market.${project.market}`)}
                </p>
                {project.developerName && (
                  <p>
                    {bt('projects.developer')}: {project.developerName}
                  </p>
                )}
                {project.expectedCompletion && (
                  <p className="muted">
                    {bt('projects.completion')}: {formatDate(project.expectedCompletion)}
                  </p>
                )}
                <Link to={`/projects/${project.id}`}>{t('common.details')}</Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

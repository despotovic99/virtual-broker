import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Field, Page, StatusBadge } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { statusSignal } from '../../ui/status.ts'
import { Tabs, useUrlTab } from '../../ui/Tabs.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useStaffT } from './shared.tsx'
import type { Developer, Project } from './types.ts'

const TABS = ['developers', 'projects'] as const

/** Katalog (F-32): investitori i projekti na tržištima korisnika. Unos radi analitičar (catalog:manage). */
export function CatalogPage() {
  const st = useStaffT()
  const { can } = useAuth()
  const [tab, setTab] = useUrlTab(TABS, 'developers')
  const canManage = can('catalog:manage')

  return (
    <Page
      title={st('catalog.title')}
      actions={
        canManage &&
        (tab === 'developers' ? (
          <Link className="btn btn--primary" to="/catalog/developers/new">
            <Icon name="plus" size={15} />
            {st('catalog.newDeveloper')}
          </Link>
        ) : (
          <Link className="btn btn--primary" to="/catalog/projects/new">
            <Icon name="plus" size={15} />
            {st('catalog.newProject')}
          </Link>
        ))
      }
    >
      <Tabs
        label={st('catalog.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'developers', label: st('catalog.developers') },
          { id: 'projects', label: st('catalog.projects') },
        ]}
      />
      {tab === 'developers' ? <DevelopersTab canManage={canManage} /> : <ProjectsTab canManage={canManage} />}
    </Page>
  )
}

function DevelopersTab({ canManage }: { canManage: boolean }) {
  const st = useStaffT()
  const { t } = useI18n()
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [search, setSearch] = useState('')
  const term = search.trim()
  const list = usePagedQuery((page) => staffApi.developers({ market, search: term || undefined, ...page }), [market, term])

  const columns: Column<Developer>[] = [
    {
      key: 'name',
      header: st('name'),
      cell: (developer) => (
        <span className="cell-title">
          <Link to={`/catalog/developers/${developer.id}`}>
            <strong>{developer.name}</strong>
          </Link>
          {developer.address && <span className="meta">{developer.address}</span>}
        </span>
      ),
    },
    { key: 'reg', header: st('developer.registrationNumber'), mono: true, cell: (developer) => developer.registrationNumber },
    { key: 'market', header: t('common.market'), hideOnMobile: true, cell: (developer) => t(`market.${developer.market}`) },
  ]

  return (
    <DataTable
      caption={st('catalog.developers')}
      columns={columns}
      rows={list.rows}
      rowKey={(developer) => developer.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      pagination={list.pagination}
      empty={
        term || market
          ? st('catalog.noMatch')
          : {
              title: st('catalog.noDevelopers'),
              action: canManage ? (
                <Link className="btn btn--primary" to="/catalog/developers/new">
                  <Icon name="plus" size={15} />
                  {st('catalog.newDeveloper')}
                </Link>
              ) : undefined,
            }
      }
      toolbar={
        <>
          <Field label={t('common.search')}>
            <input type="search" placeholder={st('catalog.searchDeveloper')} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
          </Field>
          <Field label={t('common.market')}>
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </Field>
        </>
      }
      rowActions={(developer) => (
        <Link className="btn btn--quiet btn--sm" to={`/catalog/developers/${developer.id}`}>
          {st('open')}
        </Link>
      )}
    />
  )
}

function ProjectsTab({ canManage }: { canManage: boolean }) {
  const st = useStaffT()
  const { t } = useI18n()
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [city, setCity] = useState('')
  const term = city.trim()
  const list = usePagedQuery((page) => staffApi.projects({ market, city: term || undefined, ...page }), [market, term])
  const columns = useProjectColumns(true)

  return (
    <DataTable
      caption={st('catalog.projects')}
      columns={columns}
      rows={list.rows}
      rowKey={(project) => project.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      pagination={list.pagination}
      empty={
        term || market
          ? st('catalog.noMatch')
          : {
              title: st('catalog.noProjects'),
              action: canManage ? (
                <Link className="btn btn--primary" to="/catalog/projects/new">
                  <Icon name="plus" size={15} />
                  {st('catalog.newProject')}
                </Link>
              ) : undefined,
            }
      }
      toolbar={
        <>
          <Field label={st('project.city')}>
            <input type="search" value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} />
          </Field>
          <Field label={t('common.market')}>
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </Field>
        </>
      }
      rowActions={(project) => (
        <Link className="btn btn--quiet btn--sm" to={`/catalog/projects/${project.id}`}>
          {st('open')}
        </Link>
      )}
    />
  )
}

/** Kolone tabele projekata (katalog i projekti jednog investitora). */
export function useProjectColumns(withDeveloper: boolean): Column<Project>[] {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const columns: (Column<Project> | null)[] = [
    {
      key: 'name',
      header: st('name'),
      cell: (project) => (
        <span className="cell-title">
          <Link to={`/catalog/projects/${project.id}`}>
            <strong>{project.name}</strong>
          </Link>
          <span className="meta">{project.address}</span>
        </span>
      ),
    },
    withDeveloper ? { key: 'developer', header: st('project.developer'), hideOnMobile: true, cell: (project) => project.developerName ?? '—' } : null,
    {
      key: 'city',
      header: st('project.city'),
      cell: (project) => (
        <>
          {project.city} <span className="muted">· {t(`market.${project.market}`)}</span>
        </>
      ),
    },
    {
      key: 'completion',
      header: st('project.expectedCompletion'),
      mono: true,
      hideOnMobile: true,
      cell: (project) => formatDate(project.expectedCompletion),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (project) => <StatusBadge text={st(`projStatus.${project.status}`)} {...statusSignal('project', project.status)} />,
    },
  ]
  return columns.filter((column): column is Column<Project> => column !== null)
}

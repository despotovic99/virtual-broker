import { Link } from 'react-router'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Page, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { ActiveBadge, useStaffT } from './shared.tsx'
import type { LegalTeam } from './types.ts'

/** Spisak jezika tima kao oznake. */
export function TeamLanguages({ languages }: { languages: string[] }) {
  if (languages.length === 0) return <>—</>
  return (
    <span className="row">
      {languages.map((language) => (
        <Tag key={language}>{language.toUpperCase()}</Tag>
      ))}
    </span>
  )
}

/**
 * Pravni timovi (F-13, F-31): tabela timova; nov tim, detalj (članovi) i
 * izmena su posebne strane. Server vraća ceo spisak, pa je paginacija u memoriji.
 */
export function LegalTeamsPage() {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { data, error, loading, reload } = useAsync(() => staffApi.legalTeams(), [])
  const { rows, pagination } = useClientPagination(data)

  const columns: Column<LegalTeam>[] = [
    {
      key: 'name',
      header: st('name'),
      cell: (team) => (
        <span className="cell-title">
          <Link to={`/admin/legal-teams/${team.id}`}>
            <strong>{team.name}</strong>
          </Link>
          <span className="meta">{formatDate(team.createdAt)}</span>
        </span>
      ),
    },
    { key: 'market', header: t('common.market'), cell: (team) => t(`market.${team.market}`) },
    { key: 'languages', header: st('teams.languagesShort'), hideOnMobile: true, cell: (team) => <TeamLanguages languages={team.languages} /> },
    { key: 'members', header: st('teams.members'), align: 'end', cell: (team) => team.members.length },
    { key: 'active', header: t('common.status'), cell: (team) => <ActiveBadge active={team.active} /> },
  ]

  return (
    <Page
      title={st('teams.title')}
      actions={
        <Link className="btn btn--primary" to="/admin/legal-teams/new">
          <Icon name="plus" size={15} />
          {st('teams.new')}
        </Link>
      }
    >
      <DataTable
        caption={st('teams.title')}
        columns={columns}
        rows={rows}
        rowKey={(team) => team.id}
        loading={loading}
        error={error}
        onRetry={reload}
        pagination={pagination}
        empty={{
          title: st('teams.none'),
          action: (
            <Link className="btn btn--primary" to="/admin/legal-teams/new">
              <Icon name="plus" size={15} />
              {st('teams.new')}
            </Link>
          ),
        }}
        rowActions={(team) => (
          <span className="row-actions">
            <Link className="btn btn--quiet btn--sm" to={`/admin/legal-teams/${team.id}`}>
              {st('open')}
            </Link>
            <Link className="btn btn--quiet btn--sm" to={`/admin/legal-teams/${team.id}/edit`}>
              <Icon name="edit" size={13} />
              {t('common.edit')}
            </Link>
          </span>
        )}
      />
    </Page>
  )
}

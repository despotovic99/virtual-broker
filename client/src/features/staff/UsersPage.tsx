import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Button, Field, Page, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { usePagedQuery } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { ActiveBadge, MarketSelect, useStaffT } from './shared.tsx'
import type { AdminUser } from './types.ts'
import { ASSIGNABLE_ROLES, useEditLockReason } from './userForm.tsx'

/**
 * Lista korisnika: filteri, tabela sa paginacijom (20/50/100). Nov korisnik
 * i izmena idu na posebne strane (`/admin/users/new`, `/admin/users/:id/edit`).
 */
export function UsersPage() {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { can } = useAuth()
  const lockReason = useEditLockReason()
  const [role, setRole] = useState<Role | ''>('')
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [search, setSearch] = useState('')
  const term = search.trim()

  const list = usePagedQuery((page) => staffApi.users({ role, market, search: term || undefined, ...page }), [role, market, term])

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: st('users.name'),
      cell: (user) => (
        <span className="cell-title">
          <strong>
            {user.firstName} {user.lastName}
          </strong>
          <span className="meta">{user.email}</span>
        </span>
      ),
    },
    {
      key: 'roles',
      header: st('roles'),
      cell: (user) => (
        <span className="row">
          {user.roles.map((value) => (
            <Tag key={value}>{st(`role.${value}`)}</Tag>
          ))}
        </span>
      ),
    },
    {
      key: 'markets',
      header: st('markets'),
      hideOnMobile: true,
      cell: (user) =>
        user.markets.length === 0 ? (
          '—'
        ) : (
          <span className="row">
            {user.markets.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </span>
        ),
    },
    { key: 'status', header: t('common.status'), cell: (user) => <ActiveBadge active={user.isActive} /> },
    { key: 'lastLogin', header: st('users.lastLogin'), mono: true, hideOnMobile: true, cell: (user) => formatDate(user.lastLoginAt) },
  ]

  return (
    <Page
      title={st('users.title')}
      actions={
        <>
          {can('audit:read') && (
            <Link className="btn" to="/admin/audit">
              {st('users.audit')}
            </Link>
          )}
          {can('users:create') && (
            <Link className="btn btn--primary" to="/admin/users/new">
              <Icon name="plus" size={15} />
              {st('users.new')}
            </Link>
          )}
        </>
      }
    >
      <DataTable
        caption={st('users.title')}
        columns={columns}
        rows={list.rows}
        rowKey={(user) => user.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pagination={list.pagination}
        empty={term || role || market ? st('users.noMatch') : st('users.none')}
        toolbar={
          <>
            <Field label={t('common.search')}>
              <input type="search" placeholder={st('users.search')} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
            </Field>
            <Field label={st('roles')}>
              <select value={role} onChange={(event) => setRole(event.target.value as Role | '')}>
                <option value="">{st('all')}</option>
                {[...ASSIGNABLE_ROLES, 'SUPER_ADMIN' as Role].map((value) => (
                  <option key={value} value={value}>
                    {st(`role.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('common.market')}>
              <MarketSelect value={market} onChange={setMarket} allowAll />
            </Field>
          </>
        }
        rowActions={
          can('users:update')
            ? (user) => {
                const reason = lockReason(user)
                return reason ? (
                  <Button size="sm" variant="quiet" icon="edit" disabled title={reason}>
                    {t('common.edit')}
                  </Button>
                ) : (
                  <Link className="btn btn--quiet btn--sm" to={`/admin/users/${user.id}/edit`}>
                    <Icon name="edit" size={13} />
                    {t('common.edit')}
                  </Link>
                )
              }
            : undefined
        }
      />
    </Page>
  )
}

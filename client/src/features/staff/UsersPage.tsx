import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Card, Empty, ErrorBox, Field, Loading, Page, StatusBadge } from '../../ui/components.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { staffApi } from './api.ts'
import { MarketSelect, useMyMarkets, useStaffT } from './shared.tsx'
import type { AdminUser } from './types.ts'

/** Uloge koje se mogu dodeliti kroz API. SUPER_ADMIN se nikad ne nudi (server ga odbija). */
const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT', 'BUYER', 'INVESTOR']
/** Uloge vezane za tržište (server: MARKET_SCOPED_ROLES). */
const MARKET_SCOPED: Role[] = ['ADMIN', 'ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT']
/** Šta sme da dodeli admin koji nije super admin (server: ROLE_CAN_ASSIGN). */
const ADMIN_CAN_ASSIGN: Role[] = ['ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT', 'BUYER']

function useAssignableRoles(): Role[] {
  const { user } = useAuth()
  if (user?.roles.includes('SUPER_ADMIN')) return ASSIGNABLE_ROLES
  if (user?.roles.includes('ADMIN')) return ADMIN_CAN_ASSIGN
  return []
}

export function UsersPage() {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { can } = useAuth()
  const [role, setRole] = useState<Role | ''>('')
  const [market, setMarket] = useState<MarketCode | ''>('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const { data, error, loading, reload } = useAsync(
    () => staffApi.users({ role, market, search: search.trim() || undefined, limit: 100 }),
    [role, market, search],
  )

  return (
    <Page title={st('users.title')} actions={can('audit:read') ? <Link to="/admin/audit">{st('users.audit')}</Link> : undefined}>
      <Card
        actions={
          <div className="row">
            <input placeholder={st('users.search')} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
            <select value={role} onChange={(event) => setRole(event.target.value as Role | '')} aria-label={st('roles')}>
              <option value="">{st('all')}</option>
              {[...ASSIGNABLE_ROLES, 'SUPER_ADMIN' as Role].map((value) => (
                <option key={value} value={value}>
                  {st(`role.${value}`)}
                </option>
              ))}
            </select>
            <MarketSelect value={market} onChange={setMarket} allowAll />
          </div>
        }
      >
        <ErrorBox error={error} />
        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{st('name')}</th>
                  <th>{st('roles')}</th>
                  <th>{st('markets')}</th>
                  <th>{t('common.status')}</th>
                  <th>{st('users.lastLogin')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.firstName} {user.lastName}
                      <div className="muted">{user.email}</div>
                    </td>
                    <td>{user.roles.map((value) => st(`role.${value}`)).join(', ')}</td>
                    <td>{user.markets.join(', ') || '—'}</td>
                    <td>
                      <StatusBadge text={user.isActive ? st('active') : st('inactive')} tone={user.isActive ? 'good' : 'bad'} />
                    </td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td>
                      {can('users:update') && !user.roles.includes('SUPER_ADMIN') && (
                        <button type="button" onClick={() => setEditing(user)}>
                          {t('common.edit')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && (
        <EditUserCard
          key={editing.id}
          user={editing}
          onDone={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {can('users:create') && <NewUserCard onCreated={reload} />}
    </Page>
  )
}

function RolesAndMarkets({
  roles,
  markets,
  onRoles,
  onMarkets,
}: {
  roles: Role[]
  markets: MarketCode[]
  onRoles: (roles: Role[]) => void
  onMarkets: (markets: MarketCode[]) => void
}) {
  const st = useStaffT()
  const { t } = useI18n()
  const assignable = useAssignableRoles()
  const myMarkets = useMyMarkets()
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

  return (
    <>
      <fieldset className="field">
        <legend className="field-label">{st('roles')}</legend>
        <div className="row">
          {assignable.map((role) => (
            <label key={role} className="row">
              <input type="checkbox" style={{ width: 'auto' }} checked={roles.includes(role)} onChange={() => onRoles(toggle(roles, role))} />
              {st(`role.${role}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field-label">{st('markets')}</legend>
        <div className="row">
          {myMarkets.map((market) => (
            <label key={market} className="row">
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={markets.includes(market)}
                onChange={() => onMarkets(toggle(markets, market))}
              />
              {t(`market.${market}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function needsMarket(roles: Role[], markets: MarketCode[]): boolean {
  return roles.some((role) => MARKET_SCOPED.includes(role)) && markets.length === 0
}

function NewUserCard({ onCreated }: { onCreated: () => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [roles, setRoles] = useState<Role[]>([])
  const [markets, setMarkets] = useState<MarketCode[]>([])
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)
  const missingMarket = needsMarket(roles, markets)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await staffApi.createUser({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        roles,
        markets,
      })
      setForm({ email: '', password: '', firstName: '', lastName: '' })
      setRoles([])
      setMarkets([])
      setSaved(true)
      onCreated()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={st('users.new')}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="grid">
          <Field label={st('users.firstName')}>
            <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} maxLength={100} required />
          </Field>
          <Field label={st('users.lastName')}>
            <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} maxLength={100} required />
          </Field>
          <Field label={st('email')}>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} required />
          </Field>
          <Field label={st('users.password')}>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
        </div>
        <RolesAndMarkets roles={roles} markets={markets} onRoles={setRoles} onMarkets={setMarkets} />
        {missingMarket && <p className="error">{st('users.marketsRequired')}</p>}
        <ErrorBox error={error} />
        {saved && <p className="muted">{st('saved')}</p>}
        <button
          type="submit"
          className="primary"
          disabled={!form.email || form.password.length < 12 || !form.firstName || !form.lastName || roles.length === 0 || missingMarket}
        >
          {t('common.add')}
        </button>
      </form>
    </Card>
  )
}

function EditUserCard({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [markets, setMarkets] = useState<MarketCode[]>(user.markets)
  const [isActive, setIsActive] = useState(user.isActive)
  const [error, setError] = useState<unknown>(null)
  const missingMarket = needsMarket(roles, markets)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await staffApi.updateUser(user.id, { firstName: firstName.trim(), lastName: lastName.trim(), roles, markets, isActive })
      onDone()
    } catch (reason) {
      setError(reason)
    }
  }

  return (
    <Card title={`${st('users.edit')}: ${user.email}`}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="grid">
          <Field label={st('users.firstName')}>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required />
          </Field>
          <Field label={st('users.lastName')}>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required />
          </Field>
        </div>
        <RolesAndMarkets roles={roles} markets={markets} onRoles={setRoles} onMarkets={setMarkets} />
        <label className="row">
          <input type="checkbox" style={{ width: 'auto' }} checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          {st('active')}
        </label>
        {missingMarket && <p className="error">{st('users.marketsRequired')}</p>}
        <ErrorBox error={error} />
        <div className="row">
          <button type="submit" className="primary" disabled={roles.length === 0 || missingMarket}>
            {t('common.save')}
          </button>
          <button type="button" onClick={onDone}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Card>
  )
}

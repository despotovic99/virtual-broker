import { useAuth } from '../../core/auth/AuthContext.tsx'
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { Icon } from '../../ui/icons.tsx'
import { useMyMarkets, useStaffT } from './shared.tsx'
import type { AdminUser } from './types.ts'

/** Uloge koje se mogu dodeliti kroz API. SUPER_ADMIN se nikad ne nudi (server ga odbija). */
export const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT', 'BUYER', 'INVESTOR']
/** Uloge vezane za tržište (server: MARKET_SCOPED_ROLES). */
const MARKET_SCOPED: Role[] = ['ADMIN', 'ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT']
/** Šta sme da dodeli admin koji nije super admin (server: ROLE_CAN_ASSIGN). */
const ADMIN_CAN_ASSIGN: Role[] = ['ANALYST', 'COORDINATOR', 'LAWYER', 'ENGINEER', 'ESCROW_AGENT', 'BUYER']

export function useAssignableRoles(): Role[] {
  const { user } = useAuth()
  if (user?.roles.includes('SUPER_ADMIN')) return ASSIGNABLE_ROLES
  if (user?.roles.includes('ADMIN')) return ADMIN_CAN_ASSIGN
  return []
}

/** Kao na serveru: super admin se ne menja, a nalog menja samo onaj ko sme da dodeli sve njegove uloge. */
export function useEditLockReason(): (target: AdminUser) => string | undefined {
  const st = useStaffT()
  const assignable = useAssignableRoles()
  return (target) => {
    if (target.roles.includes('SUPER_ADMIN')) return st('users.superAdminLocked')
    if (!target.roles.every((role) => assignable.includes(role))) return st('users.onlySuperAdmin')
    return undefined
  }
}

export function needsMarket(roles: Role[], markets: MarketCode[]): boolean {
  return roles.some((role) => MARKET_SCOPED.includes(role)) && markets.length === 0
}

/** Uloge i tržišta kao grupe prekidača; korisnik može imati više uloga. */
export function RolesAndMarkets({
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
      <fieldset>
        <legend>{st('roles')}</legend>
        <div className="checks checks--inline">
          {assignable.map((role) => (
            <label key={role} className="check">
              <input type="checkbox" checked={roles.includes(role)} onChange={() => onRoles(toggle(roles, role))} />
              {st(`role.${role}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{st('markets')}</legend>
        <div className="checks checks--inline">
          {myMarkets.map((market) => (
            <label key={market} className="check">
              <input type="checkbox" checked={markets.includes(market)} onChange={() => onMarkets(toggle(markets, market))} />
              {t(`market.${market}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

/** Uloga vezana za tržište traži bar jedno tržište: greška uz grupu polja. */
export function MarketsRequired() {
  const st = useStaffT()
  return (
    <p className="error" role="alert">
      <Icon name="alert" size={14} />
      {st('users.marketsRequired')}
    </p>
  )
}

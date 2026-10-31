import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './core/auth/AuthContext.tsx'
import type { Role } from './core/auth/capabilities.ts'
import { LoginPage } from './core/auth/LoginPage.tsx'
import { RegisterPage } from './core/auth/RegisterPage.tsx'
import { AppLayout } from './core/layout/AppLayout.tsx'
import { NotificationsPage } from './core/layout/NotificationsPage.tsx'
import { SettingsPage } from './core/settings/SettingsPage.tsx'
import { MarketsProvider } from './core/markets/MarketsContext.tsx'
import { useI18n } from './core/i18n/I18nContext.tsx'
import { buyerNav, buyerRoutes } from './features/buyer/routes.tsx'
import { purchasesNav, purchasesRoutes } from './features/purchases/routes.tsx'
import { staffNav, staffRoutes } from './features/staff/routes.tsx'

/**
 * Početna strana po najvažnijoj ulozi. Korisnik može imati više uloga; uloga
 * tima uvek ima prednost pred ulogom kupca.
 */
const HOME_BY_ROLE: readonly [Role, string][] = [
  ['SUPER_ADMIN', '/admin/users'],
  ['ADMIN', '/admin/users'],
  ['COORDINATOR', '/purchases'],
  ['ANALYST', '/queue'],
  ['ESCROW_AGENT', '/escrow'],
  ['LAWYER', '/purchases'],
  ['ENGINEER', '/purchases'],
  ['BUYER', '/requests'],
]

function Home() {
  const { user } = useAuth()
  if (!user) return null
  const target = HOME_BY_ROLE.find(([role]) => user.roles.includes(role))?.[1] ?? '/purchases'
  return <Navigate to={target} replace />
}

export function App() {
  const { status } = useAuth()
  const { t } = useI18n()

  if (status === 'loading') return <p className="muted center">{t('common.loading')}</p>

  if (status === 'anonymous') {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <MarketsProvider>
      <Routes>
        <Route element={<AppLayout navItems={[...buyerNav, ...purchasesNav, ...staffNav]} />}>
          <Route index element={<Home />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {[...buyerRoutes, ...purchasesRoutes, ...staffRoutes].map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MarketsProvider>
  )
}

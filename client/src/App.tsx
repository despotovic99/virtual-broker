import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './core/auth/AuthContext.tsx'
import { LoginPage } from './core/auth/LoginPage.tsx'
import { RegisterPage } from './core/auth/RegisterPage.tsx'
import { AppLayout } from './core/layout/AppLayout.tsx'
import { NotificationsPage } from './core/layout/NotificationsPage.tsx'
import { MarketsProvider } from './core/markets/MarketsContext.tsx'
import { useI18n } from './core/i18n/I18nContext.tsx'
import { buyerNav, buyerRoutes } from './features/buyer/routes.tsx'
import { purchasesNav, purchasesRoutes } from './features/purchases/routes.tsx'
import { staffNav, staffRoutes } from './features/staff/routes.tsx'

/** Početna strana zavisi od uloge: kupac ide na svoje zahteve, ostali na kupovine. */
function Home() {
  const { user } = useAuth()
  if (!user) return null
  if (user.roles.includes('BUYER')) return <Navigate to="/requests" replace />
  if (user.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')) return <Navigate to="/admin/users" replace />
  if (user.roles.includes('ESCROW_AGENT')) return <Navigate to="/escrow" replace />
  if (user.roles.includes('ANALYST')) return <Navigate to="/queue" replace />
  return <Navigate to="/purchases" replace />
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
          {[...buyerRoutes, ...purchasesRoutes, ...staffRoutes].map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MarketsProvider>
  )
}

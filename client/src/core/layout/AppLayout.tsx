import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { api } from '../api/http.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { useI18n } from '../i18n/I18nContext.tsx'
import type { NavItem } from './nav.ts'

export function AppLayout({ navItems }: { navItems: NavItem[] }) {
  const { user, can, logout } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    const load = () =>
      api<{ unread: number }>('/notifications')
        .then((data) => {
          if (active) setUnread(data.unread)
        })
        .catch(() => undefined)
    void load()
    const timer = window.setInterval(() => void load(), 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const visible = navItems
    .filter((item) => item.anyOf.some((capability) => can(capability)))
    .sort((a, b) => a.order - b.order)

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          {t('app.name')}
        </NavLink>
        <nav className="nav">
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <NavLink to="/notifications" className="notif">
            {t('nav.notifications')}
            {unread > 0 && <span className="count">{unread}</span>}
          </NavLink>
          <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'sr')}>
            <option value="sr">SR</option>
            <option value="en">EN</option>
          </select>
          <span className="muted">{user ? `${user.firstName} ${user.lastName}` : ''}</span>
          <button type="button" onClick={() => void logout()}>
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Avatar } from '../../ui/components.tsx'
import { Icon } from '../../ui/icons.tsx'
import { api } from '../api/http.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { useI18n, type Language } from '../i18n/I18nContext.tsx'
import type { NavItem } from './nav.ts'
import { Sidebar } from './Sidebar.tsx'

const LANGUAGES: Language[] = ['sr', 'en']
const COLLAPSED_KEY = 'vb.sidebar'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'collapsed'
  } catch {
    return false
  }
}

export function AppLayout({ navItems }: { navItems: NavItem[] }) {
  const { user, can, logout } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const [unread, setUnread] = useState(0)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, current ? 'expanded' : 'collapsed')
      } catch {
        // Skladište nije dostupno; izbor važi do osvežavanja.
      }
      return !current
    })

  // Fioka na telefonu se zatvara na promenu strane i na Esc.
  useEffect(() => setDrawerOpen(false), [location.pathname])
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

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

  // Uloge (prevedene) i tržišta ispod imena, npr. „analitičar · koordinator · RS, CY”.
  const roleLine = user
    ? [...user.roles.map((role) => t(`roleName.${role}`)), user.markets.join(', ')].filter(Boolean).join(' · ')
    : ''

  return (
    <div className={`app ${collapsed ? 'app--collapsed' : ''} ${drawerOpen ? 'app--drawer-open' : ''}`}>
      <Sidebar
        items={visible}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onNavigate={() => setDrawerOpen(false)}
      />
      {drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="app__main">
        <header className="topbar">
          <div className="topbar__inner">
            <button
              type="button"
              className="icon topbar__menu"
              aria-controls="app-sidebar"
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? t('sidebar.close') : t('sidebar.open')}
              title={drawerOpen ? t('sidebar.close') : t('sidebar.open')}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              <Icon name="menu" size={17} />
            </button>
            <div className="topbar-right">
              <NavLink
                to="/notifications"
                className={({ isActive }) => (isActive ? 'bell active' : 'bell')}
                aria-label={unread > 0 ? t('nav.unread', { count: unread }) : t('nav.notifications')}
                title={t('nav.notifications')}
              >
                <Icon name="bell" size={17} />
                {unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? 'bell active' : 'bell')}
                aria-label={t('nav.settings')}
                title={t('nav.settings')}
              >
                <Icon name="settings" size={17} />
              </NavLink>
              <div className="lang" role="group" aria-label="Language">
                {LANGUAGES.map((code) => (
                  <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)}>
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              {user && (
                <div className="who">
                  <Avatar firstName={user.firstName} lastName={user.lastName} />
                  <span className="who__text">
                    <span className="who__name">
                      {user.firstName} {user.lastName}
                    </span>
                    {roleLine && <span className="who__role">{roleLine}</span>}
                  </span>
                </div>
              )}
              <button type="button" className="icon" onClick={() => void logout()} aria-label={t('nav.logout')} title={t('nav.logout')}>
                <Icon name="logout" size={16} />
              </button>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

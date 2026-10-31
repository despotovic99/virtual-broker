import { NavLink } from 'react-router'
import { Icon } from '../../ui/icons.tsx'
import { useI18n } from '../i18n/I18nContext.tsx'
import { NAV_GROUPS, type NavItem } from './nav.ts'

/**
 * Levi meni: stavke sa ikonicama, grupisane po celinama. Skupljen meni
 * prikazuje samo ikonice (naziv ostaje u `title` i `aria-label`).
 */
export function Sidebar({
  items,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  items: NavItem[]
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Posle izbora stavke (zatvara fioku na telefonu). */
  onNavigate: () => void
}) {
  const { t } = useI18n()

  return (
    <aside className="sidebar" id="app-sidebar" aria-label={t('sidebar.label')}>
      <NavLink to="/" className="sidebar__brand brand" onClick={onNavigate} title={t('app.name')}>
        <span className="brand__mark">
          <Icon name="home" size={15} />
        </span>
        <span className="brand__name sidebar__label">{t('app.name')}</span>
      </NavLink>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group)
          if (groupItems.length === 0) return null
          return (
            <div key={group} className="sidebar__group">
              <span className="sidebar__group-title sidebar__label">{t(`navGroup.${group}`)}</span>
              <ul>
                {groupItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? 'sidebar__link active' : 'sidebar__link')}
                      title={collapsed ? t(item.label) : undefined}
                      aria-label={collapsed ? t(item.label) : undefined}
                      onClick={onNavigate}
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="sidebar__label">{t(item.label)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <button
        type="button"
        className="sidebar__toggle quiet"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        aria-pressed={collapsed}
      >
        <Icon name="sidebar" size={16} />
        <span className="sidebar__label">{t('sidebar.collapse')}</span>
      </button>
    </aside>
  )
}

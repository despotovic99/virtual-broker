import { useSearchParams } from 'react-router'

export interface TabSpec<T extends string> {
  id: T
  label: string
  count?: number
  /** Kartica postoji, ali trenutno nije dostupna (razlog u `disabledReason`). */
  disabledReason?: string
}

/** Izabrana kartica u URL-u (`?tab=`), pa link i „Nazad” vode na istu karticu. */
export function useUrlTab<T extends string>(ids: readonly T[], fallback: T, param = 'tab'): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(param)
  const tab = value && (ids as readonly string[]).includes(value) ? (value as T) : fallback
  const setTab = (next: T) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        if (next === fallback) updated.delete(param)
        else updated.set(param, next)
        // Strane tabela pripadaju kartici; nova kartica počinje od prve strane.
        // Kopija ključeva: brišemo dok prolazimo.
        const keys = Array.from(updated.keys())
        for (const key of keys) if (key === 'page' || key.endsWith('page')) updated.delete(key)
        return updated
      },
      { replace: true },
    )
  return [tab, setTab]
}

/** Podvučene kartice ekrana, sa brojačem po kartici. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: TabSpec<T>[]; value: T; onChange: (tab: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={tab.id === value ? 'active' : undefined}
          disabled={Boolean(tab.disabledReason)}
          title={tab.disabledReason}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && <span className="count count--quiet">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

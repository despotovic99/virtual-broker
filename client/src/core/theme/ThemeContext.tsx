import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Izbor korisnika: prati sistem, uvek svetla ili uvek tamna. */
export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

// Isti ključ čita i skripta u index.html, da se tema postavi pre prvog crtanja.
const STORAGE_KEY = 'vb.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

interface ThemeValue {
  preference: ThemePreference
  /** Tema koja je trenutno na ekranu. */
  theme: Theme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const [system, setSystem] = useState<Theme>(systemTheme)

  // Promena teme sistema dok je aplikacija otvorena.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystem(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const theme: Theme = preference === 'system' ? system : preference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Skladište nije dostupno; izbor važi do osvežavanja stranice.
    }
  }, [])

  const value = useMemo<ThemeValue>(() => ({ preference, theme, setPreference }), [preference, theme, setPreference])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme se koristi samo unutar ThemeProvider-a.')
  return context
}

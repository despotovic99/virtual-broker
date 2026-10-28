import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setRefreshHandler } from '../api/http.ts'
import { authApi, type AuthResponse, type User } from './authApi.ts'
import type { Capability } from './capabilities.ts'
import { tokenStore } from './tokenStore.ts'

type Status = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: Status
  user: User | null
  capabilities: ReadonlySet<Capability>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Samo za prikaz. Pravu proveru uvek radi server. */
  can: (capability: Capability) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Access token se osvežava ovoliko sekundi pre isteka.
const REFRESH_BEFORE_EXPIRY_SECONDS = 60

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [capabilities, setCapabilities] = useState<ReadonlySet<Capability>>(new Set())
  const refreshTimer = useRef<number | null>(null)
  const refreshInFlight = useRef<Promise<boolean> | null>(null)
  const refreshRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false))

  const clearTimer = () => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = null
  }

  const clearSession = useCallback(() => {
    clearTimer()
    tokenStore.clear()
    setUser(null)
    setCapabilities(new Set())
    setStatus('anonymous')
  }, [])

  const applySession = useCallback((session: AuthResponse) => {
    tokenStore.set(session.accessToken)
    setUser(session.user)
    setCapabilities(new Set(session.capabilities))
    setStatus('authenticated')
    clearTimer()
    const delay = Math.max(session.expiresIn - REFRESH_BEFORE_EXPIRY_SECONDS, 10) * 1000
    refreshTimer.current = window.setTimeout(() => void refreshRef.current(), delay)
  }, [])

  // Jedan refresh u isto vreme: istovremeni zahtevi sa 401 čekaju isti poziv,
  // jer server posle rotacije poništava stari refresh token.
  const refresh = useCallback((): Promise<boolean> => {
    refreshInFlight.current ??= authApi
      .refresh()
      .then((session) => {
        applySession(session)
        return true
      })
      .catch(() => {
        clearSession()
        return false
      })
      .finally(() => {
        refreshInFlight.current = null
      })
    return refreshInFlight.current
  }, [applySession, clearSession])

  useEffect(() => {
    refreshRef.current = refresh
    setRefreshHandler(refresh)
    // Posle osvežavanja stranice sesija se vraća preko refresh cookie-ja.
    void refresh()
    return () => {
      setRefreshHandler(null)
      clearTimer()
    }
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await authApi.login(email, password))
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, capabilities, login, logout, can: (capability) => capabilities.has(capability) }),
    [status, user, capabilities, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth se koristi samo unutar AuthProvider-a.')
  return context
}

import { api } from '../api/http.ts'
import type { Capability, MarketCode, Role } from './capabilities.ts'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: Role[]
  markets: MarketCode[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  expiresIn: number
  user: User
  capabilities: Capability[]
}

// Login, refresh i logout ne šalju access token; refresh i logout koriste HttpOnly cookie.
export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  refresh: () => api<AuthResponse>('/auth/refresh', { method: 'POST', auth: false }),
  logout: () => api<void>('/auth/logout', { method: 'POST', auth: false }),
  register: (data: { email: string; password: string; firstName: string; lastName: string; language: 'sr' | 'en' }) =>
    api<unknown>('/auth/register', { method: 'POST', body: data, auth: false }),
}

import { tokenStore } from '../auth/tokenStore.ts'

/** Greška sa servera: { statusCode, code, message, details? } (server/src/common/errors). */
export class ApiError extends Error {
  readonly status: number
  /** Stabilan kod greške iz kataloga na serveru, npr. AUTH_INVALID_CREDENTIALS. */
  readonly code: string
  readonly details?: Readonly<Record<string, unknown>>

  constructor(status: number, code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: Method
  body?: unknown
  /** Da li se šalje access token i radi refresh na 401. */
  auth?: boolean
}

/** Vraća true ako je access token osvežen. Postavlja ga AuthProvider. */
type RefreshHandler = () => Promise<boolean>

let refreshHandler: RefreshHandler | null = null

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler
}

async function send(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<Response> {
  // X-Requested-With ide na svaki zahtev (server ga traži za CSRF zaštitu).
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  return fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null) {
      const { code, message, details } = body as { code?: unknown; message?: unknown; details?: unknown }
      return new ApiError(
        response.status,
        typeof code === 'string' ? code : 'UNKNOWN',
        typeof message === 'string' ? message : 'Došlo je do greške.',
        typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : undefined,
      )
    }
  } catch {
    // Telo nije JSON (npr. proxy greška).
  }
  return new ApiError(response.status, 'UNKNOWN', 'Došlo je do greške.')
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  // Istekao access token: jedan pokušaj osvežavanja, pa ponovljen zahtev.
  if (response.status === 401 && options.auth !== false && refreshHandler && (await refreshHandler())) {
    response = await send(path, options)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Otprema fajla (multipart). Content-Type postavlja browser. */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const doSend = () => {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(`/api${path}`, { method: 'POST', headers, body: form, credentials: 'same-origin' })
  }
  let response = await doSend()
  if (response.status === 401 && refreshHandler && (await refreshHandler())) response = await doSend()
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

/** Preuzimanje fajla uz access token: fetch → blob → privremeni link. */
export async function download(path: string, fileName: string): Promise<void> {
  const doSend = () => {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(`/api${path}`, { headers, credentials: 'same-origin' })
  }
  let response = await doSend()
  if (response.status === 401 && refreshHandler && (await refreshHandler())) response = await doSend()
  if (!response.ok) throw await toApiError(response)
  const url = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** Upit za URL; prazne vrednosti se preskaču. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Jedna strana liste sa servera (server/src/common/pagination). */
export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Parametri strane koje šalje klijent. */
export interface PageParams {
  limit: number
  offset: number
}

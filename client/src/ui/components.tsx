import type { ReactNode } from 'react'
import { ApiError } from '../core/api/http.ts'
import { useI18n } from '../core/i18n/I18nContext.tsx'

export type SemaphoreStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>{title}</h1>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-header">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function Loading() {
  const { t } = useI18n()
  return <p className="muted">{t('common.loading')}</p>
}

export function Empty({ text }: { text?: string }) {
  const { t } = useI18n()
  return <p className="muted">{text ?? t('common.none')}</p>
}

/** Poruka greške za korisnika. Tekst dolazi sa servera (katalog grešaka), nikad sistemski detalji. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  return fallback
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n()
  if (!error) return null
  return (
    <p role="alert" className="error">
      {errorText(error, t('error.UNKNOWN'))}
    </p>
  )
}

export function SemaphoreBadge({ status }: { status: SemaphoreStatus }) {
  const { t } = useI18n()
  return <span className={`badge badge-${status.toLowerCase()}`}>{t(`semaphore.${status}`)}</span>
}

export function StatusBadge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`badge badge-${tone}`}>{text}</span>
}

/** Oznaka za podatak iz dummy integracije (README: jasno naznačeno da je dummy). */
export function DummyTag() {
  const { t } = useI18n()
  return (
    <span className="badge badge-dummy" title={t('common.dummyData')}>
      DUMMY
    </span>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

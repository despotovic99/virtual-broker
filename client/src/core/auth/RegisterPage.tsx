import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/http.ts'
import { useI18n } from '../i18n/I18nContext.tsx'
import { authApi } from './authApi.ts'

/** Registracija kupca. Uloga je uvek BUYER (server ne prima ulogu). */
export function RegisterPage() {
  const { t, language } = useI18n()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.register({ ...form, language })
      setDone(true)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('error.UNKNOWN'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main className="auth">
        <h1>{t('auth.register')}</h1>
        <p>{t('auth.registered')}</p>
        <Link to="/login">{t('auth.login')}</Link>
      </main>
    )
  }

  return (
    <main className="auth">
      <h1>{t('auth.register')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <label className="field">
          <span className="field-label">{t('auth.firstName')}</span>
          <input value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} maxLength={100} required />
        </label>
        <label className="field">
          <span className="field-label">{t('auth.lastName')}</span>
          <input value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} maxLength={100} required />
        </label>
        <label className="field">
          <span className="field-label">{t('auth.email')}</span>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => set('email')(e.target.value)} maxLength={254} required />
        </label>
        <label className="field">
          <span className="field-label">{t('auth.password')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
          <span className="field-hint">{t('auth.passwordHint')}</span>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="primary"
          disabled={submitting || !form.email || form.password.length < 12 || !form.firstName || !form.lastName}
        >
          {t('auth.registerAction')}
        </button>
      </form>
      <p className="muted">
        {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
      </p>
    </main>
  )
}

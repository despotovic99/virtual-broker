import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/http.ts'
import { useI18n } from '../i18n/I18nContext.tsx'
import { useAuth } from './AuthContext.tsx'

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('error.UNKNOWN'))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth">
      <h1>{t('auth.login')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <label className="field">
          <span className="field-label">{t('auth.email')}</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
        </label>
        <label className="field">
          <span className="field-label">{t('auth.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting || !email || !password}>
          {t('auth.loginAction')}
        </button>
      </form>
      <p className="muted">
        {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
      </p>
    </main>
  )
}

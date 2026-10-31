import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, ErrorBox, Field, Notice } from '../../ui/components.tsx'
import { useI18n } from '../i18n/I18nContext.tsx'
import { authApi } from './authApi.ts'
import { AuthFrame } from './AuthFrame.tsx'

/** Registracija kupca. Uloga je uvek BUYER (server ne prima ulogu). */
export function RegisterPage() {
  const { t, language } = useI18n()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState<unknown>(null)
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
      setError(reason)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthFrame title={t('auth.register')}>
        <Notice tone="ok">{t('auth.registered')}</Notice>
        <p className="auth__switch auth__switch--after">
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </AuthFrame>
    )
  }

  const passwordShort = form.password.length > 0 && form.password.length < 12
  const incomplete = !form.email || form.password.length < 12 || !form.firstName || !form.lastName

  return (
    <AuthFrame
      title={t('auth.register')}
      lead={t('auth.registerLead')}
      footer={
        <>
          {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="grid">
          <Field label={t('auth.firstName')}>
            <input autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} maxLength={100} required />
          </Field>
          <Field label={t('auth.lastName')}>
            <input autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} maxLength={100} required />
          </Field>
        </div>
        <Field label={t('auth.email')}>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => set('email')(e.target.value)} maxLength={254} required />
        </Field>
        <Field label={t('auth.password')} hint={passwordShort ? undefined : t('auth.passwordHint')} error={passwordShort ? t('auth.passwordHint') : null}>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" variant="primary" busy={submitting} disabled={incomplete} title={incomplete ? t('auth.fillAll') : undefined}>
          {t('auth.registerAction')}
        </Button>
      </form>
    </AuthFrame>
  )
}

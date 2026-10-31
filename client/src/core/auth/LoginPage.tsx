import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, ErrorBox, Field } from '../../ui/components.tsx'
import { useI18n } from '../i18n/I18nContext.tsx'
import { useAuth } from './AuthContext.tsx'
import { AuthFrame } from './AuthFrame.tsx'

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (reason) {
      setError(reason)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame
      title={t('auth.login')}
      lead={t('auth.loginLead')}
      footer={
        <>
          {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label={t('auth.email')}>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
        </Field>
        <Field label={t('auth.password')}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            required
          />
        </Field>
        <ErrorBox error={error} />
        <Button
          type="submit"
          variant="primary"
          busy={submitting}
          disabled={!email || !password}
          title={!email || !password ? t('auth.fillBoth') : undefined}
        >
          {submitting ? t('auth.loggingIn') : t('auth.loginAction')}
        </Button>
      </form>
    </AuthFrame>
  )
}

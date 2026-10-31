import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Button, ErrorBox, ErrorState, Loading, Page } from './components.tsx'

/**
 * Strana sa obrascem za kreiranje ili izmenu entiteta. Odustani vodi nazad,
 * a posle uspeha strana ide na putanju koju vrati `onSubmit` (ili nazad).
 * Za izmenu: dok se postojeći podaci učitavaju, prikazuje skelet ili grešku.
 */
export function FormPage({
  title,
  description,
  crumbs,
  backTo,
  onSubmit,
  submitLabel,
  disabledReason,
  loading = false,
  loadError,
  onRetry,
  intro,
  aside,
  children,
}: {
  title: string
  /** Jedna rečenica ispod naslova: šta se unosi i šta se dešava posle čuvanja. */
  description?: ReactNode
  crumbs?: { label: string; to?: string }[]
  /** Gde vodi Odustani (i uspeh, ako `onSubmit` ne vrati putanju). */
  backTo: string
  /** Snima; može da vrati putanju na koju treba otići (npr. detalj novog entiteta). */
  onSubmit: () => Promise<string | void>
  submitLabel?: string
  disabledReason?: string | null
  /** Učitavanje postojećih podataka (izmena). */
  loading?: boolean
  loadError?: unknown
  onRetry?: () => void
  intro?: ReactNode
  aside?: ReactNode
  children?: ReactNode
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (disabledReason) return
    setBusy(true)
    setError(null)
    try {
      const target = await onSubmit()
      navigate(typeof target === 'string' ? target : backTo)
    } catch (reason) {
      setError(reason)
      setBusy(false)
    }
  }

  const body = loading ? (
    <Loading rows={4} />
  ) : loadError ? (
    <ErrorState error={loadError} onRetry={onRetry} backTo={{ to: backTo, label: t('common.back') }} />
  ) : (
    <form className="card form-page__card" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-page__body">
        {intro && <div className="form-page__intro">{intro}</div>}
        {children}
        {Boolean(error) && (
          <div className="form-page__error">
            <ErrorBox error={error} />
          </div>
        )}
      </div>
      <div className="form-page__footer">
        <span className="form-page__footer-note">
          {disabledReason ? (
            <span className="form-page__reason">{disabledReason}</span>
          ) : (
            <span className="muted small">{t('form.requiredNote')}</span>
          )}
        </span>
        <button type="button" onClick={() => navigate(backTo)} disabled={busy}>
          {t('common.cancel')}
        </button>
        <Button type="submit" variant="primary" busy={busy} disabled={Boolean(disabledReason)} title={disabledReason ?? undefined}>
          {submitLabel ?? t('common.save')}
        </Button>
      </div>
    </form>
  )

  return (
    <Page title={title} crumbs={crumbs} meta={description ? <span className="page-description">{description}</span> : undefined}>
      <div className={aside ? 'form-page form-page--aside' : 'form-page'}>
        {body}
        {aside && !loading && !loadError && <aside className="form-page__aside">{aside}</aside>}
      </div>
    </Page>
  )
}

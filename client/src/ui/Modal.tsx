import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Button, ErrorBox, Field } from './components.tsx'
import { Icon } from './icons.tsx'

/**
 * Modal na nativnom `<dialog>`: fokus ostaje unutar sloja, `Esc` zatvara, a
 * pozadina je neaktivna. Klik na pozadinu zatvara samo kad nema izmena.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dirty = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** `drawer`: bočni panel uz desnu ivicu (duži obrasci). */
  size?: 'sm' | 'md' | 'lg' | 'drawer'
  /** Obrazac je menjan: klik na pozadinu ga ne zatvara. */
  dirty?: boolean
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: zatvaranje vodi roditelj (stanje `open`).
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !dirty) onClose()
      }}
    >
      {open && (
        <div className="modal__panel">
          <header className="modal__header">
            <div className="modal__heading">
              <h2 id={titleId}>{title}</h2>
              {description && <p className="modal__description">{description}</p>}
            </div>
            <button type="button" className="icon sm" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
              <Icon name="close" size={12} />
            </button>
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

/**
 * Kratak obrazac u modalu (do 4 polja). Vodi zauzeto stanje i grešku; posle
 * uspeha zatvara modal. Dugme „Sačuvaj” je onemogućeno uz razlog.
 */
export function FormModal({
  open,
  onClose,
  title,
  description,
  submitLabel,
  onSubmit,
  disabledReason,
  danger = false,
  dirty,
  size = 'md',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  submitLabel?: string
  /** Snima izmenu; greška ostaje u modalu, uspeh ga zatvara. */
  onSubmit: () => Promise<unknown>
  /** Razlog zašto se još ne može sačuvati (prikazuje se u `title` dugmeta). */
  disabledReason?: string | null
  danger?: boolean
  dirty?: boolean
  /** `drawer`: bočni panel uz desnu ivicu (duži obrasci). */
  size?: 'sm' | 'md' | 'lg' | 'drawer'
  children: ReactNode
}) {
  const { t } = useI18n()
  const formId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Svako otvaranje počinje bez stare greške.
  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (disabledReason) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit()
      onClose()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      size={size}
      dirty={dirty || busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <Button
            type="submit"
            form={formId}
            variant={danger ? 'danger' : 'primary'}
            busy={busy}
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
          >
            {submitLabel ?? t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} className="modal__form" onSubmit={(event) => void submit(event)} noValidate>
        {children}
        <ErrorBox error={error} />
      </form>
    </Modal>
  )
}

/**
 * Potvrda radnje (zamena za `window.confirm`). Sa `reason` traži obavezan
 * razlog, koji se prosleđuje u `onConfirm`.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  danger = false,
  reason,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  text?: ReactNode
  confirmLabel: string
  danger?: boolean
  reason?: { label: string; minLength?: number; hint?: string }
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const min = reason?.minLength ?? 3

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const tooShort = reason !== undefined && value.trim().length < min
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      danger={danger}
      submitLabel={confirmLabel}
      dirty={value.length > 0}
      disabledReason={tooShort ? t('modal.reasonRequired', { min }) : null}
      onSubmit={() => onConfirm(value.trim())}
    >
      {text && <p className="modal__text">{text}</p>}
      {reason && (
        <Field label={reason.label} hint={reason.hint} error={value.length > 0 && tooShort ? t('modal.reasonRequired', { min }) : null}>
          <textarea value={value} maxLength={500} rows={3} autoFocus onChange={(event) => setValue(event.target.value)} />
        </Field>
      )}
    </FormModal>
  )
}

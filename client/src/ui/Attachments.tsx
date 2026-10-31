import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { InfoTip } from './components.tsx'
import { Icon } from './icons.tsx'

/** Najveći fajl koji server prima (documents/file-validation: 20 MB). */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Razlog zašto fajl ne može (null: u redu). Server sadržaj proverava još jednom. */
export function attachmentProblem(file: File, maxBytes = MAX_ATTACHMENT_BYTES): 'type' | 'size' | 'empty' | null {
  if (file.size === 0) return 'empty'
  if (!ACCEPTED.includes(file.type)) return 'type'
  if (file.size > maxBytes) return 'size'
  return null
}

/**
 * Prilozi u obrascu (pre čuvanja): izbor više fajlova ili prevlačenje, lista sa
 * sličicom fotografije, veličinom i uklanjanjem. Neispravan fajl je označen uz
 * razlog; roditelj ne šalje obrazac dok ga ima (vidi `attachmentProblem`).
 */
export function Attachments({
  label,
  info,
  files,
  onChange,
  max = 10,
  disabled = false,
}: {
  label: string
  info?: string
  files: File[]
  onChange: (files: File[]) => void
  max?: number
  disabled?: boolean
}) {
  const { t } = useI18n()
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Sličice fotografija; URL-ovi se oslobađaju kad se lista promeni.
  const previews = useMemo(() => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)), [files])
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews])

  const add = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return
    // Isti fajl (ime + veličina) se ne dodaje dvaput.
    const known = new Set(files.map((file) => `${file.name}:${file.size}`))
    const next = [...files]
    for (const file of Array.from(incoming)) {
      if (next.length >= max) break
      if (known.has(`${file.name}:${file.size}`)) continue
      known.add(`${file.name}:${file.size}`)
      next.push(file)
    }
    onChange(next)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled) add(event.dataTransfer.files)
  }

  const full = files.length >= max

  return (
    <div className="field field--wide attachments">
      <span className="field-label-row">
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
        {info && <InfoTip text={info} label={`${label}: ${t('common.moreInfo')}`} />}
        <span className="meta num">
          {files.length} / {max}
        </span>
      </span>

      <div
        className={`attachments__drop${dragging ? ' attachments__drop--over' : ''}${disabled || full ? ' attachments__drop--disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !full) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="attachments__drop-icon" aria-hidden="true">
          <Icon name="upload" size={18} />
        </span>
        <span className="attachments__drop-text">
          <strong>{full ? t('attachments.full', { max }) : t('attachments.drop')}</strong>
          <span id={hintId} className="meta">
            {t('attachments.hint', { max })}
          </span>
        </span>
        <button type="button" className="sm" onClick={() => inputRef.current?.click()} disabled={disabled || full}>
          {t('attachments.choose')}
        </button>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          aria-describedby={hintId}
          disabled={disabled || full}
          onChange={(event) => {
            add(event.target.files)
            // Isti fajl može ponovo da se izabere posle uklanjanja.
            event.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="attachments__list">
          {files.map((file, index) => {
            const problem = attachmentProblem(file)
            return (
              <li key={`${file.name}:${file.size}`} className={`attachments__item${problem ? ' attachments__item--invalid' : ''}`}>
                {previews[index] ? (
                  <img className="attachments__thumb" src={previews[index] ?? undefined} alt="" />
                ) : (
                  <span className="attachments__thumb attachments__thumb--doc" aria-hidden="true">
                    <Icon name="doc" size={16} />
                  </span>
                )}
                <span className="attachments__meta">
                  <span className="attachments__name" title={file.name}>
                    {file.name}
                  </span>
                  <span className={problem ? 'field-error' : 'meta'}>
                    {problem && <Icon name="alert" size={12} />}
                    {problem ? t(`attachments.problem.${problem}`) : `${file.type === 'application/pdf' ? 'PDF' : t('attachments.photo')} · ${formatSize(file.size)}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon sm"
                  aria-label={t('attachments.remove', { name: file.name })}
                  title={t('attachments.remove', { name: file.name })}
                  onClick={() => onChange(files.filter((_, position) => position !== index))}
                  disabled={disabled}
                >
                  <Icon name="trash" size={13} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

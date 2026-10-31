import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { ApiError } from '../core/api/http.ts'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Icon, Spinner, type IconName } from './icons.tsx'

export type SemaphoreStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'

/** Ton signala: ok (zeleno), warn (žuto), risk (crveno), idle (nije provereno), info (u toku), test (dummy). */
export type Tone = 'ok' | 'warn' | 'risk' | 'idle' | 'info' | 'test'

/** Ton oznake: signal, kritično (puni fil) ili tiho (bez signala, npr. „manji” nedostatak). */
export type ChipTone = Tone | 'critical' | 'soft'

/** Stari nazivi tonova sa ekrana (good/bad/neutral) prevode se u tonove dizajna. */
export type LegacyTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info'

const LEGACY_TONE: Record<LegacyTone, Tone> = { good: 'ok', warn: 'warn', bad: 'risk', neutral: 'idle', info: 'info' }

/** Podrazumevani znak za ton; ekran može da zada tačniji (npr. katanac za zaključanu ratu). */
const TONE_ICON: Record<Tone, IconName> = {
  ok: 'check',
  warn: 'clock',
  risk: 'xCircle',
  idle: 'minusCircle',
  info: 'progress',
  test: 'test',
}

const SEMAPHORE: Record<SemaphoreStatus, { tone: Tone; icon: IconName }> = {
  GREEN: { tone: 'ok', icon: 'check' },
  YELLOW: { tone: 'warn', icon: 'warn' },
  RED: { tone: 'risk', icon: 'xCircle' },
  GRAY: { tone: 'idle', icon: 'minusCircle' },
}

export function semaphoreTone(status: SemaphoreStatus): Tone {
  return SEMAPHORE[status].tone
}

function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

// ── Stranica i površine ────────────────────────────────────────────────

export function Page({
  title,
  actions,
  meta,
  crumbs,
  footnote,
  children,
}: {
  title: string
  actions?: ReactNode
  /** Red ispod naslova: status, tržište, kratki podaci. */
  meta?: ReactNode
  /** Putanja iznad naslova. */
  crumbs?: { label: string; to?: string }[]
  /** Napomena na dnu stranice (npr. odricanje odgovornosti). */
  footnote?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="page">
      {crumbs && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Putanja">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 && <span aria-hidden="true"> / </span>}
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
            </span>
          ))}
        </nav>
      )}
      <header className="page-header">
        <div className="page-header__text">
          <h1>{title}</h1>
          {meta && <div className="page-header__meta">{meta}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
      {footnote && <p className="page-footnote">{footnote}</p>}
    </section>
  )
}

export function Card({
  title,
  label,
  badge,
  actions,
  footer,
  flush,
  tone,
  brass,
  className,
  children,
}: {
  /** Naslov kartice (h2). */
  title?: string
  /** Kratki naslov u stilu oznake (VELIKA SLOVA), za bočne kartice. */
  label?: string
  /** Oznaka pored naslova (status). */
  badge?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  /** Sadržaj bez unutrašnjeg razmaka (tabela preko cele širine). */
  flush?: boolean
  tone?: 'warn' | 'risk' | 'accent' | 'muted'
  /** Tanka linija mesinga na vrhu (zbirovi). */
  brass?: boolean
  className?: string
  children: ReactNode
}) {
  const hasHeader = Boolean(title || label || badge || actions)
  return (
    <div className={cx('card', flush && 'card--flush', tone && `card--${tone}`, brass && 'card--brass', className)}>
      {hasHeader && (
        <div className="card-header">
          <div className="card-header__title">
            {title && <h2>{title}</h2>}
            {label && <h2 className="eyebrow">{label}</h2>}
            {badge}
          </div>
          {actions && <div className="card-header__actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  )
}

// ── Stanja podataka ────────────────────────────────────────────────────

/**
 * Prvo učitavanje. Do 250 ms ništa (bez treptanja), zatim skelet u obliku
 * sadržaja, a posle 800 ms i rečenica da se čeka.
 */
/** Faza prvog učitavanja: 0–250 ms „wait” (ništa), zatim „skeleton”, posle 800 ms „slow”. */
export function useLoadingPhase(): 'wait' | 'skeleton' | 'slow' {
  const [phase, setPhase] = useState<'wait' | 'skeleton' | 'slow'>('wait')
  useEffect(() => {
    const show = window.setTimeout(() => setPhase('skeleton'), 250)
    const slow = window.setTimeout(() => setPhase('slow'), 800)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(slow)
    }
  }, [])
  return phase
}

export function Loading({ rows = 3, inline }: { rows?: number; inline?: boolean }) {
  const { t } = useI18n()
  const phase = useLoadingPhase()

  return (
    <div
      className={cx('skeleton', phase === 'wait' && 'skeleton--wait', !inline && 'skeleton--block')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <div className="skeleton__rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton__row">
            <span className="sk sk--box" />
            <span className="sk sk--line" />
            <span className="sk sk--end" />
          </div>
        ))}
      </div>
      {phase === 'slow' && <span className="muted">{t('state.slow')}</span>}
    </div>
  )
}

/** Tanka traka na vrhu kartice dok se postojeći podaci osvežavaju u pozadini. */
export function Refreshing({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="progress-line" role="progressbar" aria-label="…">
      <span />
    </div>
  )
}

/** Prazno stanje: uvek sa rečenicom, a kad postoji i sa radnjom. */
export function Empty({ text, title, action, icon = 'empty' }: { text?: string; title?: string; action?: ReactNode; icon?: IconName }) {
  const { t } = useI18n()
  if (!title && !action) return <p className="empty-line">{text ?? t('common.none')}</p>
  return (
    <div className="state">
      <span className="state__icon">
        <Icon name={icon} size={22} />
      </span>
      <div className="state__text">
        {title && <strong className="state__title">{title}</strong>}
        {text && <span className="state__body">{text}</span>}
      </div>
      {action && <div className="state__actions">{action}</div>}
    </div>
  )
}

/** Poruka greške za korisnika. Tekst dolazi sa servera (katalog grešaka), nikad sistemski detalji. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  return fallback
}

type ProblemKind = 'forbidden' | 'notFound' | 'offline' | 'error'

function problemKind(error: unknown): ProblemKind {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden'
    if (error.status === 404) return 'notFound'
    return 'error'
  }
  // fetch baca TypeError kad nema veze sa serverom.
  if (error instanceof TypeError) return 'offline'
  return 'error'
}

const PROBLEM_ICON: Record<ProblemKind, IconName> = {
  forbidden: 'lock',
  notFound: 'empty',
  offline: 'plug',
  error: 'alert',
}

/** Greška uz radnju ili deo ekrana: poruka iz kataloga, uz „Pokušaj ponovo” kad ima smisla. */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n()
  if (!error) return null
  const kind = problemKind(error)
  const message = kind === 'offline' ? t('state.offlineBody') : errorText(error, t('error.UNKNOWN'))
  return (
    <div role="alert" className={cx('notice', kind === 'offline' ? 'notice--warn' : 'notice--risk')}>
      <Icon name={kind === 'offline' ? 'plug' : kind === 'forbidden' ? 'lock' : 'xCircle'} size={16} />
      <div className="notice__body">
        <span>{message}</span>
        {onRetry && (
          <div className="notice__actions">
            <button type="button" onClick={onRetry}>
              {t('common.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Ceo panel nije mogao da se učita: 403 imenuje zabranu, 404 vodi nazad,
 * bez veze nudi ponovni pokušaj, a ostalo prikazuje tekst iz kataloga i kod.
 */
export function ErrorState({
  error,
  onRetry,
  backTo,
  bare,
}: {
  error: unknown
  onRetry?: () => void
  backTo?: { to: string; label: string }
  /** Bez sopstvene kartice (unutar tabele ili modala). */
  bare?: boolean
}) {
  const { t } = useI18n()
  if (!error) return null
  const kind = problemKind(error)
  const risk = kind === 'forbidden' || kind === 'error'
  const body = kind === 'error' || kind === 'forbidden' ? errorText(error, t(`state.${kind}Body`)) : t(`state.${kind}Body`)
  const code = error instanceof ApiError ? `${error.status} · ${error.code}` : null
  const content = (
    <div className="state" role="alert">
      <span className={cx('state__icon', risk ? 'state__icon--risk' : 'state__icon--idle')}>
        <Icon name={PROBLEM_ICON[kind]} size={22} />
      </span>
      <div className="state__text">
        <strong className="state__title">{t(`state.${kind}Title`)}</strong>
        <span className="state__body">{body}</span>
      </div>
      <div className="state__actions">
        {onRetry && kind !== 'notFound' && kind !== 'forbidden' && (
          <button type="button" className={risk ? 'primary risk-fill' : 'primary'} onClick={onRetry}>
            {t('common.retry')}
          </button>
        )}
        {backTo && (
          <Link className="btn" to={backTo.to}>
            {backTo.label}
          </Link>
        )}
      </div>
      {code && <span className="state__code">{code}</span>}
    </div>
  )
  return bare ? content : <div className="card">{content}</div>
}

// ── Signal ────────────────────────────────────────────────────────────

export function Chip({
  tone,
  icon,
  size,
  outline,
  title,
  children,
}: {
  tone: ChipTone
  /** Znak statusa; null znači bez znaka. */
  icon?: IconName | null
  size?: 'sm' | 'lg'
  /** Bela pozadina, za oznaku na obojenom zaglavlju. */
  outline?: boolean
  title?: string
  children: ReactNode
}) {
  const name = icon === undefined ? (tone === 'critical' ? 'critical' : tone === 'soft' ? null : TONE_ICON[tone]) : icon
  const iconSize = size === 'lg' ? 14 : size === 'sm' ? 11 : 12
  return (
    <span className={cx('chip', `chip--${tone}`, size && `chip--${size}`, outline && 'chip--outline', !name && 'chip--plain')} title={title}>
      {name && <Icon name={name} size={iconSize} />}
      {children}
    </span>
  )
}

export function SemaphoreBadge({ status, size }: { status: SemaphoreStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  const { tone, icon } = SEMAPHORE[status]
  return (
    <Chip tone={tone} icon={icon} size={size}>
      {t(`semaphore.${status}`)}
    </Chip>
  )
}

/** Status entiteta. `icon` zadaje tačan znak iz dizajna (katanac, zastavica…); inače znak tona. */
export function StatusBadge({
  text,
  tone = 'neutral',
  icon,
  outline,
}: {
  text: string
  tone?: LegacyTone | ChipTone
  icon?: IconName | null
  outline?: boolean
}) {
  const resolved: ChipTone = tone in LEGACY_TONE ? LEGACY_TONE[tone as LegacyTone] : (tone as ChipTone)
  return (
    <Chip tone={resolved} icon={icon} outline={outline}>
      {text}
    </Chip>
  )
}

/** Oznaka za podatak iz dummy integracije (README: jasno naznačeno da je dummy). */
export function DummyTag() {
  const { t } = useI18n()
  return (
    <span className="tag tag--test" title={t('common.dummyData')}>
      DUMMY
    </span>
  )
}

/** Pravougaona oznaka kvaliteta podatka ili konteksta (obavezno, procena, RS · pack 3). */
export function Tag({ tone, dashed, title, children }: { tone?: 'info' | 'warn' | 'risk' | 'test'; dashed?: boolean; title?: string; children: ReactNode }) {
  return (
    <span className={cx('tag', tone && `tag--${tone}`, dashed && 'tag--dashed')} title={title}>
      {children}
    </span>
  )
}

const NOTICE_ICON: Record<'ok' | 'warn' | 'risk' | 'info' | 'plain' | 'test', IconName> = {
  ok: 'check',
  warn: 'warn',
  risk: 'xCircle',
  info: 'info',
  plain: 'info',
  test: 'test',
}

/** Poruka sistema: potvrda, upozorenje, greška, obaveštenje ili napomena u toku teksta. */
export function Notice({
  tone = 'info',
  title,
  icon,
  actions,
  children,
}: {
  tone?: 'ok' | 'warn' | 'risk' | 'info' | 'plain' | 'test'
  title?: ReactNode
  icon?: IconName
  actions?: ReactNode
  children?: ReactNode
}) {
  const role = tone === 'warn' || tone === 'risk' ? 'alert' : 'status'
  return (
    <div role={role} className={cx('notice', `notice--${tone}`)}>
      <Icon name={icon ?? NOTICE_ICON[tone]} size={tone === 'plain' ? 15 : 16} />
      <div className="notice__body">
        {title && <span className="notice__title">{title}</span>}
        {children && <span>{children}</span>}
        {actions && <div className="notice__actions">{actions}</div>}
      </div>
    </div>
  )
}

/** Tvrda blokada: jedino mesto gde boja rizika pokriva celu površinu. */
export function HardBlock({ title, children, icon = 'xCircle', flush }: { title: ReactNode; children?: ReactNode; icon?: IconName; flush?: boolean }) {
  return (
    <div role="alert" className={cx('blocker', flush && 'blocker--flush')}>
      <Icon name={icon} size={20} />
      <div>
        <strong className="blocker__title">{title}</strong>
        {children && <span className="blocker__body">{children}</span>}
      </div>
    </div>
  )
}

// ── Kontrole ──────────────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'link'
  size?: 'sm'
  icon?: IconName
  /** Zauzeto: dugme je onemogućeno, prikazuje krug i čuva širinu. */
  busy?: boolean
}

/** Dugme sa svim stanjima iz dizajna. Onemogućeno dugme treba da nosi razlog u `title`. */
export function Button({ variant = 'secondary', size, icon, busy, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(variant !== 'secondary' && variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  )
}

/**
 * Ikonica „i” sa objašnjenjem na hover i na fokus tastature (i na dodir).
 * Objašnjenje je vezano za ikonicu preko aria-describedby.
 */
export function InfoTip({ text, label }: { text: ReactNode; label?: string }) {
  const { t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className={cx('info-tip', open && 'info-tip--open')} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="info-tip__button"
        aria-label={label ?? t('common.moreInfo')}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(event) => {
          // Na dodir: klik otvara/zatvara; dugme nije u obrascu da ne pošalje formu.
          event.preventDefault()
          setOpen((value) => !value)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <Icon name="info" size={14} />
      </button>
      <span id={id} role="tooltip" className="info-tip__bubble">
        {text}
      </span>
    </span>
  )
}

export function Field({
  label,
  hint,
  error,
  disabled,
  required,
  info,
  prefix,
  suffix,
  wide,
  children,
}: {
  label: string
  hint?: string
  /** Greška vezana za polje (aria-describedby), a ne na vrh obrasca. */
  error?: string | null
  disabled?: boolean
  /** Obavezno polje: zvezdica uz naziv (i „obavezno” za čitače ekrana). */
  required?: boolean
  /** Objašnjenje na ikonici „i” pored naziva (zašto se traži, odakle podatak, format). */
  info?: ReactNode
  /** Jedinica ispred ili iza vrednosti (npr. €, m², %). */
  prefix?: ReactNode
  suffix?: ReactNode
  /** Polje zauzima ceo red u mreži obrasca. */
  wide?: boolean
  children: ReactNode
}) {
  const { t } = useI18n()
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  const only = Children.count(children) === 1 ? Children.only(children) : null
  const element = only && isValidElement(only) ? (only as ReactElement<Record<string, unknown>>) : null
  // Naziv je vezan za polje preko id/htmlFor (klik na naziv fokusira polje).
  const controlId = element ? ((element.props.id as string | undefined) ?? `${id}-control`) : undefined
  let control = element
    ? cloneElement(element, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : children
  if (prefix || suffix) {
    control = (
      <span className={cx('affix', Boolean(prefix) && 'affix--prefix', Boolean(error) && 'affix--invalid', disabled && 'affix--disabled')}>
        {prefix && <span className="affix__prefix">{prefix}</span>}
        {control}
        {suffix && <span className="affix__suffix">{suffix}</span>}
      </span>
    )
  }
  return (
    <div className={cx('field', disabled && 'field--disabled', wide && 'field--wide')}>
      <span className="field-label-row">
        <label className="field-label" htmlFor={controlId}>
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> ({t('common.required')})</span>}
        </label>
        {info && <InfoTip text={info} label={`${label}: ${t('common.moreInfo')}`} />}
      </span>
      {control}
      {error && (
        <span id={errorId} className="field-error">
          <Icon name="alert" size={13} />
          {error}
        </span>
      )}
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}

/**
 * Sekcija obrasca: naslov i kratko objašnjenje levo (na širokom ekranu), polja
 * desno u mreži. Veliki obrasci se dele na sekcije (osnovno, lokacija, cena…).
 */
export function FormSection({
  title,
  description,
  columns = 2,
  children,
}: {
  title: string
  description?: ReactNode
  /** Broj kolona polja na širokom ekranu. */
  columns?: 1 | 2 | 3
  children: ReactNode
}) {
  return (
    <section className="form-section">
      <div className="form-section__head">
        <h3 className="form-section__title">{title}</h3>
        {description && <p className="form-section__description">{description}</p>}
      </div>
      <div className={`form-section__body form-grid form-grid--${columns}`}>{children}</div>
    </section>
  )
}

/** Izbor jedne vrednosti iz nekoliko (stanje liste, jezik). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; risk?: boolean }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={option.risk ? 'segmented--risk' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ── Brojke ────────────────────────────────────────────────────────────

/** Traka napretka (npr. „7 od 14 završeno”). */
export function Progress({ done, total, tone = 'ok', label }: { done: number; total: number; tone?: 'ok' | 'idle' | 'accent'; label?: string }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <span className="progress-meta">
      {label && <span className="meta">{label}</span>}
      <span
        className={cx('progress', tone !== 'ok' && `progress--${tone}`)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
      >
        <span style={{ width: `${percent}%` }} />
      </span>
    </span>
  )
}

/** Zbirni prikaz po bojama sa legendom. Ukupna ocena nije prosek, ovo je samo raspodela. */
export function Distribution({
  parts,
  hideLegend,
}: {
  parts: { tone: 'ok' | 'warn' | 'risk' | 'idle'; count: number; label: string }[]
  /** Bez legende, kad su iznosi već ispisani pored trake. */
  hideLegend?: boolean
}) {
  const total = parts.reduce((sum, part) => sum + part.count, 0)
  if (total === 0) return null
  const visible = parts.filter((part) => part.count > 0)
  return (
    <div className="stack stack--sm">
      <div className="distbar" aria-hidden="true">
        {visible.map((part) => (
          <span key={part.tone} className={`distbar--${part.tone}`} style={{ width: `${(part.count / total) * 100}%` }} />
        ))}
      </div>
      {!hideLegend && (
        <div className="legend">
          {visible.map((part) => (
            <span key={part.tone} className="legend__item">
              <span className={`legend__swatch legend__swatch--${part.tone}`} />
              {part.count} {part.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Avatar({ firstName, lastName, muted }: { firstName?: string; lastName?: string; muted?: boolean }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '·'
  return (
    <span className={cx('avatar', muted && 'avatar--muted')} aria-hidden="true">
      {initials}
    </span>
  )
}

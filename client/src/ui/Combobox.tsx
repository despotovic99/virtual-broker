import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Page } from '../core/api/http.ts'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Icon, type IconName } from './icons.tsx'
import { useDebounced } from './useDebounced.ts'

export interface ComboboxAction {
  label: string
  icon?: IconName
  /** Dobija tekst pretrage (npr. da popuni ime ili email novog unosa). */
  onSelect: (search: string) => void
}

/**
 * Padajući meni sa pretragom: kuca se u polje, rezultati dolaze sa servera po
 * stranama i dopunjuju se dok se skroluje (infinite scroll). Na dnu liste može
 * stajati radnja (npr. „Dodaj novog kupca”). Tastatura: ↑ ↓ biraju, Enter
 * potvrđuje, Esc zatvara. Otvara se klikom, kucanjem ili strelicom (ne samim
 * fokusom, da se ne otvori kad se fokus vrati iz modala). Radi u `Field`.
 */
export function Combobox<T>({
  value,
  onChange,
  load,
  getKey,
  getLabel,
  renderOption,
  placeholder,
  disabled = false,
  action,
  emptyText,
  pageSize = 20,
  id,
  ...aria
}: {
  value: T | null
  onChange: (value: T | null) => void
  /** Učitava jednu stranu rezultata za tekst pretrage. */
  load: (params: { search: string; limit: number; offset: number }) => Promise<Page<T>>
  getKey: (item: T) => string
  /** Tekst izabrane stavke u zatvorenom polju. */
  getLabel: (item: T) => string
  renderOption?: (item: T) => ReactNode
  placeholder?: string
  disabled?: boolean
  action?: ComboboxAction
  emptyText?: (search: string) => string
  pageSize?: number
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}) {
  const { t } = useI18n()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const requestRef = useRef(0)
  // Uvek poslednja funkcija roditelja, bez ponovnog učitavanja na svaki render.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const term = useDebounced(search.trim())
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [active, setActive] = useState(-1)

  const hasMore = items.length < total
  const actionIndex = action ? items.length : -1
  const optionCount = items.length + (action ? 1 : 0)

  const fetchPage = useCallback(
    async (offset: number) => {
      const request = ++requestRef.current
      setLoading(true)
      setError(false)
      try {
        const page = await loadRef.current({ search: term, limit: pageSize, offset })
        if (request !== requestRef.current) return
        setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]))
        setTotal(page.total)
      } catch {
        if (request === requestRef.current) setError(true)
      } finally {
        if (request === requestRef.current) setLoading(false)
      }
    },
    [term, pageSize],
  )

  // Otvaranje i nova pretraga kreću od prve strane.
  useEffect(() => {
    if (!open) return
    setActive(-1)
    listRef.current?.scrollTo({ top: 0 })
    void fetchPage(0)
  }, [open, fetchPage])

  // Infinite scroll: kad se vidi dno liste, učitava se sledeća strana.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const list = listRef.current
    if (!open || !sentinel || !list || !hasMore || loading || error) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fetchPage(items.length)
    }, { root: list, rootMargin: '0px 0px 60px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, loading, error, items.length, fetchPage])

  // Klik van menija ga zatvara.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Aktivna stavka ostaje vidljiva pri kretanju strelicama.
  useEffect(() => {
    if (active < 0) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  function close() {
    setOpen(false)
    setSearch('')
    setActive(-1)
  }

  const choose = (index: number) => {
    if (index === actionIndex && action) {
      const text = search.trim()
      close()
      action.onSelect(text)
      return
    }
    const item = items[index]
    if (item === undefined) return
    onChange(item)
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      else if (optionCount > 0) setActive((index) => (index + 1) % optionCount)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (open && optionCount > 0) setActive((index) => (index <= 0 ? optionCount - 1 : index - 1))
    } else if (event.key === 'Enter') {
      if (open && active >= 0) {
        event.preventDefault()
        choose(active)
      }
    } else if (event.key === 'Escape') {
      if (open) {
        // Esc zatvara samo meni, ne i prozor u kom je polje.
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    } else if (event.key === 'Tab') {
      close()
    }
  }

  const selectedKey = value ? getKey(value) : null
  const statusText = loading && items.length === 0
    ? t('common.loading')
    : error
      ? t('combobox.error')
      : items.length === 0
        ? (emptyText?.(term) ?? t('combobox.empty'))
        : null

  return (
    <div ref={rootRef} className={`combobox${open ? ' combobox--open' : ''}${disabled ? ' combobox--disabled' : ''}`}>
      <div className="combobox__control" onClick={() => !disabled && inputRef.current?.focus()}>
        <Icon name="search" size={13} />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={aria['aria-invalid']}
          aria-describedby={aria['aria-describedby']}
          aria-required={aria['aria-required']}
          value={open ? search : value ? getLabel(value) : ''}
          placeholder={open && value ? getLabel(value) : placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {value && !disabled && (
          <button
            type="button"
            className="icon sm combobox__clear"
            aria-label={t('combobox.clear')}
            title={t('combobox.clear')}
            onClick={(event) => {
              event.stopPropagation()
              onChange(null)
              inputRef.current?.focus()
            }}
          >
            <Icon name="close" size={11} />
          </button>
        )}
        <span className="combobox__chevron" aria-hidden="true">
          <Icon name="chevronDown" size={12} />
        </span>
      </div>

      {open && (
        <div className="combobox__popover">
          <ul ref={listRef} id={listId} role="listbox" className="combobox__list" aria-busy={loading || undefined}>
            {items.map((item, index) => {
              const key = getKey(item)
              const selected = key === selectedKey
              return (
                <li
                  key={key}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`combobox__option${index === active ? ' combobox__option--active' : ''}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span className="combobox__option-body">{renderOption ? renderOption(item) : getLabel(item)}</span>
                  {selected && <Icon name="check" size={13} />}
                </li>
              )
            })}
            {statusText && (
              <li role="presentation" className="combobox__status">
                {statusText}
                {error && (
                  <button type="button" className="quiet sm" onPointerDown={(event) => event.preventDefault()} onClick={() => void fetchPage(items.length)}>
                    {t('common.retry')}
                  </button>
                )}
              </li>
            )}
            {hasMore && (
              <li ref={sentinelRef} role="presentation" className="combobox__status combobox__status--more">
                {loading ? t('common.loading') : t('combobox.more', { count: total - items.length })}
              </li>
            )}
            {action && (
              <li
                id={`${listId}-${actionIndex}`}
                role="option"
                aria-selected={false}
                className={`combobox__action${active === actionIndex ? ' combobox__option--active' : ''}`}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setActive(actionIndex)}
                onClick={() => choose(actionIndex)}
              >
                <Icon name={action.icon ?? 'plus'} size={13} />
                {action.label}
              </li>
            )}
          </ul>
          <span className="sr-only" role="status">
            {!loading && !error ? t('combobox.count', { count: total }) : ''}
          </span>
        </div>
      )}
    </div>
  )
}

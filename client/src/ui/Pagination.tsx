import { useId } from 'react'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Icon } from './icons.tsx'
import { PAGE_SIZES, type PaginationState } from './usePagination.ts'

/** Podnožje tabele: „1–20 od 128”, izbor 20/50/100 i strane. */
export function Pagination({ pagination }: { pagination: PaginationState }) {
  const { t, formatNumber } = useI18n()
  const sizeId = useId()
  const { page, pageSize, total, setPage, setPageSize } = pagination
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const first = page <= 1
  const last = page >= pages

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <span className="pagination__range">
        {t('pagination.range', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </span>
      <span className="pagination__size">
        <label htmlFor={sizeId}>{t('pagination.pageSize')}</label>
        <select id={sizeId} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </span>
      <span className="pagination__pages">
        <button
          type="button"
          className="icon sm"
          disabled={first}
          aria-label={t('pagination.previous')}
          title={first ? t('pagination.atFirst') : t('pagination.previous')}
          onClick={() => setPage(page - 1)}
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <span className="pagination__current" aria-live="polite">
          {t('pagination.of', { page: formatNumber(page), pages: formatNumber(pages) })}
        </span>
        <button
          type="button"
          className="icon sm"
          disabled={last}
          aria-label={t('pagination.next')}
          title={last ? t('pagination.atLast') : t('pagination.next')}
          onClick={() => setPage(page + 1)}
        >
          <Icon name="chevronRight" size={14} />
        </button>
      </span>
    </nav>
  )
}

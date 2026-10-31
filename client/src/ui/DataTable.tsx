import type { ReactNode } from 'react'
import { useI18n } from '../core/i18n/I18nContext.tsx'
import { Empty, ErrorState, Refreshing, useLoadingPhase } from './components.tsx'
import type { IconName } from './icons.tsx'
import { Pagination } from './Pagination.tsx'
import type { PaginationState } from './usePagination.ts'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Brojevi i novac: desno, mono, poravnato po cifri. */
  align?: 'end'
  /** Šifre, datumi, matični brojevi: mono pismo. */
  mono?: boolean
  width?: string
  /** Kolona se krije na uskom ekranu (manje važni podaci). */
  hideOnMobile?: boolean
}

type EmptySpec = string | { title: string; text?: string; action?: ReactNode; icon?: IconName }

/**
 * Generička tabela: zaglavlje kartice, traka sa filterima, gusta tabela
 * (broj desno, status levo od radnje), stanja učitavanja/greške/praznog i
 * paginacija u podnožju. Postojeći redovi ostaju dok se nova strana učitava.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  rowClassName,
  rowActions,
  pagination,
  title,
  label,
  badge,
  actions,
  toolbar,
  caption,
}: {
  columns: Column<T>[]
  rows: readonly T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty?: EmptySpec
  /** `selected`, `row--risk`, `row--warn`. */
  rowClassName?: (row: T) => string | undefined
  /** Dugmad u poslednjoj koloni (status je uvek levo od radnje). */
  rowActions?: (row: T) => ReactNode
  pagination?: PaginationState
  title?: string
  label?: string
  badge?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  /** Opis tabele za čitače ekrana. */
  caption?: string
}) {
  const { t } = useI18n()
  const hasHeader = Boolean(title || label || badge || actions)
  const firstLoad = rows === undefined && loading
  const failed = rows === undefined && !loading && Boolean(error)
  const showFooter = pagination !== undefined && rows !== undefined && pagination.total > 0

  return (
    <div className="card data-table">
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
      {toolbar && <div className="data-table__toolbar">{toolbar}</div>}
      <Refreshing active={loading && rows !== undefined} />

      {failed ? (
        <ErrorState error={error} onRetry={onRetry} bare />
      ) : firstLoad ? (
        <TableSkeleton columns={columns.length + (rowActions ? 1 : 0)} />
      ) : rows && rows.length === 0 ? (
        <div className="data-table__empty">
          {typeof empty === 'object' ? (
            <Empty title={empty.title} text={empty.text} action={empty.action} icon={empty.icon} />
          ) : (
            <Empty text={empty} />
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cellClass(column, true)}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
                {rowActions && (
                  <th scope="col" className="actions">
                    <span className="sr-only">{t('common.actions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={rowKey(row)} className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column, false)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && <td className="actions">{rowActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {failed && rows !== undefined && <ErrorState error={error} onRetry={onRetry} bare />}
      {showFooter && (
        <div className="data-table__footer">
          <Pagination pagination={pagination} />
        </div>
      )}
    </div>
  )
}

function cellClass<T>(column: Column<T>, header: boolean): string | undefined {
  const names = [column.align === 'end' ? 'num' : null, !header && column.mono ? 'mono' : null, column.hideOnMobile ? 'hide-mobile' : null]
  const result = names.filter(Boolean).join(' ')
  return result || undefined
}

/** Skelet u obliku tabele, sa istim kašnjenjem kao `Loading`. */
function TableSkeleton({ columns }: { columns: number }) {
  const { t } = useI18n()
  const phase = useLoadingPhase()
  return (
    <div className={`data-table__skeleton ${phase === 'wait' ? 'skeleton--wait' : ''}`} role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="data-table__skeleton-row" aria-hidden="true">
          {Array.from({ length: Math.min(columns, 5) }, (_, column) => (
            <span key={column} className="sk sk--line" />
          ))}
        </div>
      ))}
      {phase === 'slow' && <span className="muted">{t('state.slow')}</span>}
    </div>
  )
}

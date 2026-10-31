import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Page, PageParams } from '../core/api/http.ts'
import { useAsync } from './useAsync.ts'

/** Ponuđene veličine strane. */
export const PAGE_SIZES = [20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20
const SIZE_KEY = 'vb.pageSize'

/** Stanje strane koje dobija `Pagination` (i `DataTable`). Strane se broje od 1. */
export interface PaginationState {
  page: number
  pageSize: number
  total: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

function isPageSize(value: number): boolean {
  return (PAGE_SIZES as readonly number[]).includes(value)
}

/** Poslednja izabrana veličina strane (važi za sve tabele u ovom pregledaču). */
function storedPageSize(): number {
  try {
    const value = Number(window.localStorage.getItem(SIZE_KEY))
    return isPageSize(value) ? value : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

function storePageSize(size: number): void {
  try {
    window.localStorage.setItem(SIZE_KEY, String(size))
  } catch {
    // Skladište nije dostupno; izbor važi do osvežavanja.
  }
}

/**
 * Lista sa serverskom paginacijom. Strana i veličina su u URL-u
 * (`?page=2&size=50`, uz `prefix` za više tabela na istoj strani), pa „Nazad”
 * vraća na istu stranu. Promena filtera (`deps`) vraća na prvu stranu.
 * Postojeći redovi ostaju na ekranu dok stiže nova strana.
 */
export function usePagedQuery<T>(load: (params: PageParams) => Promise<Page<T>>, deps: readonly unknown[], options: { prefix?: string } = {}) {
  const prefix = options.prefix ?? ''
  const pageKey = `${prefix}page`
  const sizeKey = `${prefix}size`
  const [params, setParams] = useSearchParams()

  const page = Math.max(1, Number(params.get(pageKey)) || 1)
  const sizeParam = Number(params.get(sizeKey))
  const pageSize = isPageSize(sizeParam) ? sizeParam : storedPageSize()

  const update = useCallback(
    (changes: Record<string, number | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  // Promena filtera vraća na prvu stranu (prvo učitavanje ne dira URL).
  const filterKey = JSON.stringify(deps)
  const previousFilter = useRef(filterKey)
  useEffect(() => {
    if (previousFilter.current !== filterKey) {
      previousFilter.current = filterKey
      if (page !== 1) update({ [pageKey]: null })
    }
  }, [filterKey, page, pageKey, update])

  const state = useAsync(() => load({ limit: pageSize, offset: (page - 1) * pageSize }), [...deps, page, pageSize])
  const total = state.data?.total ?? 0

  // Strana je ostala prazna (npr. posle brisanja ili manjeg rezultata): idi na poslednju.
  useEffect(() => {
    if (!state.loading && state.data && state.data.items.length === 0 && total > 0 && page > 1) {
      update({ [pageKey]: Math.max(1, Math.ceil(total / pageSize)) })
    }
  }, [state.loading, state.data, total, page, pageSize, pageKey, update])

  const pagination: PaginationState = {
    page,
    pageSize,
    total,
    setPage: (next) => update({ [pageKey]: next > 1 ? next : null }),
    setPageSize: (size) => {
      storePageSize(size)
      update({ [sizeKey]: size, [pageKey]: null })
    },
  }

  return { data: state.data, rows: state.data?.items, loading: state.loading, error: state.error, reload: state.reload, pagination }
}

/** Paginacija u memoriji, za male ugnežđene liste koje server vraća cele. */
export function useClientPagination<T>(items: readonly T[] | undefined) {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(storedPageSize)
  const total = items?.length ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)

  const rows = useMemo(() => items?.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize])

  const pagination: PaginationState = {
    page: current,
    pageSize,
    total,
    setPage: (next) => setPageState(Math.max(1, next)),
    setPageSize: (size) => {
      storePageSize(size)
      setPageSizeState(size)
      setPageState(1)
    },
  }
  return { rows, pagination }
}

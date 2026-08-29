import { useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 10

export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE) {
  const [rawPage, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // Clamp instead of letting the user land on an empty page after the
  // underlying list shrinks (e.g. a filter removes rows from a later page).
  const page = Math.min(rawPage, totalPages)

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, totalPages, pageItems, total: items.length, pageSize }
}
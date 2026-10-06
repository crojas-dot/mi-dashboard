'use client'

import Button from './Button'

interface PaginationProps { page: number; count: number; busy?: boolean; onChange: (page: number) => void; pageSize?: number }

export default function Pagination({ page, count, busy, onChange, pageSize = 25 }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const anchoTotal = pages - 1
  return <nav aria-label="Paginación" className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:flex-wrap">
    <Button variant="outline" size="sm" disabled={busy || page <= 0} onClick={() => onChange(page - 1)} aria-label="Página anterior"><span className="tw:sr-only">Anterior</span><svg className="tw:w-5 tw:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></Button>
    <span className="tw:px-4 tw:text-base tw:font-medium tw:text-foreground">Página {page + 1} de {pages}</span>
    <Button variant="outline" size="sm" disabled={busy || page >= anchoTotal} onClick={() => onChange(page + 1)} aria-label="Página siguiente"><span className="tw:sr-only">Siguiente</span><svg className="tw:w-5 tw:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></Button>
    <span className="tw:text-sm tw:text-muted-foreground">{count} registros</span>
  </nav>
}
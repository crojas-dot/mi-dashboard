'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button'
import { PAGE_SIZE } from '@/lib/queries/pagination'

export default function Pagination({ page, count, busy, onChange }: {
  page: number; count: number; busy?: boolean; onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (pages <= 1) return null

  return <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm shrink-0 pt-2.5 pb-1">
    <p className="text-qms-muted">{count} resultados</p>
    <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto">
      <Button variant="secondary" size="sm" className="min-h-11 min-w-11 sm:min-h-8" aria-label="Página anterior" disabled={busy || page <= 0} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Anterior</span>
      </Button>
      <span role="status" aria-live="polite" aria-atomic="true" className="whitespace-nowrap px-1 text-center tabular-nums text-qms-muted">Página <span className="font-medium text-qms-dark">{page + 1}</span> de {pages}</span>
      <Button variant="secondary" size="sm" className="min-h-11 min-w-11 sm:min-h-8" aria-label="Página siguiente" disabled={busy || page >= pages - 1} onClick={() => onChange(page + 1)}>
        <span className="sr-only sm:not-sr-only">Siguiente</span> <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  </nav>
}

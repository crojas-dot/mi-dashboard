'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button'
import { PAGE_SIZE } from '@/lib/queries/pagination'

export default function Pagination({ page, count, busy, onChange }: {
  page: number; count: number; busy?: boolean; onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (pages <= 1) return null

  return <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm shrink-0 pt-2.5 pb-1">
    <p className="text-qms-muted">{count} resultados</p>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {Array.from({ length: pages }, (_, i) => (
        <Button
          key={i}
          variant={page === i ? 'primary' : 'ghost'}
          size="sm"
          disabled={busy}
          onClick={() => onChange(i)}
          className="px-2.5 py-1.5 text-sm font-medium"
        >
          {i + 1}
        </Button>
      ))}
      <Button variant="ghost" size="sm" disabled={busy || page === pages - 1} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </nav>
}

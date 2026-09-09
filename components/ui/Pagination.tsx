'use client'

import Button from './Button'
import { PAGE_SIZE } from '@/lib/queries/pagination'

export default function Pagination({ page, count, busy, onChange }: {
  page: number; count: number; busy?: boolean; onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  return <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
    <span>{count} resultados · Página {page + 1} de {pages}</span>
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>Anterior</Button>
      <Button variant="secondary" size="sm" disabled={busy || page + 1 >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </div>
  </nav>
}

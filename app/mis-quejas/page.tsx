'use client'

import { useState } from 'react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas } from '@/lib/queries/useQuejas'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import QuejaColaboradorPanel from './components/QuejaColaboradorPanel'
import { prioridadVariant, estadoVariant } from '@/lib/constants/variants'
import { useQuejasVistas } from '@/hooks/useQuejasVistas'
export default function MisQuejasPage() {
  const user = useAuthStore((s) => s.user)
  const { esVista, marcarVista } = useQuejasVistas(user?.id)
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [panelOpen, setPanelOpen] = useState<Queja | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading: loading, isFetching, error, refetch } = useQuejas(
    {
      page,
      pageSize,
      responsableId: user?.id,
    },
    !!user?.id,
  )
  const quejas = data?.data ?? []
  const totalCount = data?.count ?? 0

  const invalidate = (updated?: Queja) => {
    if (updated) setPanelOpen(current => current?.id === updated.id ? updated : current)
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Mis Quejas" description="Quejas asignadas a tu usuario para procesamiento" />

      {/* Tabla a ancho completo (nunca se mueve ni encoge).
          Con el panel abierto se recorta 500px a la derecha (las columnas quedan bajo el panel)
          y aparece el scrollbar horizontal único para desplazarlas. */}
      <div
        className={`flex-1 min-w-0 monday-scroll overflow-x-auto overflow-y-auto rounded-card border border-qms-border bg-qms-surface pb-4 ${panelOpen ? 'lg:mr-[calc(500px-16px)]' : 'lg:monday-scroll-no-x'}`}
      >
          {loading ? (
            <LoadingSkeleton label="Cargando tus quejas…" framed={false} />
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-500">No se pudieron cargar tus quejas.</p>
              <button onClick={() => refetch()} className="ui-button ui-button-primary ui-button-sm">Reintentar</button>
            </div>
          ) : (
            <table className={`w-full select-text border-separate border-spacing-0 text-left text-base text-gray-700 ${panelOpen ? 'min-w-[calc(100%+484px)]' : 'min-w-[1200px]'}`}>
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-qms-border [&>th]:bg-qms-table-head [&>th]:px-4 [&>th]:py-3.5 [&>th]:text-left [&>th]:text-sm [&>th]:font-semibold [&>th]:whitespace-nowrap">
                  <th scope="col" className="pl-6!">Folio</th>
                  <th scope="col" className="min-w-[160px]">Cliente</th>
                  <th scope="col" className="min-w-[140px]">Categoría</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Límite investigación</th>
                  <th scope="col" className="pr-6!">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {quejas.length === 0 ? (
                  <EmptyState message="No tienes quejas asignadas" />
                ) : (
                  quejas.map((q) => {
                    const vista = esVista(q.id)
                    return (
                    <tr key={q.id} onClick={() => {
                      setPanelOpen(q)
                      requestAnimationFrame(() => marcarVista(q.id))
                    }} className={`cursor-pointer transition-colors [&>td]:border-b [&>td]:border-qms-border [&>td]:px-4 [&>td]:py-4 [&>td]:align-middle [&>td>span]:rounded-card ${vista ? 'hover:bg-qms-hover-bg' : 'bg-qms-primary/6 hover:bg-qms-primary/10'}`}>
                      <td className="relative pl-6! whitespace-nowrap">{!vista && <><span aria-hidden="true" className="absolute left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-qms-primary" /><span className="sr-only">Sin leer: </span></>}<span className={`text-base ${vista ? 'font-medium' : 'font-semibold'}`}>{q.folio}</span></td>
                      <td className={vista ? '' : 'font-medium'}>{q.cliente_nombre}</td>
                      <td>{q.categoria}</td>
                      <td className="[&>span]:px-3 [&>span]:whitespace-nowrap">{q.prioridad ? <Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge> : <span className="text-qms-muted">—</span>}</td>
                      <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge></td>
                      <td className="whitespace-nowrap text-qms-muted">
                        {q.fecha_limite_investigacion ? new Date(q.fecha_limite_investigacion).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="pr-6! whitespace-nowrap text-qms-muted">{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
      </div>

      <QuejaColaboradorPanel queja={panelOpen} onClose={() => setPanelOpen(null)} onUpdated={invalidate} />

      {!loading && (
        <Pagination page={page} count={totalCount} busy={isFetching} onChange={setPage} />
      )}
    </div>
  )
}

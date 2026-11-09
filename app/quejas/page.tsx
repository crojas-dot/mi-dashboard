'use client'

import { useState, useMemo, useRef, useDeferredValue, useCallback } from 'react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { updateSelectedQueja } from '@/lib/utils/quejaSelection'
import { useQuejas, quejasEstadisticasKey, fetchQuejaAdjuntos, quejaAdjuntosKey } from '@/lib/queries/useQuejas'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useCatalogoTipo } from '@/lib/queries/useCatalogos'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import NuevaQuejaModal from './components/NuevaQuejaModal'
import QuejaDetalleModal from './components/QuejaDetalleModal'
import QuejasToolbar from './components/QuejasToolbar'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useHoverPrefetch } from '@/hooks/useHoverPrefetch'
import { useQuejasVistas } from '@/hooks/useQuejasVistas'
import { useAuthStore } from '@/lib/store/auth-store'
import { showError } from '@/lib/services/errorToast'
import { opcionesEstadoQueja, TIPOS_REGISTRO_QUEJA, tipoVisible } from '@/lib/constants/quejas'
import { getQuejaDeadline, formatQuejaDeadlineDate } from '@/lib/utils/quejaDeadline'

export default function QuejasPage() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState<Queja | null>(null)
  const [detalleNavigationLocked, setDetalleNavigationLocked] = useState(false)
  const [page, setPage] = useState(0)
  const [ahora] = useState(() => Date.now())
  const pageSize = 25
  const tableRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const { esVista, marcarVista, marcarTodasVistas, contarNoVistas } = useQuejasVistas(user?.id)

  const { data, isLoading: loading, isFetching, error, refetch } = useQuejas({
    page,
    pageSize,
    search: deferredSearch,
    estado: filtroEstado,
  })
  const quejas = useMemo(() => data?.data ?? [], [data?.data])
  const totalCount = data?.count ?? 0
  const queryClient = useQueryClient()
  const invalidateQuejas = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.quejasActividad })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }
  const categorias = TIPOS_REGISTRO_QUEJA.map(valor => ({ valor, color: '' }))
  const { data: estados = [] } = useCatalogoTipo('estado_queja', 'quejas')

  useRealtimeSubscription({
    table: 'quejas',
    invalidateKeys: [
      [...queryKeys.quejas],
      quejasEstadisticasKey,
      [...queryKeys.dashboard],
    ],
  })

  const estadosDisponibles = opcionesEstadoQueja(estados)

  const quejaIds = useMemo(() => quejas.map((q) => q.id), [quejas])
  const noVistasCount = contarNoVistas(quejaIds)

  const prefetch = useHoverPrefetch()

  const handleAbrirDetalle = useCallback((q: Queja) => {
    if (detalleNavigationLocked && detalleOpen?.id !== q.id) {
      showError(null, 'Terminá o cancelá la edición antes de abrir otra queja.')
      return
    }
    setDetalleOpen(q)
    // Marcar como visto en segundo plano — no bloquea la apertura
    requestAnimationFrame(() => marcarVista(q.id))
  }, [marcarVista, detalleNavigationLocked, detalleOpen?.id])
  const detalleIndex = detalleOpen ? quejas.findIndex(q => q.id === detalleOpen.id) : -1

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageHeader title="Quejas" />

      <QuejasToolbar search={search} estado={filtroEstado} estados={estadosDisponibles} noVistas={noVistasCount}
        onSearch={value => { setSearch(value); setPage(0) }} onEstado={value => { setFiltroEstado(value); setPage(0) }}
        onMarcarVistas={() => marcarTodasVistas(quejaIds)} onNueva={() => setNuevaOpen(true)} />

      {/* Reservar solo la ventana de la tabla: sus columnas y la barra de filtros no se recomponen. */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface ${detalleOpen ? 'lg:mr-[calc(40vw-1rem)]' : ''}`}>
        <div ref={tableRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {loading ? (
            <LoadingSkeleton label="Cargando quejas…" framed={false} />
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-500">No se pudieron cargar las quejas.</p>
              <button onClick={() => refetch()} className="ui-button ui-button-primary ui-button-sm">Reintentar</button>
            </div>
          ) : (
            <table className={`w-full min-w-[1100px] select-text border-separate border-spacing-0 text-left text-base text-gray-700 ${detalleOpen ? 'lg:min-w-[max(1100px,calc(100%+40vw-1rem))]' : ''}`}>
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-qms-border [&>th]:bg-qms-table-head [&>th]:px-4 [&>th]:py-3.5 [&>th]:text-left [&>th]:text-sm [&>th]:font-semibold [&>th]:whitespace-nowrap">
                  <th scope="col" className="pl-6!">Folio</th>
                  <th scope="col" className="min-w-[160px]">Cliente</th>
                  <th scope="col" className="min-w-[140px]">Tipo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Plazo</th>
                  <th scope="col" className="pr-6!">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {quejas.length === 0 ? (
                  <EmptyState message="No se encontraron quejas" />
                ) : (
                  quejas.map((q) => {
                    const sla = getQuejaDeadline(q, ahora)
                    const vista = esVista(q.id)
                    return (
                      <tr
                        key={q.id}
                        onClick={() => handleAbrirDetalle(q)}
                        className={`cursor-pointer transition-colors [&>td]:border-b [&>td]:border-qms-border [&>td]:px-4 [&>td]:py-4 [&>td]:align-middle [&>td>span]:rounded-card ${vista ? 'hover:bg-qms-hover-bg' : 'bg-qms-primary/6 hover:bg-qms-primary/10'}`}
                        onMouseEnter={() => {
                          prefetch({
                            queryKey: quejaAdjuntosKey(q.id),
                            queryFn: ({ signal }) => fetchQuejaAdjuntos(q.id, signal),
                            staleTime: 30_000,
                          })
                        }}
                      >
                        <td className="relative pl-6! whitespace-nowrap">{!vista && <><span aria-hidden="true" className="absolute left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-qms-primary" /><span className="sr-only">Sin leer: </span></>}<span className={`text-base ${vista ? 'font-medium' : 'font-semibold'}`}>{q.folio}</span></td>
                        <td className={vista ? '' : 'font-medium'}>{q.cliente_nombre}</td>
                        <td>{tipoVisible(q)}</td>
                        <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={q.estado_color || 'gray'}>{q.estado_nombre || q.estado}</Badge></td>
                        <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={sla.variant} title={sla.vence ? `Fecha límite: ${formatQuejaDeadlineDate(sla.vence)}. Días naturales restantes.` : undefined}>{sla.label}</Badge></td>
                        <td className="pr-6! whitespace-nowrap text-qms-muted">{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        {!loading && !error && (
          <div className="shrink-0 border-t border-qms-border bg-qms-surface px-3 py-3 sm:px-6 [&>nav]:py-0">
            {totalCount <= pageSize ? <p className="text-sm text-qms-muted">{totalCount} resultados</p> : <Pagination page={page} count={totalCount} busy={isFetching} onChange={nextPage => { setPage(nextPage); if (tableRef.current) tableRef.current.scrollTop = 0 }} />}
          </div>
        )}
      </div>

      <NuevaQuejaModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} onCreated={() => { invalidateQuejas() }} categorias={categorias} />
      <QuejaDetalleModal queja={detalleOpen} onNavigationLockChange={setDetalleNavigationLocked} onClose={() => { setDetalleOpen(null); setDetalleNavigationLocked(false) }} onPrevious={detalleIndex > 0 ? () => handleAbrirDetalle(quejas[detalleIndex - 1]) : undefined} onNext={detalleIndex >= 0 && detalleIndex < quejas.length - 1 ? () => handleAbrirDetalle(quejas[detalleIndex + 1]) : undefined} onUpdated={(updated, isCurrent) => { if (updated) setDetalleOpen(current => updateSelectedQueja(current, updated, isCurrent)); invalidateQuejas() }} />
    </div>
  )
}

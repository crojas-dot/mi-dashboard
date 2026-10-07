'use client'

import { useState, useMemo, useRef, useDeferredValue, useCallback } from 'react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas, useSLAConfig, quejasEstadisticasKey, fetchQuejaAdjuntos, quejaAdjuntosKey } from '@/lib/queries/useQuejas'
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
import { prioridadVariant, estadoVariant } from '@/lib/constants/variants'

export default function QuejasPage() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState<Queja | null>(null)
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
    prioridad: filtroPrioridad,
  })
  const quejas = useMemo(() => data?.data ?? [], [data?.data])
  const totalCount = data?.count ?? 0
  const queryClient = useQueryClient()
  const invalidateQuejas = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }
  const { data: categorias = [] } = useCatalogoTipo('categoria_queja')
  const { data: estados = [] } = useCatalogoTipo('estado_queja')
  const { data: prioridades = [] } = useCatalogoTipo('prioridad')
  const { data: slaConfigs = [] } = useSLAConfig('quejas')

  useRealtimeSubscription({
    table: 'quejas',
    invalidateKeys: [
      [...queryKeys.quejas],
      quejasEstadisticasKey,
      [...queryKeys.dashboard],
    ],
  })

  const slaMap = useMemo(() => {
    const m: Record<string, { dias_alerta: number; dias_vencimiento: number }> = {}
    for (const s of slaConfigs) m[s.prioridad] = s
    return m
  }, [slaConfigs])

  function calcularSLA(fecha: string, prioridad: string, estado: string): { label: string; variant: string } {
    if (estadoVariant[estado] === 'green') return { label: 'Completado', variant: 'green' }
    const dias = Math.floor((ahora - new Date(fecha).getTime()) / 86400000)
    // El indicador actual cuenta días transcurridos desde la recepción.
    const label = `${dias} ${dias === 1 ? 'día' : 'días'}`
    const sla = slaMap[prioridad]
    if (sla) {
      if (dias <= sla.dias_alerta) return { label, variant: 'green' }
      if (dias <= sla.dias_vencimiento) return { label, variant: 'amber' }
      return { label, variant: 'red' }
    }
    if (dias <= 3) return { label, variant: 'green' }
    if (dias <= 7) return { label, variant: 'amber' }
    return { label, variant: 'red' }
  }

  const quejaIds = useMemo(() => quejas.map((q) => q.id), [quejas])
  const noVistasCount = contarNoVistas(quejaIds)

  const prefetch = useHoverPrefetch()

  const handleAbrirDetalle = useCallback((q: Queja) => {
    setDetalleOpen(q)
    // Marcar como visto en segundo plano — no bloquea la apertura
    requestAnimationFrame(() => marcarVista(q.id))
  }, [marcarVista])

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Quejas" />

      <QuejasToolbar search={search} estado={filtroEstado} prioridad={filtroPrioridad} estados={estados} prioridades={prioridades} noVistas={noVistasCount}
        onSearch={value => { setSearch(value); setPage(0) }} onEstado={value => { setFiltroEstado(value); setPage(0) }} onPrioridad={value => { setFiltroPrioridad(value); setPage(0) }}
        onMarcarVistas={() => marcarTodasVistas(quejaIds)} onNueva={() => setNuevaOpen(true)} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface">
        <div ref={tableRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {loading ? (
            <LoadingSkeleton label="Cargando quejas…" framed={false} />
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-500">No se pudieron cargar las quejas.</p>
              <button onClick={() => refetch()} className="ui-button ui-button-primary ui-button-sm">Reintentar</button>
            </div>
          ) : (
            <table className="w-full select-text border-separate border-spacing-0 text-left text-base text-gray-700">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-qms-border [&>th]:bg-qms-table-head [&>th]:px-4 [&>th]:py-3.5 [&>th]:text-left [&>th]:text-sm [&>th]:font-semibold [&>th]:whitespace-nowrap">
                  <th scope="col" className="pl-6!">Folio</th>
                  <th scope="col" className="min-w-[160px]">Cliente</th>
                  <th scope="col" className="min-w-[140px]">Categoría</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">SLA</th>
                  <th scope="col" className="pr-6!">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {quejas.length === 0 ? (
                  <EmptyState message="No se encontraron quejas" />
                ) : (
                  quejas.map((q) => {
                    const sla = calcularSLA(q.fecha, q.prioridad, q.estado)
                    const vista = esVista(q.id)
                    return (
                      <tr
                        key={q.id}
                        onClick={() => handleAbrirDetalle(q)}
                        className={`cursor-pointer transition-colors [&>td]:border-b [&>td]:border-qms-border [&>td]:px-4 [&>td]:py-4 [&>td]:align-middle [&>td>span]:rounded-card ${vista ? 'hover:bg-qms-hover-bg' : 'bg-qms-primary/6 hover:bg-qms-primary/10'}`}
                        onMouseEnter={() => {
                          prefetch({
                            queryKey: quejaAdjuntosKey(q.id),
                            queryFn: () => fetchQuejaAdjuntos(q.id),
                            staleTime: Infinity,
                          })
                        }}
                      >
                        <td className="relative pl-6! whitespace-nowrap">{!vista && <><span aria-hidden="true" className="absolute left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-qms-primary" /><span className="sr-only">Sin leer: </span></>}<span className={`text-base ${vista ? 'font-medium' : 'font-semibold'}`}>{q.folio}</span></td>
                        <td className={vista ? '' : 'font-medium'}>{q.cliente_nombre}</td>
                        <td>{q.categoria}</td>
                        <td className="[&>span]:px-3 [&>span]:whitespace-nowrap">{q.prioridad ? <Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge> : <span className="text-qms-muted">—</span>}</td>
                        <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge></td>
                        <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={sla.variant}>{sla.label}</Badge></td>
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

      <NuevaQuejaModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} onCreated={() => { invalidateQuejas() }} categorias={categorias} prioridades={prioridades} />
      <QuejaDetalleModal queja={detalleOpen} onClose={() => setDetalleOpen(null)} onUpdated={updated => { if (updated) setDetalleOpen(current => current?.id === updated.id ? updated : current); invalidateQuejas() }} prioridades={prioridades} categorias={categorias} />
    </div>
  )
}

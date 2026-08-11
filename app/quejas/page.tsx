'use client'

import { useState, useMemo, useRef, useDeferredValue } from 'react'
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, CheckCircle2, ThumbsUp, CalendarRange } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas, useSLAConfig, useQuejasEstadisticas, quejasEstadisticasKey } from '@/lib/queries/useQuejas'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useCatalogoTipo } from '@/lib/queries/useCatalogos'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import StatCard from '@/components/StatCard'
import NuevaQuejaModal from './components/NuevaQuejaModal'
import QuejaDetalleModal from './components/QuejaDetalleModal'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'

export default function QuejasPage() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState<Queja | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 25
  const tableRef = useRef<HTMLDivElement>(null)

  const { data, isLoading: loading } = useQuejas({
    page,
    pageSize,
    search: deferredSearch,
    estado: filtroEstado,
    prioridad: filtroPrioridad,
  })
  const quejas = data?.data ?? []
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
  const { data: estadisticas } = useQuejasEstadisticas()

  useRealtimeSubscription({
    table: 'quejas',
    invalidateKeys: [
      [...queryKeys.quejas],
      quejasEstadisticasKey,
      [...queryKeys.dashboard],
    ],
  })

  const mesActual = estadisticas?.porMes.length
    ? estadisticas.porMes[estadisticas.porMes.length - 1]
    : null

  const prioridadVariant: Record<string, string> = { Baja: 'blue', Media: 'amber', Alta: 'orange', Crítica: 'red' }
  const estadoVariant: Record<string, string> = {
    Recibido: 'gray', 'No Procede': 'red', 'En Investigación': 'amber',
    Resuelto: 'green', Finalizado: 'gray',
    Abierta: 'blue', 'En Proceso': 'orange', Cerrada: 'green',
  }

  const slaMap = useMemo(() => {
    const m: Record<string, { dias_alerta: number; dias_vencimiento: number }> = {}
    for (const s of slaConfigs) m[s.prioridad] = s
    return m
  }, [slaConfigs])

  function calcularSLA(fecha: string, prioridad: string, estado: string): { label: string; variant: string } {
    if (estadoVariant[estado] === 'green') return { label: 'Completado', variant: 'green' }
    const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
    const sla = slaMap[prioridad]
    if (sla) {
      if (dias <= sla.dias_alerta) return { label: `${dias}d`, variant: 'green' }
      if (dias <= sla.dias_vencimiento) return { label: `${dias}d`, variant: 'amber' }
      return { label: `${dias}d`, variant: 'red' }
    }
    if (dias <= 3) return { label: `${dias}d`, variant: 'green' }
    if (dias <= 7) return { label: `${dias}d`, variant: 'amber' }
    return { label: `${dias}d`, variant: 'red' }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4 shrink-0">
        <StatCard
          title="Resueltas a tiempo"
          value={`${estadisticas?.resueltasATiempo ?? 0}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
          subtitle={`vs fecha_sla de las resueltas/finalizadas (${estadisticas ? (estadisticas.totalDecididas - estadisticas.noProcede) : 0} evaluadas)`}
        />
        <StatCard
          title="Procedencia"
          value={`${estadisticas?.procedencia ?? 0}%`}
          icon={<ThumbsUp className="h-5 w-5" />}
          color="blue"
          subtitle={`de quejas decididas no son "No Procede" (${estadisticas?.totalDecididas ?? 0} decididas, ${estadisticas?.noProcede ?? 0} no proceden)`}
        />
        <StatCard
          title="Quejas este mes"
          value={mesActual?.total ?? 0}
          icon={<CalendarRange className="h-5 w-5" />}
          color="purple"
          subtitle={mesActual?.mes ? new Date(mesActual.mes + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Sin datos'}
        />
        <StatCard
          title="Total quejas"
          value={totalCount}
          icon={<Search className="h-5 w-5" />}
          color="red"
          subtitle={`${totalCount} registradas`}
        />
      </div>

      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar folio o cliente..."
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            style={{ height: '38px' }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <Select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPage(0) }}>
          <option value="">Estados</option>
          {estados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
        </Select>
        <Select value={filtroPrioridad} onChange={(e) => { setFiltroPrioridad(e.target.value); setPage(0) }}>
          <option value="">Prioridad</option>
          {prioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}
        </Select>
        <button onClick={() => setNuevaOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-white transition-colors hover:bg-blue-700 shrink-0" style={{ backgroundColor: '#0d6efd', height: '38px', padding: '0 14px', border: 'none', cursor: 'pointer' }}>
          <Plus className="h-4 w-4" /> Nueva
        </button>
      </div>

      <div ref={tableRef} className="flex-1 overflow-auto rounded-lg border border-gray-200 shadow-sm" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10" style={{ backgroundColor: '#2c3e50' }}>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Folio</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap min-w-[160px]">Cliente</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap min-w-[140px]">Categoría</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Prioridad</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">SLA</th>
                <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {quejas.length === 0 ? (
                <EmptyState message="No se encontraron quejas" />
              ) : (
                quejas.map((q) => {
                  const sla = calcularSLA(q.fecha, q.prioridad, q.estado)
                  return (
                    <tr key={q.id} onClick={() => setDetalleOpen(q)} className="transition-colors cursor-pointer border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2.5 align-middle"><span className="font-mono text-sm font-medium">{q.folio}</span></td>
                      <td className="px-3 py-2.5 align-middle font-medium text-gray-900">{q.cliente_nombre}</td>
                      <td className="px-3 py-2.5 align-middle text-gray-600">{q.categoria}</td>
                      <td className="px-3 py-2.5 align-middle"><Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge></td>
                      <td className="px-3 py-2.5 align-middle"><Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge></td>
                      <td className="px-3 py-2.5 align-middle"><Badge variant={sla.variant}>{sla.label}</Badge></td>
                      <td className="px-3 py-2.5 align-middle text-gray-500 whitespace-nowrap">{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && (
        <div className="flex items-center justify-between shrink-0 pt-2.5 pb-1 text-sm">
          <p className="text-gray-500">{totalCount} resultados</p>
          <div className={`flex items-center gap-1 ${totalPages <= 1 ? 'opacity-40 pointer-events-none' : ''}`}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.max(totalPages, 1)}, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${page === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <NuevaQuejaModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} onCreated={() => { invalidateQuejas() }} categorias={categorias} estados={estados} prioridades={prioridades} />
      <QuejaDetalleModal queja={detalleOpen} onClose={() => setDetalleOpen(null)} onUpdated={() => { invalidateQuejas() }} estados={estados} prioridades={prioridades} categorias={categorias} />
    </div>
  )
}

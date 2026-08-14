'use client'

import { useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas } from '@/lib/queries/useQuejas'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import QuejaColaboradorPanel from './components/QuejaColaboradorPanel'

const prioridadVariant: Record<string, string> = { Baja: 'blue', Media: 'amber', Alta: 'orange', Crítica: 'red' }
const estadoVariant: Record<string, string> = {
  Recibido: 'gray', 'No Procede': 'red', 'En Investigación': 'amber',
  'Pendiente de Revisión GC': 'purple', Resuelto: 'green', Finalizado: 'gray',
}

export default function MisQuejasPage() {
  const { user } = useAuthStore()
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [panelOpen, setPanelOpen] = useState<Queja | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading: loading } = useQuejas({
    page,
    pageSize,
    responsableId: user?.id,
  })
  const quejas = data?.data ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-fat-scrollbar::-webkit-scrollbar { height: 18px !important; }
        .custom-fat-scrollbar::-webkit-scrollbar-track { background: #f8fafc !important; border-radius: 10px !important; }
        .custom-fat-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 10px !important; border: 3px solid #f8fafc !important; }
        .custom-fat-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8 !important; }
      ` }} />
      <PageHeader title="Mis Quejas" description="Quejas asignadas a tu usuario para procesamiento" />

      <div
        className="flex-1 min-w-0 custom-fat-scrollbar w-full shrink-0 select-none overflow-x-auto rounded-lg border pb-4"
        style={{ borderColor: '#dee2e6' }}
      >
          {loading ? (
            <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <table className="w-full min-w-max select-text text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10" style={{ backgroundColor: '#343a40' }}>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Folio</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap min-w-[160px]">Cliente</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap min-w-[140px]">Categoría</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Prioridad</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Estado</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Límite investigación</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap">Fecha</th>
                  <th className={panelOpen ? 'min-w-[450px]' : 'w-0 px-0'}></th>
                </tr>
              </thead>
              <tbody>
                {quejas.length === 0 ? (
                  <EmptyState message="No tienes quejas asignadas" />
                ) : (
                  quejas.map((q) => (
                    <tr key={q.id} onClick={() => setPanelOpen(q)} className="transition-colors cursor-pointer border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap"><span className="font-mono text-sm font-medium">{q.folio}</span></td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap font-medium text-gray-900">{q.cliente_nombre}</td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap text-gray-600">{q.categoria}</td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap"><Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge></td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap"><Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge></td>
                      <td className="px-3 py-2.5 align-middle text-gray-500 whitespace-nowrap">
                        {q.fecha_limite_investigacion ? new Date(q.fecha_limite_investigacion).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-gray-500 whitespace-nowrap">{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                      <td className={panelOpen ? 'min-w-[450px]' : 'w-0 px-0'}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
      </div>

      <QuejaColaboradorPanel queja={panelOpen} onClose={() => setPanelOpen(null)} onUpdated={invalidate} />

      {!loading && (
        <div className="flex items-center justify-between shrink-0 pt-2.5 pb-1 text-sm">
          <p className="text-gray-500">{totalCount} resultados</p>
          <div className={`flex items-center gap-1 ${totalPages <= 1 ? 'opacity-40 pointer-events-none' : ''}`}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.max(totalPages, 1) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${page === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
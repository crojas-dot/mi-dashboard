'use client'

import { useRef, useState } from 'react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { updateSelectedQueja } from '@/lib/utils/quejaSelection'
import { useQuejas } from '@/lib/queries/useQuejas'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import QuejaColaboradorPanel from './components/QuejaColaboradorPanel'
import { tipoVisible } from '@/lib/constants/quejas'
import { formatQuejaDeadlineDate, getQuejaDeadlineDate } from '@/lib/utils/quejaDeadline'
import { useQuejasVistas } from '@/hooks/useQuejasVistas'
import { showError } from '@/lib/services/errorToast'
export default function MisQuejasPage() {
  const user = useAuthStore((s) => s.user)
  const { esVista, marcarVista } = useQuejasVistas(user?.id)
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [panelOpen, setPanelOpen] = useState<Queja | null>(null)
  const [navigationLocked, setNavigationLocked] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
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
  const selectedIndex = panelOpen ? quejas.findIndex(q => q.id === panelOpen.id) : -1
  const openPanel = (queja: Queja) => {
    if (navigationLocked && panelOpen?.id !== queja.id) {
      showError(null, 'Terminá la edición o cerrá el expediente antes de abrir otra queja.')
      return
    }
    setPanelOpen(queja)
    requestAnimationFrame(() => marcarVista(queja.id))
  }

  const invalidate = (updated?: Queja, isCurrent?: () => boolean) => {
    if (updated) setPanelOpen(current => updateSelectedQueja(current, updated, isCurrent))
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageHeader title="Mis Quejas" description="Quejas asignadas a tu usuario para procesamiento" />

      {/* Recortar la ventana conserva el ancho de las columnas al abrir el workspace. */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface ${panelOpen ? 'lg:mr-[calc(40vw-1rem)]' : ''}`}>
        <div ref={tableRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {loading ? (
            <LoadingSkeleton label="Cargando tus quejas…" framed={false} />
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-500">No se pudieron cargar tus quejas.</p>
              <button onClick={() => refetch()} className="ui-button ui-button-primary ui-button-sm">Reintentar</button>
            </div>
          ) : (
            <table className={`w-full min-w-[1100px] select-text border-separate border-spacing-0 text-left text-base text-gray-700 ${panelOpen ? 'lg:min-w-[max(1100px,calc(100%+40vw-1rem))]' : ''}`}>
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-qms-border [&>th]:bg-qms-table-head [&>th]:px-4 [&>th]:py-3.5 [&>th]:text-left [&>th]:text-sm [&>th]:font-semibold [&>th]:whitespace-nowrap">
                  <th scope="col" className="pl-6!">Folio</th>
                  <th scope="col" className="min-w-[160px]">Cliente</th>
                  <th scope="col" className="min-w-[140px]">Tipo</th>
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
                    <tr key={q.id} tabIndex={0} aria-label={`Abrir queja ${q.folio}`} onClick={() => openPanel(q)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPanel(q) } }} className={`cursor-pointer transition-colors [&>td]:border-b [&>td]:border-qms-border [&>td]:px-4 [&>td]:py-4 [&>td]:align-middle [&>td>span]:rounded-card ${vista ? 'hover:bg-qms-hover-bg' : 'bg-qms-primary/6 hover:bg-qms-primary/10'}`}>
                      <td className="relative pl-6! whitespace-nowrap">{!vista && <><span aria-hidden="true" className="absolute left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-qms-primary" /><span className="sr-only">Sin leer: </span></>}<span className={`text-base ${vista ? 'font-medium' : 'font-semibold'}`}>{q.folio}</span></td>
                      <td className={vista ? '' : 'font-medium'}>{q.cliente_nombre}</td>
                      <td>{tipoVisible(q)}</td>
                      <td className="[&>span]:px-3 [&>span]:whitespace-nowrap"><Badge variant={q.estado_color || 'gray'}>{q.estado_nombre || q.estado}</Badge></td>
                      <td className="whitespace-nowrap text-qms-muted">
                        {formatQuejaDeadlineDate(getQuejaDeadlineDate(q))}
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
        {!loading && !error && <div className="shrink-0 border-t border-qms-border bg-qms-surface px-3 py-3 sm:px-6 [&>nav]:py-0">{totalCount <= pageSize ? <p className="text-sm text-qms-muted">{totalCount} resultados</p> : <Pagination page={page} count={totalCount} busy={isFetching} onChange={next => { setPage(next); if (tableRef.current) tableRef.current.scrollTop = 0 }} />}</div>}
      </div>
      <QuejaColaboradorPanel queja={panelOpen} onClose={() => { setPanelOpen(null); setNavigationLocked(false) }} onNavigationLockChange={setNavigationLocked} onPrevious={selectedIndex > 0 ? () => openPanel(quejas[selectedIndex - 1]) : undefined} onNext={selectedIndex >= 0 && selectedIndex < quejas.length - 1 ? () => openPanel(quejas[selectedIndex + 1]) : undefined} onUpdated={invalidate} />
    </div>
  )
}

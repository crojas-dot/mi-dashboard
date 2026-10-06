'use client'

import { CBadge } from '@coreui/react'
import ErrorState from '@/components/ui/ErrorState'


import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas, fetchQuejaAdjuntos, quejaAdjuntosKey } from '@/lib/queries/useQuejas'
import { fetchQuejaActividad, quejaActividadKey } from '@/lib/queries/useQuejaActividad'
import { useHoverPrefetch } from '@/hooks/useHoverPrefetch'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import { prioridadVariant } from '@/lib/constants/variants'
import styles from './mis-quejas.module.css'

// El expediente se descarga con esta ruta para abrirlo en el primer clic.
import QuejaColaboradorPanel from './components/QuejaColaboradorPanel'

export default function MisQuejasPage() {
  const user = useAuthStore((s) => s.user)
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [panelOpen, setPanelOpen] = useState<Queja | null>(null)
  const queryClient = useQueryClient()
  const prefetch = useHoverPrefetch()

  const prefetchExpediente = useCallback((q: Queja) => {
    prefetch([
      { queryKey: quejaAdjuntosKey(q.id), queryFn: () => fetchQuejaAdjuntos(q.id) },
      { queryKey: quejaActividadKey(q.id), queryFn: () => fetchQuejaActividad(q.id) },
    ])
  }, [prefetch])

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

  // Solo precargar el expediente señalado (hover/foco). Cargar todas las filas
  // lanzaba hasta 50 consultas que competían con la apertura seleccionada.

  const invalidate = (updated?: Partial<Queja> & Pick<Queja, 'id'>) => {
    // El panel guarda una selección independiente de la paginación. Aplicar solo
    // datos confirmados por el servidor y solo al expediente que sigue abierto.
    if (updated) {
      setPanelOpen((current) => current?.id === updated.id ? { ...current, ...updated } : current)
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.quejas })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Mis Quejas" description="Quejas asignadas a tu usuario para procesamiento" />

      {/* Tabla a ancho completo: se adapta al área y solo genera scroll vertical.
          El panel de detalle es fixed y se superpone (estilo Monday): la tabla no
          se re-dimensiona al abrirse. */}
      <div
        className={`flex-1 min-w-0 monday-scroll ${styles.scrollArea}`}
      >
          {loading ? (
            <table className="coreui-record-table select-text w-full" role="status" aria-label="Cargando tus quejas">
              <thead>
                <tr className="sticky top-0 z-10">
                  <th>Folio</th>
                  <th className={styles.colCliente}>Cliente</th>
                  <th className={styles.colCategoria}>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Límite investigación</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : error ? (
            <ErrorState error={error} title="No se pudieron cargar tus quejas" onRetry={() => void refetch()} retrying={isFetching} />
          ) : (
            <table className="coreui-record-table select-text w-full">
              <thead>
                <tr className="sticky top-0 z-10">
                  <th>Folio</th>
                  <th className={styles.colCliente}>Cliente</th>
                  <th className={styles.colCategoria}>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Límite investigación</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {quejas.length === 0 ? (
                  <EmptyState message="No tienes quejas asignadas" />
                ) : (
                  quejas.map((q) => (
                      <tr key={q.id} onClick={() => setPanelOpen(q)} onMouseEnter={() => prefetchExpediente(q)} onFocus={() => prefetchExpediente(q)} className={styles.clickable}>
                        <td><span className={styles.folio}>{q.folio}</span></td>
                        <td className="font-medium">{q.cliente_nombre}</td>
                        <td>{q.categoria}</td>
                        <td><Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge></td>
                        <td><CBadge color={q.estado_color}>{q.estado_nombre}</CBadge></td>
                        <td>
                          {q.fecha_limite_investigacion ? new Date(q.fecha_limite_investigacion).toLocaleDateString('es-ES') : '—'}
                        </td>
                        <td>{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
      </div>

      {panelOpen && <QuejaColaboradorPanel queja={panelOpen} onClose={() => setPanelOpen(null)} onUpdated={invalidate} />}

      {!loading && (
        <Pagination page={page} count={totalCount} busy={loading} onChange={setPage} />
      )}
    </div>
  )
}
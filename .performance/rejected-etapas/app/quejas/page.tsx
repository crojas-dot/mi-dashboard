'use client'

import { deadlineText, deadlineLabels } from '@/lib/utils/deadlinePresentation'
import QuejaDeepLink from '@/components/quejas/QuejaDeepLink'
import ErrorState from '@/components/ui/ErrorState'

import { Suspense, useState, useMemo, useRef, useDeferredValue, useCallback, useEffect } from 'react'
import { CBadge, CButton, CCard, CCardHeader, CCardBody, CCardFooter, CFormInput, CInputGroup, CInputGroupText } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilLowVision } from '@coreui/icons'
import styles from './quejas.module.css'
import { useQueryClient } from '@tanstack/react-query'
import type { Queja } from '@/lib/types'
import { useQuejas, quejasEstadisticasKey, fetchQuejaAdjuntos, quejaAdjuntosKey } from '@/lib/queries/useQuejas'
import { fetchQuejaComentarios, comentariosKey } from '@/lib/queries/useQuejaComentarios'
import { fetchUsuariosDirect, usuariosQueryKey } from '@/lib/queries/useUsuarios'
import { useHoverPrefetch } from '@/hooks/useHoverPrefetch'
import { queryKeys } from '@/lib/queries/queryKeys'
import { useCatalogoTipo } from '@/lib/queries/useCatalogos'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Pagination from '@/components/ui/Pagination'
import DeferredMount from '@/components/ui/DeferredMount'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useQuejasVistas } from '@/hooks/useQuejasVistas'
import { useAuthStore } from '@/lib/store/auth-store'
import { useHeaderAction } from '@/hooks/useHeaderAction'
import { prioridadVariant } from '@/lib/constants/variants'

// Código disponible con la ruta: abrir no descarga JavaScript adicional.
// DeferredMount aplaza solo el montaje y conserva el estado al cerrar.
import NuevaQuejaModal from './components/NuevaQuejaModal'
import QuejaDetalleModal from './components/QuejaDetalleModal'

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
  const prefetch = useHoverPrefetch()

  const prefetchExpediente = useCallback((q: Queja) => {
    prefetch([
      { queryKey: quejaAdjuntosKey(q.id), queryFn: () => fetchQuejaAdjuntos(q.id) },
      { queryKey: comentariosKey(q.id), queryFn: () => fetchQuejaComentarios(q.id) },
    ])
  }, [prefetch])

  // Precalienta los responsables activos (compartidos por todos los modales)
  // para que el primer clic también abra con datos ya cargados.
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: usuariosQueryKey({ estado: 'activo' }),
      queryFn: () => fetchUsuariosDirect({ estado: 'activo' }),
      staleTime: 30 * 1000,
    })
  }, [queryClient])

  // Solo precargar el expediente señalado (hover/foco). Cargar todas las filas
  // lanzaba hasta 50 consultas que competían con la apertura seleccionada.
  const { data: categorias = [] } = useCatalogoTipo('categoria_queja')
  const { data: estados = [] } = useCatalogoTipo('estado_queja')
  const { data: prioridades = [] } = useCatalogoTipo('prioridad')

  useRealtimeSubscription({
    table: 'quejas',
    invalidateKeys: [
      [...queryKeys.quejas],
      quejasEstadisticasKey,
      [...queryKeys.dashboard],
    ],
  })

  const quejaIds = useMemo(() => quejas.map((q) => q.id), [quejas])
  const noVistasCount = contarNoVistas(quejaIds)

  const handleAbrirDetalle = useCallback((q: Queja) => {
    setDetalleOpen(q)
    // Marcar como visto en segundo plano — no bloquea la apertura
    requestAnimationFrame(() => marcarVista(q.id))
  }, [marcarVista])

  useHeaderAction({ label: 'Nuevo', onClick: () => setNuevaOpen(true) })

  return (
    <div className={styles.page}>
      <Suspense><QuejaDeepLink /></Suspense>
      <CCard>
        <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 className="m-0 fs-5">Registro de quejas</h2>
          {noVistasCount > 0 && <CButton color="secondary" variant="outline" onClick={() => marcarTodasVistas(quejaIds)} title="Marcar todas las quejas visibles como vistas" className="d-inline-flex align-items-center gap-2"><CIcon icon={cilLowVision} />{noVistasCount} sin ver</CButton>}
        </CCardHeader>
        <CCardBody>
          <div className={styles.filters}>
            <CInputGroup><CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText><CFormInput aria-label="Buscar folio o cliente" placeholder="Buscar folio o cliente…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></CInputGroup>
            <Select aria-label="Filtrar por estado" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPage(0) }}><option value="">Todos los estados</option>{estados.map((e) => <option key={e.valor} value={e.codigo}>{e.valor}</option>)}</Select>
            <Select aria-label="Filtrar por prioridad" value={filtroPrioridad} onChange={(e) => { setFiltroPrioridad(e.target.value); setPage(0) }}><option value="">Todas las prioridades</option>{prioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}</Select>
          </div>
<div ref={tableRef} className={`${styles.tableWrap} monday-scroll`}>
            {loading ? <table className="coreui-record-table w-full select-text" role="status" aria-label="Cargando quejas">
                <thead><tr className="sticky top-0 z-10">{['Folio','Cliente','Categoría','Prioridad','Estado','SLA','Fecha'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                <tbody>{Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}><div className="h-4 w-3/4 animate-pulse rounded bg-qms-border/60" /></td>
                  ))}</tr>
                ))}</tbody>
              </table>
              : error ? <ErrorState error={error} title="No se pudieron cargar las quejas" onRetry={() => void refetch()} retrying={isFetching} />
                : <table className="coreui-record-table w-full select-text">
                  <thead><tr className="sticky top-0 z-10">{['Folio','Cliente','Categoría','Prioridad','Estado','SLA','Fecha'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                  <tbody>{quejas.length === 0 ? <tr><td colSpan={7}><div className={styles.empty}>No se encontraron quejas</div></td></tr>
                    : quejas.map((q) => {
                      const vista = esVista(q.id)
                      return <tr key={q.id} onClick={() => handleAbrirDetalle(q)} onMouseEnter={() => prefetchExpediente(q)} onFocus={() => prefetchExpediente(q)} className={`${styles.row} ${!vista ? styles.unread : ''}`}>
                        <td><CButton type="button" className={styles.folio} onClick={(event) => { event.stopPropagation(); handleAbrirDetalle(q) }}>{q.folio}</CButton></td>
                        <td className={!vista ? 'font-semibold' : undefined}>{q.cliente_nombre}</td>
                        <td>{q.categoria}</td>
                        <td><Badge variant={prioridadVariant[q.prioridad] || 'gray'}>{q.prioridad}</Badge></td>
                        <td><CBadge color={q.estado_color}>{q.estado_nombre}</CBadge></td>
                        <td><CBadge color={deadlineLabels[q.plazo_situacion].color}>{deadlineText(q.plazo_situacion,q.plazo_dias)}</CBadge></td>
                        <td className="whitespace-nowrap">{new Date(q.fecha).toLocaleDateString('es-ES')}</td>
                      </tr>
                    })}</tbody>
                </table>}
          </div>
        </CCardBody>
        {!loading && <CCardFooter><Pagination page={page} count={totalCount} busy={loading} onChange={setPage} /></CCardFooter>}
      </CCard>
      <DeferredMount active={nuevaOpen}>
        <NuevaQuejaModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} onCreated={() => { invalidateQuejas() }} categorias={categorias} prioridades={prioridades} />
      </DeferredMount>
      <DeferredMount active={!!detalleOpen}>
        <QuejaDetalleModal queja={detalleOpen} onClose={() => setDetalleOpen(null)} onUpdated={() => { setDetalleOpen(null); invalidateQuejas() }} prioridades={prioridades} categorias={categorias} />
      </DeferredMount>
    </div>
  )
}

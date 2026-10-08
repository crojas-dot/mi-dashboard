/**
 * Dashboard principal (ruta: /)
 * Queries: useDashboardIndicadores, useDashboardTareas, useActividadReciente (lib/queries/useDashboard).
 * Los indicadores cuentan registros por módulo; las tareas muestran expedientes próximos a vencer.
 * QuejasSummary se carga con lazy() para no bloquear el primer paint.
 */
'use client'

import Link from 'next/link'
import { lazy, Suspense, useEffect } from 'react'
import { useDashboardIndicadores, useDashboardTareas, useActividadReciente } from '@/lib/queries/useDashboard'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { varianteEstado } from '@/lib/constants/estados'
import PageHeader from '@/components/ui/PageHeader'
import DashboardLoading from '@/components/dashboard/DashboardLoading'
import { logger } from '@/lib/utils/logger'

const QuejasSummary = lazy(() => import('@/components/dashboard/QuejasSummary'))

function useDashboardError(error: unknown, action: string) {
  useEffect(() => {
    if (error) logger.error('No se pudo cargar un bloque del dashboard', { module: 'dashboard', action }, error)
  }, [error, action])
}

const indicatorBg: Record<string, string> = {
  '#dc3545': 'bg-qms-danger',
  '#fd7e14': 'bg-qms-warning',
  '#0d6efd': 'bg-qms-primary',
  '#198754': 'bg-qms-success',
}

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Panel de control general" compact={false} />
      <Suspense fallback={<DashboardLoading label="Cargando indicadores de Quejas…" variant="summary" className="mb-5" />}>
        <QuejasSummary />
      </Suspense>
      <IndicadoresBlock />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TareasPendientesBlock />
        <ActividadRecienteBlock />
      </div>
    </div>
  )
}

// La carga de los indicadores de Quejas no depende de las consultas de otros módulos.
function IndicadoresBlock() {
  const { data, isPending, error, refetch } = useDashboardIndicadores()
  useDashboardError(error, 'indicadores')
  if (error) return <div role="alert" className="p-4">No se pudo cargar el dashboard. <button onClick={() => void refetch()} className="underline">Reintentar</button></div>
  if (isPending) return <DashboardLoading label="Cargando indicadores…" className="mb-5 min-h-60" />
  const indicadores = data ?? []
  const maxIndicador = Math.max(1, ...indicadores.map((ind) => ind.valor))

  return (
      <section aria-labelledby="dashboard-modulos-title" className="mb-5 rounded-card border border-qms-border bg-qms-surface p-5">
        <h2 id="dashboard-modulos-title" className="mb-4 text-lg font-semibold text-qms-dark">Seguimiento por módulo</h2>
        <div className="space-y-4">
        {indicadores.map((ind) => (
          <Link key={ind.label} href={ind.url} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-sm text-qms-dark no-underline hover:text-qms-primary sm:grid-cols-[190px_minmax(0,1fr)_48px]">
            <span>{ind.label}</span>
            <div aria-hidden="true" className="order-3 col-span-2 h-5 overflow-hidden rounded-sm bg-gray-100 sm:order-none sm:col-span-1">
              <div className={`h-full ${indicatorBg[ind.color] || 'bg-qms-primary'}`} style={{ width: `${Math.max(0, ind.valor) / maxIndicador * 100}%` }} />
            </div>
            <strong className="text-right tabular-nums">{ind.valor}</strong>
          </Link>
        ))}
        </div>
      </section>
  )
}

function TareasPendientesBlock() {
  const { data: tareas = [], isPending, error, refetch } = useDashboardTareas()
  useDashboardError(error, 'tareas')
  return (
        <div>
          <h6 className="mb-2 text-base font-bold text-qms-dark">Expedientes Pendientes</h6>
          {isPending ? <DashboardLoading label="Cargando expedientes…" variant="table" className="min-h-48" /> : error ? <p role="alert" className="p-3 text-sm">No se pudieron cargar los expedientes. <button className="underline" onClick={() => void refetch()}>Reintentar</button></p> : <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Expediente</TableHeaderCell>
                <TableHeaderCell>Tipo</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Vence</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {tareas.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-qms-muted">No hay expedientes pendientes</td></tr>
              ) : (
                tareas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.titulo}</TableCell>
                    <TableCell><span className="text-qms-muted">{t.tipo}</span></TableCell>
                    <TableCell><Badge variant={t.entidad === 'Quejas' ? varianteEstado('quejas', t.estado) : t.entidad === 'SACP' ? varianteEstado('sacp', t.estado) : 'gray'}>{t.estado}</Badge></TableCell>
                    <TableCell className="text-qms-muted">{t.vence ? new Date(t.vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>}
        </div>
  )
}

function ActividadRecienteBlock() {
  const actividad = useActividadReciente()
  useDashboardError(actividad.error, 'actividad')
  return (
        <div>
          <h6 className="mb-2 text-base font-bold text-qms-dark">Actividad Reciente</h6>
          <div className="divide-y rounded-card border border-qms-border">
            {actividad.isPending ? <DashboardLoading label="Cargando actividad…" variant="activity" framed={false} />
              : actividad.error ? <p role="alert" className="p-3 text-sm">No se pudo cargar la actividad. <button className="underline" onClick={() => void actividad.refetch()}>Reintentar</button></p>
              : !actividad.data?.length ? <p className="p-3 text-sm text-gray-500">No hay actividad registrada.</p>
              : actividad.data.map((item) => <div key={item.id} className="p-3 text-sm">
                <p>{item.descripcion}</p>
                <p className="text-gray-500">{new Date(item.created_at).toLocaleString('es-CR')}</p>
              </div>)}
          </div>
        </div>
  )
}

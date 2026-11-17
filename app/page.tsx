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
    <div className="coreui-dashboard mx-auto w-full max-w-[1600px]">
      <PageHeader title="Dashboard" description="Resumen general de la gestión y actividad reciente" compact={false} />
      <Suspense fallback={<DashboardLoading label="Cargando indicadores de Quejas…" variant="summary" className="mb-5" />}>
        <QuejasSummary />
      </Suspense>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5"><IndicadoresBlock /></div>
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-7">
          <TareasPendientesBlock />
          <ActividadRecienteBlock />
        </div>
      </div>
      <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-qms-border pt-4 text-[12px] text-qms-muted">
        <span>ECA-QMS · Sistema de Gestión de Calidad</span>
        <span>Diseño experimental basado en CoreUI</span>
      </footer>
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
      <section aria-labelledby="dashboard-modulos-title" className="coreui-panel h-full">
        <div className="coreui-panel-head">
          <h2 id="dashboard-modulos-title">Seguimiento por módulo</h2>
          <p className="mt-1 text-[12px] text-qms-muted">Volumen de registros por área</p>
        </div>
        <div className="space-y-5 p-5">
        {indicadores.map((ind) => (
          <Link key={ind.label} href={ind.url} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-[13px] text-qms-dark no-underline hover:text-qms-primary sm:grid-cols-[155px_minmax(0,1fr)_40px]">
            <span>{ind.label}</span>
            <div aria-hidden="true" className="coreui-progress order-3 col-span-2 sm:order-none sm:col-span-1">
              <div className={`${indicatorBg[ind.color] || 'bg-qms-primary'}`} style={{ width: `${Math.max(0, ind.valor) / maxIndicador * 100}%` }} />
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
        <section aria-labelledby="dashboard-pendientes-title" className="coreui-panel">
          <div className="coreui-panel-head">
            <h2 id="dashboard-pendientes-title">Expedientes pendientes</h2>
            <p className="mt-1 text-[12px] text-qms-muted">Registros que requieren seguimiento</p>
          </div>
          <div className="min-w-0 overflow-x-auto">
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
                    <TableCell><Badge variant={t.entidad === 'Quejas' ? varianteEstado('quejas', t.estado) : t.entidad === 'SACP' ? varianteEstado('sacp', t.estado) : 'neutral'}>{t.estado}</Badge></TableCell>
                    <TableCell className="text-qms-muted">{t.vence ? new Date(t.vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>}
          </div>
        </section>
  )
}

function ActividadRecienteBlock() {
  const actividad = useActividadReciente()
  useDashboardError(actividad.error, 'actividad')
  return (
        <section aria-labelledby="dashboard-actividad-title" className="coreui-panel">
          <div className="coreui-panel-head">
            <h2 id="dashboard-actividad-title">Actividad reciente</h2>
            <p className="mt-1 text-[12px] text-qms-muted">Últimos movimientos registrados</p>
          </div>
          <div className="divide-y divide-qms-border">
            {actividad.isPending ? <DashboardLoading label="Cargando actividad…" variant="activity" framed={false} />
              : actividad.error ? <p role="alert" className="p-3 text-sm">No se pudo cargar la actividad. <button className="underline" onClick={() => void actividad.refetch()}>Reintentar</button></p>
              : !actividad.data?.length ? <p className="p-3 text-sm text-gray-500">No hay actividad registrada.</p>
              : actividad.data.map((item) => <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 text-sm">
                <span className="coreui-activity-dot mt-[7px] h-2 w-2 shrink-0 rounded-full bg-qms-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed text-qms-dark">{item.descripcion}</p>
                  <time dateTime={item.created_at} className="mt-1 block text-[12px] text-qms-muted">{new Date(item.created_at).toLocaleString('es-CR')}</time>
                </div>
              </div>)}
          </div>
        </section>
  )
}

'use client'

import Link from 'next/link'
import { useDashboard, useActividadReciente } from '@/lib/queries/useDashboard'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import QuejasSummary from '@/components/dashboard/QuejasSummary'

const estadoBadge: Record<string, string> = {
  Abierta: 'red', Alta: 'red', 'En Proceso': 'amber', Planificada: 'blue',
  Abierto: 'red', Pendiente: 'amber', Cerrada: 'green', Cerrado: 'green',
  Publicado: 'green', Borrador: 'gray', Activo: 'green', Inactivo: 'gray',
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
      <QuejasSummary />
      <DashboardOverview />
    </div>
  )
}

// La carga de los indicadores de Quejas no depende de las consultas de otros módulos.
function DashboardOverview() {
  const { data, isPending, error, refetch } = useDashboard()
  const actividad = useActividadReciente()
  if (error) return <div role="alert" className="p-4">No se pudo cargar el dashboard. <button onClick={() => void refetch()} className="underline">Reintentar</button></div>
  if (isPending) return <p role="status" className="p-4">Cargando dashboard…</p>
  const indicadores = data?.indicadores ?? []
  const maxIndicador = Math.max(1, ...indicadores.map((ind) => ind.valor))
  const tareas = data?.tareas ?? []

  return (
    <div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h6 className="mb-2 text-base font-bold text-qms-dark">Expedientes Pendientes</h6>
          <Table>
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
                    <TableCell><Badge variant={estadoBadge[t.estado] || 'gray'}>{t.estado}</Badge></TableCell>
                    <TableCell className="text-qms-muted">{t.vence ? new Date(t.vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <div>
          <h6 className="mb-2 text-base font-bold text-qms-dark">Actividad Reciente</h6>
          <div className="divide-y rounded-card border border-qms-border">
            {actividad.isPending ? <p className="p-3 text-sm">Cargando actividad…</p>
              : actividad.error ? <p role="alert" className="p-3 text-sm">No se pudo cargar la actividad. <button className="underline" onClick={() => void actividad.refetch()}>Reintentar</button></p>
              : !actividad.data?.length ? <p className="p-3 text-sm text-gray-500">No hay actividad registrada.</p>
              : actividad.data.map((item) => <div key={item.id} className="p-3 text-sm">
                <p>{item.descripcion}</p>
                <p className="text-gray-500">{new Date(item.created_at).toLocaleString('es-CR')}</p>
              </div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

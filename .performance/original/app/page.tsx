'use client'

import Link from 'next/link'
import { useDashboard, useActividadReciente } from '@/lib/queries/useDashboard'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'

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
  const { data, isPending, error, refetch } = useDashboard()
  const actividad = useActividadReciente()
  if (error) return <div role="alert" className="p-4">No se pudo cargar el dashboard. <button onClick={() => void refetch()} className="underline">Reintentar</button></div>
  if (isPending) return <p role="status" className="p-4">Cargando dashboard…</p>
  const indicadores = data?.indicadores ?? []
  const tareas = data?.tareas ?? []

  return (
    <div>
      <PageHeader title="Dashboard" description="Panel de control general" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((ind) => (
          <Link key={ind.label} href={ind.url} className={`block rounded-card text-white no-underline ${indicatorBg[ind.color] || 'bg-qms-primary'}`}>
            <div className="p-4">
              <h6 className="m-0 text-base font-normal">{ind.label}</h6>
              <h2 className="m-0 text-[2rem] font-bold">{ind.valor}</h2>
            </div>
          </Link>
        ))}
      </div>

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

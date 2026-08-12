'use client'

import { useDashboard } from '@/lib/queries/useDashboard'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'

const estadoBadge: Record<string, string> = {
  Abierta: 'red', Alta: 'red', 'En Proceso': 'amber', Planificada: 'blue',
  Abierto: 'red', Pendiente: 'amber', Cerrada: 'green', Cerrado: 'green',
  Publicado: 'green', Borrador: 'gray', Activo: 'green', Inactivo: 'gray',
}

export default function DashboardPage() {
  const { data } = useDashboard()
  const indicadores = data?.indicadores ?? []
  const tareas = data?.tareas ?? []

  return (
    <div>
      <PageHeader title="Dashboard" description="Panel de control general" />

      <div className="grid grid-cols-4 gap-3 mb-4">
        {indicadores.map((ind) => (
          <a key={ind.label} href={ind.url} className="block text-white no-underline rounded-lg" style={{ backgroundColor: ind.color }}>
            <div className="p-4">
              <h6 style={{ fontSize: '1rem', fontWeight: 400, margin: 0 }}>{ind.label}</h6>
              <h2 className="font-bold m-0" style={{ fontSize: '2rem' }}>{ind.valor}</h2>
            </div>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h6 className="font-bold mb-2" style={{ fontSize: '1rem', color: '#212529' }}>Expedientes Pendientes</h6>
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
                <tr><td colSpan={4} className="px-3 py-4 text-center" style={{ color: '#6c757d' }}>No hay expedientes pendientes</td></tr>
              ) : (
                tareas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.titulo}</TableCell>
                    <TableCell><span style={{ color: '#6c757d' }}>{t.tipo}</span></TableCell>
                    <TableCell><Badge variant={estadoBadge[t.estado] || 'gray'}>{t.estado}</Badge></TableCell>
                    <TableCell style={{ color: '#6c757d' }}>{t.vence ? new Date(t.vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <div>
          <h6 className="font-bold mb-2" style={{ fontSize: '1rem', color: '#212529' }}>Actividad Reciente</h6>
          <div className="rounded-lg border" style={{ borderColor: '#dee2e6' }}>
            <div className="flex items-start gap-3 px-3 py-2" style={{ borderBottom: '1px solid #dee2e6', fontSize: '0.85rem' }}>
              <div className="mt-1.5 rounded-full shrink-0" style={{ width: '6px', height: '6px', backgroundColor: '#0d6efd' }} />
              <div className="min-w-0 flex-1">
                <p className="m-0" style={{ color: '#212529', fontWeight: 500 }}>Queja registrada</p>
                <p className="m-0" style={{ color: '#6c757d' }}>Folio Q-2024-001</p>
              </div>
              <div className="shrink-0 text-right" style={{ color: '#6c757d' }}>
                <p className="m-0">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                <p className="m-0">Ana Díaz</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-3 py-2" style={{ borderBottom: '1px solid #dee2e6', fontSize: '0.85rem' }}>
              <div className="mt-1.5 rounded-full shrink-0" style={{ width: '6px', height: '6px', backgroundColor: '#0d6efd' }} />
              <div className="min-w-0 flex-1">
                <p className="m-0" style={{ color: '#212529', fontWeight: 500 }}>SACP actualizada</p>
                <p className="m-0" style={{ color: '#6c757d' }}>AC-2024-015 en validación</p>
              </div>
              <div className="shrink-0 text-right" style={{ color: '#6c757d' }}>
                <p className="m-0">{new Date(Date.now() - 3600000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                <p className="m-0">Carlos Mora</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-3 py-2" style={{ fontSize: '0.85rem', borderBottom: 'none' }}>
              <div className="mt-1.5 rounded-full shrink-0" style={{ width: '6px', height: '6px', backgroundColor: '#0d6efd' }} />
              <div className="min-w-0 flex-1">
                <p className="m-0" style={{ color: '#212529', fontWeight: 500 }}>Documento publicado</p>
                <p className="m-0" style={{ color: '#6c757d' }}>PR-001 v3.2</p>
              </div>
              <div className="shrink-0 text-right" style={{ color: '#6c757d' }}>
                <p className="m-0">{new Date(Date.now() - 7200000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                <p className="m-0">Ana Díaz</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

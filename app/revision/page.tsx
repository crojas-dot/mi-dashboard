'use client'

import { useState } from 'react'
import { Plus, Loader2, Clock, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useReuniones, reunionesKey, type Reunion } from '@/lib/queries/useReuniones'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import NuevaReunionModal from './components/NuevaReunionModal'

const estadoVariant: Record<string, string> = { Planificada: 'blue', Realizada: 'green', Cancelada: 'red' }

export default function RevisionPage() {
  const { data: reuniones = [], isLoading: loading } = useReuniones()
  const queryClient = useQueryClient()
  const invalidateReuniones = () => queryClient.invalidateQueries({ queryKey: reunionesKey })
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [detalle, setDetalle] = useState<Reunion | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader title="Revisión por Dirección" description="Reuniones, actas y tareas de la alta dirección">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nueva Reunión</Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Título</TableHeaderCell>
            <TableHeaderCell>Fecha Prog.</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acta</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {reuniones.length === 0 ? <EmptyState message="No hay reuniones registradas" /> : (
            reuniones.map((r) => (
              <TableRow key={r.id} onClick={() => setDetalle(r)}>
                <TableCell className="font-medium text-gray-900 dark:text-white">{r.titulo}</TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{r.fecha_programada ? new Date(r.fecha_programada).toLocaleDateString('es-ES') : '-'}</TableCell>
                <TableCell><Badge variant={estadoVariant[r.estado] || 'gray'}>{r.estado}</Badge></TableCell>
                 <TableCell className="text-gray-600 dark:text-gray-400">{r.acta_drive_id ? <Check className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 animate-spin text-amber-500" />}</TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevaReunionModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateReuniones() }} />

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle?.titulo || ''} size="lg">
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Fecha</p>
                <p className="text-sm text-gray-900 dark:text-white">{detalle.fecha_programada ? new Date(detalle.fecha_programada).toLocaleDateString('es-ES') : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Estado</p>
                <Badge variant={estadoVariant[detalle.estado] || 'gray'}>{detalle.estado}</Badge>
              </div>
            </div>
            {detalle.participantes && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Participantes</p>
                <p className="text-sm text-gray-900 dark:text-white">{detalle.participantes}</p>
              </div>
            )}
            {detalle.agenda && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Agenda</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{detalle.agenda}</p>
              </div>
            )}
            {detalle.acta_drive_id ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Acta (Drive ID)</p>
                <p className="text-sm text-gray-900 dark:text-white">{detalle.acta_drive_id}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Acta pendiente de redactar
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

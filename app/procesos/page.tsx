'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useProcesos, procesosKey } from '@/lib/queries/useProcesos'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import NuevoProcesoModal from './components/NuevoProcesoModal'

export default function ProcesosPage() {
  const { data: procesos = [], isLoading: loading } = useProcesos()
  const queryClient = useQueryClient()
  const invalidateProcesos = () => queryClient.invalidateQueries({ queryKey: procesosKey })
  const [nuevoOpen, setNuevoOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader title="Procesos" description="Mapa de procesos del SGC">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nuevo Proceso</Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Nombre del Proceso</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Objetivo</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {procesos.length === 0 ? <EmptyState message="No hay procesos registrados" /> : (
            procesos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-gray-900 dark:text-white">{p.nombre_proceso}</TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{p.tipo || '-'}</TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{p.objetivo || '-'}</TableCell>
                <TableCell><Badge variant={p.estado === 'Activo' ? 'green' : 'gray'}>{p.estado}</Badge></TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevoProcesoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateProcesos() }} />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Plus, ListChecks, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuditorias, auditoriasKey, useHallazgos, type Auditoria } from '@/lib/queries/useAuditorias'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import NuevaAuditoriaModal from './components/NuevaAuditoriaModal'

const estadoVariant: Record<string, string> = { Planificada: 'blue', 'En Curso': 'amber', Completada: 'green' }

export default function AuditoriasPage() {
  const { data: lista = [], isLoading: loading } = useAuditorias()
  const queryClient = useQueryClient()
  const invalidateAuditorias = () => queryClient.invalidateQueries({ queryKey: auditoriasKey })
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [hallazgosOpen, setHallazgosOpen] = useState<Auditoria | null>(null)
  const { data: hallazgos = [] } = useHallazgos(hallazgosOpen?.id ?? '')

  return (
    <div className="space-y-6">
      <PageHeader title="Auditorías" description="Planificación y ejecución de auditorías">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nueva Auditoría</Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Folio</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Objetivo</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Hallazgos</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {lista.length === 0 ? <EmptyState message="No hay auditorías registradas" /> : (
            lista.map((a) => (
              <TableRow key={a.id}>
                <TableCell><span className="font-mono text-xs">{a.folio || '-'}</span></TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{a.tipo}</TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">{a.objetivo || '-'}</TableCell>
                <TableCell><Badge variant={estadoVariant[a.estado] || 'gray'}>{a.estado}</Badge></TableCell>
                <TableCell>
<Button size="sm" variant="ghost" onClick={() => setHallazgosOpen(a)}>
                      <ListChecks className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevaAuditoriaModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateAuditorias() }} />

      <Modal open={!!hallazgosOpen} onClose={() => setHallazgosOpen(null)} title={`Hallazgos - ${hallazgosOpen?.folio || hallazgosOpen?.objetivo}`} size="lg">
        <div className="space-y-3">
          {hallazgos.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">No hay hallazgos registrados</p>
          ) : (
            hallazgos.map((h) => (
              <div key={h.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{h.descripcion}</p>
                    <Badge variant={h.tipo === 'No Conformidad' ? 'red' : h.tipo === 'Observacion' ? 'amber' : 'blue'}>{h.tipo}</Badge>
                  </div>
                  {h.derivado_sacp_id && <Badge variant="blue">Derivado a SACP</Badge>}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}

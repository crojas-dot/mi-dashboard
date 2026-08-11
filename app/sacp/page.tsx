'use client'

import { useState } from 'react'
import { Plus, CheckCircle, Target, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSACP, accionesKey, type SACP } from '@/lib/queries/useSACP'
import { showError, showSuccess } from '@/lib/services/errorToast'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import NuevaSACPModal from './components/NuevaSACPModal'

const estadoVariant: Record<string, string> = {
  Abierta: 'red', 'En Proceso': 'blue', Cerrada: 'green', 'En Validación': 'amber',
}

export default function SACPage() {
  const { data: acciones = [], isLoading: loading } = useSACP()
  const queryClient = useQueryClient()
  const invalidateAcciones = () => queryClient.invalidateQueries({ queryKey: accionesKey })
  const [segModal, setSegModal] = useState<SACP | null>(null)
  const [cierreModal, setCierreModal] = useState<SACP | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [avance, setAvance] = useState(0)

  const handleAvance = async () => {
    if (!segModal) return
    const updates: Partial<SACP> = { seguimiento_porcentaje: avance }
    if (avance === 100) updates.estado = 'En Validación'
    const { error } = await supabase.from('acciones').update(updates).eq('id', segModal.id)
    if (error) { showError(error, 'No se pudo actualizar el avance'); return }
    showSuccess('Avance actualizado')
    setSegModal(null)
    invalidateAcciones()
  }

  const handleCierre = async () => {
    if (!cierreModal) return
    const { error } = await supabase.from('acciones').update({ estado: 'Cerrada', seguimiento_porcentaje: 100 }).eq('id', cierreModal.id)
    if (error) { showError(error, 'No se pudo cerrar la SACP'); return }
    showSuccess('SACP cerrada')
    setCierreModal(null)
    invalidateAcciones()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="SACP" description="Acciones Correctivas, Preventivas y de Mejora">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nueva SACP</Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Folio</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Descripción</TableHeaderCell>
            <TableHeaderCell>Avance</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {acciones.length === 0 ? <EmptyState message="No hay SACP registradas" /> : (
            acciones.map((a) => (
              <TableRow key={a.id}>
                <TableCell><span className="font-mono text-xs">{a.folio}</span></TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{a.tipo}</TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">{a.descripcion}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${a.seguimiento_porcentaje || 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{a.seguimiento_porcentaje || 0}%</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant={estadoVariant[a.estado] || 'gray'}>{a.estado}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setSegModal(a); setAvance(a.seguimiento_porcentaje || 0) }}>
                      <Target className="h-3.5 w-3.5" />
                    </Button>
                    {a.estado === 'En Validación' && (
                      <Button size="sm" variant="ghost" onClick={() => setCierreModal(a)}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevaSACPModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateAcciones() }} />

      <Modal open={!!segModal} onClose={() => setSegModal(null)} title="Seguimiento de Avance">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{segModal?.descripcion}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Avance (%)</label>
            <input type="range" min={0} max={100} value={avance} onChange={(e) => setAvance(Number(e.target.value))} className="w-full" />
            <p className="text-center text-2xl font-bold text-gray-900 dark:text-white">{avance}%</p>
          </div>
          <Button onClick={handleAvance} className="w-full">Actualizar Avance</Button>
        </div>
      </Modal>

      <Modal open={!!cierreModal} onClose={() => setCierreModal(null)} title="Cierre de SACP">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{cierreModal?.descripcion}</p>
          <Button onClick={handleCierre} className="w-full">Cerrar SACP</Button>
        </div>
      </Modal>
    </div>
  )
}

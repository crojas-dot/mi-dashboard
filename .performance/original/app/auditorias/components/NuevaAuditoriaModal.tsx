'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generarFolio } from '@/lib/services/folioService'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevaAuditoriaModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Interna', objetivo: '', alcance: '', proceso_area: '', fecha_inicio: '', fecha_fin: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const folio = form.folio || await generarFolio('auditoria')
      const { error } = await supabase.from('auditorias').insert([{
        folio,
        tipo: form.tipo,
        objetivo: form.objetivo,
        alcance: form.alcance,
        proceso_area: form.proceso_area,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        estado: 'Planificada',
      }])
      if (error) { showError(error, 'No se pudo crear la auditoría'); return }
      showSuccess('Auditoría creada correctamente')
      setForm({ folio: '', tipo: 'Interna', objetivo: '', alcance: '', proceso_area: '', fecha_inicio: '', fecha_fin: '' })
      onCreated()
      onClose()
    } catch (err) {
      showError(err as Error, 'No se pudo crear la auditoría')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Auditoría" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado si se deja vacío" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Interna</option>
              <option>Externa</option>
              <option>Proveedor</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Proceso / Área</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.proceso_area} onChange={(e) => setForm({ ...form, proceso_area: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Objetivo</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Alcance</label>
          <textarea rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Inicio</label>
            <input type="date" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Fin</label>
            <input type="date" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

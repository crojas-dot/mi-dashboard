'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevaReunionModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ titulo: '', tipo: 'Revisión por Dirección', fecha_programada: '', participantes: '', agenda: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('reuniones').insert([{
      titulo: form.titulo,
      tipo: form.tipo,
      fecha_programada: form.fecha_programada || null,
      participantes: form.participantes,
      agenda: form.agenda,
      estado: 'Planificada',
    }])
    setLoading(false)
    if (error) { showError(error, 'No se pudo crear la reunión'); return }
    showSuccess('Reunión creada correctamente')
    setForm({ titulo: '', tipo: 'Revisión por Dirección', fecha_programada: '', participantes: '', agenda: '' })
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Reunión" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Revisión por Dirección</option>
              <option>Comité de Calidad</option>
              <option>Reunión Operativa</option>
              <option>Otra</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Programada</label>
            <input type="date" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_programada} onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Participantes</label>
          <input placeholder="Nombres separados por coma" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Agenda</label>
          <textarea rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

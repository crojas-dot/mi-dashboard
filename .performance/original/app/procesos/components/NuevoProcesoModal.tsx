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

export default function NuevoProcesoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ nombre_proceso: '', tipo: 'Estratégico', objetivo: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('procesos').insert([{
      nombre_proceso: form.nombre_proceso,
      tipo: form.tipo,
      objetivo: form.objetivo,
      estado: 'Activo',
    }])
    setLoading(false)
    if (error) { showError(error, 'No se pudo crear el proceso'); return }
    showSuccess('Proceso creado correctamente')
    setForm({ nombre_proceso: '', tipo: 'Estratégico', objetivo: '' })
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Proceso" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Proceso</label>
            <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.nombre_proceso} onChange={(e) => setForm({ ...form, nombre_proceso: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Estratégico</option>
              <option>Operativo</option>
              <option>Soporte</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Objetivo</label>
          <textarea rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

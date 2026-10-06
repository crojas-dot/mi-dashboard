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

export default function NuevaSACPModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Correctiva', descripcion: '', fecha_limite: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const folio = form.folio || await generarFolio('sacp')
      const { error } = await supabase.from('acciones').insert([{
        folio,
        tipo: form.tipo,
        descripcion: form.descripcion,
        fecha_limite: form.fecha_limite || null,
        estado: 'Abierta',
        seguimiento_porcentaje: 0,
      }])
      if (error) { showError(error, 'No se pudo crear la SACP'); return }
      showSuccess('SACP creada correctamente')
      setForm({ folio: '', tipo: 'Correctiva', descripcion: '', fecha_limite: '' })
      onCreated()
      onClose()
    } catch (err) {
      showError(err as Error, 'No se pudo crear la SACP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva SACP" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado si se deja vacío" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Correctiva</option>
              <option>Preventiva</option>
              <option>Mejora</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Límite</label>
            <input type="date" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
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

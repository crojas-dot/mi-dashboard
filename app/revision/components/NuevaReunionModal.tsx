'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'
import { logger } from '@/lib/utils/logger'
import { trimTextFields, requireText, requireOption, validateDate } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevaReunionModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ titulo: '', tipo: 'Revisión por Dirección', fecha_programada: '', participantes: '', agenda: '' })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const submitting = useRef(false)

  const handleClose = () => {
    if (!submitting.current) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setErrorMessage('')
    let saved = false
    try {
      const values = trimTextFields(form)
      requireText(values.titulo, 'Título')
      requireOption(values.tipo, ['Revisión por Dirección', 'Comité de Calidad', 'Reunión Operativa', 'Otra'], 'Tipo')
      validateDate(values.fecha_programada, 'Fecha Programada', true)
      const { error } = await supabase.from('reuniones').insert([{
        titulo: values.titulo,
        tipo: values.tipo,
        fecha_programada: values.fecha_programada,
        participantes: values.participantes,
        agenda: values.agenda,
        estado: 'Planificada',
      }])
      if (error) throw error
      saved = true
      setForm({ titulo: '', tipo: 'Revisión por Dirección', fecha_programada: '', participantes: '', agenda: '' })
      onCreated()
      onClose()
      showSuccess('Reunión creada correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear la reunión').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear la reunión',
        { module: 'revision', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear la reunión')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nueva Reunión" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input required className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
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
            <input type="date" required className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_programada} onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Participantes</label>
          <input placeholder="Nombres separados por coma" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Agenda</label>
          <textarea rows={3} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

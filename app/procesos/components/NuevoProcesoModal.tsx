'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'
import { logger } from '@/lib/utils/logger'
import { trimTextFields, requireText, requireOption } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevoProcesoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ nombre_proceso: '', tipo: 'Estratégico', objetivo: '' })
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
      requireText(values.nombre_proceso, 'Nombre del Proceso')
      requireOption(values.tipo, ['Estratégico', 'Operativo', 'Soporte'], 'Tipo')
      const { error } = await supabase.from('procesos').insert([{
        nombre_proceso: values.nombre_proceso,
        tipo: values.tipo,
        objetivo: values.objetivo,
        estado: 'Activo',
      }])
      if (error) throw error
      saved = true
      setForm({ nombre_proceso: '', tipo: 'Estratégico', objetivo: '' })
      onCreated()
      onClose()
      showSuccess('Proceso creado correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear el proceso').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear el proceso',
        { module: 'procesos', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear el proceso')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Proceso" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Proceso</label>
            <input required className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.nombre_proceso} onChange={(e) => setForm({ ...form, nombre_proceso: e.target.value })} />
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
          <textarea rows={2} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

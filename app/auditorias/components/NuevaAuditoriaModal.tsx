'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generarFolio } from '@/lib/services/folioService'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'
import { logger } from '@/lib/utils/logger'
import { trimTextFields, requireOption, validateDate, validateDateOrder, requireText } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevaAuditoriaModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Interna', objetivo: '', alcance: '', proceso_area: '', fecha_inicio: '', fecha_fin: '' })
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
      requireOption(values.tipo, ['Interna', 'Externa', 'Proveedor'], 'Tipo')
      validateDate(values.fecha_inicio, 'Fecha Inicio')
      validateDate(values.fecha_fin, 'Fecha Fin')
      validateDateOrder(values.fecha_inicio, values.fecha_fin)
      const folio = values.folio || await generarFolio('auditoria')
      requireText(folio, 'Folio')
      const { error } = await supabase.from('auditorias').insert([{
        folio,
        tipo: values.tipo,
        objetivo: values.objetivo,
        alcance: values.alcance,
        proceso_area: values.proceso_area,
        fecha_inicio: values.fecha_inicio || null,
        fecha_fin: values.fecha_fin || null,
        estado: 'Planificada',
      }])
      if (error) throw error
      saved = true
      setForm({ folio: '', tipo: 'Interna', objetivo: '', alcance: '', proceso_area: '', fecha_inicio: '', fecha_fin: '' })
      onCreated()
      onClose()
      showSuccess('Auditoría creada correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear la auditoría').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear la auditoría',
        { module: 'auditorias', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear la auditoría')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nueva Auditoría" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado si se deja vacío" />
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
            <input className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.proceso_area} onChange={(e) => setForm({ ...form, proceso_area: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Objetivo</label>
            <input className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Alcance</label>
          <textarea rows={2} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Inicio</label>
            <input type="date" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Fin</label>
            <input type="date" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

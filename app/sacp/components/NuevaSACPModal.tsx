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
import { trimTextFields, requireOption, validateDate, requireText } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevaSACPModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Correctiva', descripcion: '', fecha_limite: '' })
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
      requireOption(values.tipo, ['Correctiva', 'Preventiva', 'Mejora'], 'Tipo')
      validateDate(values.fecha_limite, 'Fecha Límite')
      const folio = values.folio || await generarFolio('sacp')
      requireText(folio, 'Folio')
      const { error } = await supabase.from('acciones').insert([{
        folio,
        tipo: values.tipo,
        descripcion: values.descripcion,
        fecha_limite: values.fecha_limite || null,
        estado: 'Abierta',
        seguimiento_porcentaje: 0,
      }])
      if (error) throw error
      saved = true
      setForm({ folio: '', tipo: 'Correctiva', descripcion: '', fecha_limite: '' })
      onCreated()
      onClose()
      showSuccess('SACP creada correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear la SACP').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear la SACP',
        { module: 'sacp', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear la SACP')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nueva SACP" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nueva-sacp-folio" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input id="nueva-sacp-folio" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado si se deja vacío" />
          </div>
          <div>
            <label htmlFor="nueva-sacp-tipo" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select id="nueva-sacp-tipo" className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Correctiva</option>
              <option>Preventiva</option>
              <option>Mejora</option>
            </Select>
          </div>
        </div>
        <div>
          <label htmlFor="nueva-sacp-descripcion" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea id="nueva-sacp-descripcion" rows={3} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nueva-sacp-fecha-limite" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Límite</label>
            <input id="nueva-sacp-fecha-limite" type="date" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
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

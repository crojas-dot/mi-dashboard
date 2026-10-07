'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'
import { logger } from '@/lib/utils/logger'
import { trimTextFields, requireText } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevoDocumentoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ codigo_doc: '', titulo: '' })
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
      requireText(values.codigo_doc, 'Código del Documento')
      requireText(values.titulo, 'Título')
      const { error } = await supabase.from('documentos').insert([{
        codigo_doc: values.codigo_doc,
        titulo: values.titulo,
        version_actual: '1.0',
        estado: 'Borrador',
      }])
      if (error) throw error
      saved = true
      setForm({ codigo_doc: '', titulo: '' })
      onCreated()
      onClose()
      showSuccess('Documento creado correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear el documento').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear el documento',
        { module: 'documentos', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear el documento')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Documento" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Código del Documento</label>
          <input required className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.codigo_doc} onChange={(e) => setForm({ ...form, codigo_doc: e.target.value })} placeholder="Ej: PR-001" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input required className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

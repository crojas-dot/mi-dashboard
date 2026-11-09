'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { crearQuejaInterna } from '@/lib/services/quejaWorkflowService'
import { getUserError } from '@/lib/errors/userError'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void | Promise<void>
  categorias: { valor: string; color: string }[]
}

export default function NuevaQuejaModal({ open, onClose, onCreated, categorias }: Props) {
  const createEmptyForm = () => ({ cliente_nombre: '', email_cliente: '', categoria: '', descripcion: '' })
  const [form, setForm] = useState(createEmptyForm)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const submitting = useRef(false)
  const confirmed = useRef(false)

  const handleClose = () => {
    if (!submitting.current) {
      setForm(createEmptyForm())
      setErrorMessage('')
      setSaved(false)
      confirmed.current = false
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current || confirmed.current) return
    submitting.current = true
    setLoading(true)
    setErrorMessage('')
    try {
      await crearQuejaInterna({
        clienteNombre: form.cliente_nombre,
        emailCliente: form.email_cliente,
        categoria: form.categoria,
        descripcion: form.descripcion,
      })
      // Un refresco fallido nunca debe convertir una alta confirmada en otro envío.
      confirmed.current = true
      setSaved(true)
      setForm(createEmptyForm())
      await onCreated()
      onClose()
      setSaved(false)
      confirmed.current = false
      showSuccess('Queja creada correctamente')
    } catch (err) {
      const message = confirmed.current
        ? 'La queja ya se guardó, pero no se pudo actualizar la vista. Cerrá este formulario y recargá el listado.'
        : getUserError(err, 'No se pudo crear la queja').message
      setErrorMessage(message)
      showError(confirmed.current ? new Error(message) : err, 'No se pudo crear la queja')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nueva Queja">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <fieldset disabled={loading || saved} className="space-y-4">
          <div>
            <label htmlFor="nueva-queja-cliente" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
            <input id="nueva-queja-cliente" required maxLength={150} className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} />
          </div>
          <div>
            <label htmlFor="nueva-queja-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Correo electrónico</label>
            <input id="nueva-queja-email" type="email" required maxLength={254} className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.email_cliente} onChange={(e) => setForm({ ...form, email_cliente: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            {categorias.length > 0 ? (
              <Select required className="w-full" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Seleccionar tipo</option>
                {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.valor}</option>)}
              </Select>
            ) : (
              <input required className="ui-field w-full px-3 py-2 text-sm" placeholder="Escribir categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            )}
          </div>
          <p className="rounded-lg border-qms-primary bg-qms-primary text-white px-3 py-2 text-sm">
            La queja se registrará inicialmente con el estado <strong>Recibido</strong>.
          </p>
          <div>
            <label htmlFor="nueva-queja-descripcion" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea id="nueva-queja-descripcion" required maxLength={10000} rows={3} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>{saved ? 'Cerrar' : 'Cancelar'}</Button>
          <Button type="submit" loading={loading} disabled={saved}>{saved ? 'Queja guardada' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

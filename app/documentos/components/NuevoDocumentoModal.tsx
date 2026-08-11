'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NuevoDocumentoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ codigo_doc: '', titulo: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('documentos').insert([{
      codigo_doc: form.codigo_doc,
      titulo: form.titulo,
      version_actual: '1.0',
      estado: 'Borrador',
    }])
    setLoading(false)
    if (error) { showError(error, 'No se pudo crear el documento'); return }
    showSuccess('Documento creado correctamente')
    setForm({ codigo_doc: '', titulo: '' })
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Documento" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Código del Documento</label>
          <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.codigo_doc} onChange={(e) => setForm({ ...form, codigo_doc: e.target.value })} placeholder="Ej: PR-001" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}

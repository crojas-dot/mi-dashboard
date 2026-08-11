'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CambiarMiPasswordModal({ open, onClose }: Props) {
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)

  const valida = (): string | null => {
    if (nueva.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
    if (nueva !== confirmacion) return 'Las contraseñas no coinciden.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errorVal = valida()
    if (errorVal) { showError(null, errorVal); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) { showError(error, 'No se pudo cambiar la contraseña'); return }
      showSuccess('Contraseña actualizada correctamente')
      setNueva('')
      setConfirmacion('')
      onClose()
    } catch (err) {
      showError(err as Error, 'No se pudo cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#e7f1ff' }}>
            <Lock className="h-5 w-5" style={{ color: '#0d6efd' }} />
          </div>
          <p className="m-0 text-sm" style={{ color: '#6c757d' }}>
            Define una nueva contraseña para tu cuenta. Debe tener al menos 8 caracteres.
          </p>
        </div>

        {[{
          label: 'Nueva contraseña',
          value: nueva,
          set: setNueva,
          placeholder: 'Mínimo 8 caracteres',
        }, {
          label: 'Confirmar contraseña',
          value: confirmacion,
          set: setConfirmacion,
          placeholder: 'Repite la nueva contraseña',
        }].map((campo) => (
          <div key={campo.label}>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>{campo.label}</label>
            <div className="relative">
              <input
                required
                type={mostrar ? 'text' : 'password'}
                placeholder={campo.placeholder}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                style={{ paddingRight: '2.25rem' }}
                value={campo.value}
                onChange={(e) => campo.set(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ border: 'none', background: 'transparent', color: '#6c757d', cursor: 'pointer' }}
                title={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={loading}>Actualizar</Button>
        </div>
      </form>
    </Modal>
  )
}

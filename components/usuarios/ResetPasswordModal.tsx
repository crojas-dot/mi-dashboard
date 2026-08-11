'use client'

import { useState } from 'react'
import { RefreshCw, Eye, EyeOff, Copy, Check, X, KeyRound, Loader2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { apiFetch, type Usuario } from '@/lib/queries/useUsuarios'

interface ResetPasswordModalProps {
  open: boolean
  usuario: Usuario | null
  onClose: () => void
  onSaved: () => void
}

export default function ResetPasswordModal({ open, usuario, onClose, onSaved }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  function generar() {
    setPassword(generatePassword(16))
    setShow(true)
    setCopied(false)
  }

  function limpiar() {
    setPassword('')
    setShow(false)
    setCopied(false)
  }

  function copiar() {
    if (!password) return
    navigator.clipboard.writeText(password).then(
      () => {
        setCopied(true)
        showSuccess('Contraseña copiada')
        setTimeout(() => setCopied(false), 2000)
      },
      () => showError(null, 'No se pudo copiar la contraseña')
    )
  }

  async function guardar() {
    if (!usuario || !password) return
    setSaving(true)
    const res = await apiFetch('/api/usuarios', {
      method: 'PATCH',
      body: JSON.stringify({ id: usuario.id, newPassword: password }),
    })
    setSaving(false)
    if (res.ok) {
      showSuccess('Contraseña actualizada')
      limpiar()
      onClose()
      onSaved()
    } else {
      const data = await res.json().catch(() => null)
      showError(null, data?.error || 'No se pudo restablecer la contraseña')
    }
  }

  function cerrar() {
    limpiar()
    onClose()
  }

  return (
    <Modal open={open} onClose={cerrar} title="Resetear contraseña" size="sm">
      <div className="space-y-4">
        <p className="m-0 text-sm" style={{ color: '#495057' }}>
          Genera una nueva contraseña para <span className="font-semibold" style={{ color: '#212529' }}>{usuario?.nombre}</span>.
        </p>

        {password ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100" style={{ borderColor: '#e9ecef', backgroundColor: '#fff' }}>
              <KeyRound className="h-4 w-4 shrink-0" style={{ color: '#0d6efd' }} />
              <input
                type={show ? 'text' : 'password'}
                readOnly
                value={password}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
                style={{ color: '#212529' }}
              />
              <button type="button" onClick={() => setShow(!show)} className="shrink-0 transition-colors hover:opacity-70" style={{ color: '#6c757d', border: 'none', background: 'none', cursor: 'pointer' }} title={show ? 'Ocultar' : 'Mostrar'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={limpiar} className="shrink-0 transition-colors hover:opacity-70" style={{ color: '#6c757d', border: 'none', background: 'none', cursor: 'pointer' }} title="Limpiar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="secondary" onClick={generar}>
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={copiar}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiada' : 'Copiar'}
                </Button>
                <Button type="button" size="sm" onClick={guardar} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-3" style={{ borderColor: '#d0d5dd', backgroundColor: '#fafafa' }}>
            <span className="text-sm" style={{ color: '#6c757d' }}>No hay contraseña generada</span>
            <Button type="button" size="sm" onClick={generar}>
              <RefreshCw className="h-3.5 w-3.5" /> Generar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

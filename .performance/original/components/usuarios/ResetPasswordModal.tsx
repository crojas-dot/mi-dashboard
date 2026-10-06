'use client'

import { useEffect, useRef, useState } from 'react'
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

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
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), 2000)
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
        <p className="m-0 text-sm text-gray-600">
          Genera una nueva contraseña para <span className="font-semibold text-qms-dark">{usuario?.nombre}</span>.
        </p>

        {password ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-card border border-gray-200 bg-qms-surface px-3 py-2 transition focus-within:border-qms-primary focus-within:ring-2 focus-within:ring-blue-100">
              <KeyRound className="h-4 w-4 shrink-0 text-qms-primary" />
              <input
                type={show ? 'text' : 'password'}
                readOnly
                value={password}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-qms-dark outline-none"
              />
              <button type="button" onClick={() => setShow(!show)} className="shrink-0 cursor-pointer border-0 bg-transparent text-qms-muted transition-colors hover:opacity-70" title={show ? 'Ocultar' : 'Mostrar'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={limpiar} className="shrink-0 cursor-pointer border-0 bg-transparent text-qms-muted transition-colors hover:opacity-70" title="Limpiar">
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
          <div className="flex items-center justify-between rounded-card border border-dashed border-gray-300 bg-gray-50 px-3 py-3">
            <span className="text-sm text-qms-muted">No hay contraseña generada</span>
            <Button type="button" size="sm" onClick={generar}>
              <RefreshCw className="h-3.5 w-3.5" /> Generar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Eye, EyeOff, Copy, Check, X, KeyRound } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { generatePassword } from '@/lib/services/passwordGenerator'
import type { Usuario } from '@/lib/queries/useUsuarios'
import { mutateUsuario } from '@/lib/services/usuariosService'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import { getUserError } from '@/lib/errors/userError'

interface ResetPasswordModalProps {
  open: boolean
  usuario: Usuario | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export default function ResetPasswordModal({ open, usuario, onClose, onSaved }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const lock = useOperationLock<'guardar'>()
  const saving = lock.operation === 'guardar'
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  function generar() {
    if (lock.isLocked()) return
    setError(null)
    setPassword(generatePassword(16))
    setShow(true)
    setCopied(false)
  }

  function limpiarBorrador() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setPassword('')
    setShow(false)
    setCopied(false)
  }

  function limpiar() {
    if (lock.isLocked()) return
    limpiarBorrador()
    setError(null)
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
    if (!usuario || !password || !lock.begin('guardar')) return
    setError(null)
    try {
      await mutateUsuario('PATCH', { id: usuario.id, newPassword: password }, 'No se pudo restablecer la contraseña')
      showSuccess('Contraseña actualizada')
      limpiarBorrador()
      onClose()
      try {
        await onSaved()
      } catch {
        showError(null, 'La contraseña se actualizó, pero no se pudo actualizar el listado')
      }
    } catch (cause) {
      const fallback = 'No se pudo restablecer la contraseña'
      setError(getUserError(cause, fallback).message)
      showError(cause, fallback)
    } finally {
      lock.finish()
    }
  }

  function cerrar() {
    if (lock.isLocked()) return
    limpiar()
    onClose()
  }

  return (
    <Modal open={open} onClose={cerrar} title="Resetear contraseña" size="sm">
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        <p className="m-0 text-sm text-gray-600">
          Genera una nueva contraseña para <span className="font-semibold text-qms-dark">{usuario?.nombre}</span>.
        </p>

        {password ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-card border border-qms-border bg-qms-surface px-3 py-2">
              <KeyRound className="h-4 w-4 shrink-0 text-qms-primary" />
              <input
                aria-label="Contraseña generada"
                type={show ? 'text' : 'password'}
                readOnly
                value={password}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-qms-dark outline-none"
              />
              <button type="button" onClick={() => setShow(!show)} className="ui-button ui-button-ghost ui-button-sm shrink-0 cursor-pointer hover:opacity-70" title={show ? 'Ocultar' : 'Mostrar'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={limpiar} disabled={saving} className="ui-button ui-button-ghost ui-button-sm shrink-0 cursor-pointer hover:opacity-70" title="Limpiar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="secondary" onClick={generar} disabled={saving}>
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={copiar}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiada' : 'Copiar'}
                </Button>
                <Button type="button" size="sm" onClick={guardar} loading={saving} disabled={saving}>
                  {!saving && <KeyRound className="h-3.5 w-3.5" />}
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-card border border-dashed border-qms-border bg-qms-hover-bg px-3 py-3">
            <span className="text-sm text-qms-muted">No hay contraseña generada</span>
            <Button type="button" size="sm" onClick={generar} disabled={saving}>
              <RefreshCw className="h-3.5 w-3.5" /> Generar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

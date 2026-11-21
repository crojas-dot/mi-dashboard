'use client'

import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { CORREO_ACCESO_CONFIRMADO, gestionarAccesoUsuario } from '@/lib/services/usuariosService'
import type { Usuario } from '@/lib/queries/useUsuarios'
import type { UserMutationResult } from '@/lib/types/access'

interface Props {
  usuario: Usuario
  esAuto?: boolean
  disabled: boolean
  onBegin: () => boolean
  onEnd: () => void
  onChanged: () => void | Promise<void>
}

export default function UsuarioSeguridadAcceso({ usuario, esAuto, disabled, onBegin, onEnd, onChanged }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [delivery, setDelivery] = useState<UserMutationResult | null>(null)
  const [error, setError] = useState('')
  const [refreshFailed, setRefreshFailed] = useState(false)
  const pending = usuario.access?.temporaryPassword || Boolean(delivery?.ok)
  const expired = !delivery && usuario.access?.status === 'password_expired'
  const action = pending ? 'resend' : 'reset'
  const label = pending ? 'Reenviar acceso' : 'Restablecer contraseña'
  const unavailable = disabled || esAuto || usuario.estado !== 'activo' || !usuario.auth_id

  async function run() {
    if (unavailable || !usuario.auth_id || !onBegin()) return
    setRunning(true)
    setError('')
    setRefreshFailed(false)
    try {
      const result = await gestionarAccesoUsuario(usuario.auth_id, action)
      setDelivery(result)
      setConfirm(false)
      try { await onChanged() } catch { setRefreshFailed(true) }
    } catch (cause) {
      setConfirm(false)
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el acceso.')
    } finally {
      setRunning(false)
      onEnd()
    }
  }

  return <section className="rounded-card border border-qms-border bg-qms-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><ShieldCheck aria-hidden="true" className="size-4 text-qms-primary" />Acceso a la cuenta</h3>
        <p className="mt-2 text-sm text-qms-muted">
          {expired ? 'El acceso temporal venció.' : pending ? 'Cambio de contraseña pendiente.' : 'Enviá una contraseña temporal que deberá cambiarse al iniciar sesión.'}
        </p>
      </div>
      <Button type="button" size="sm" variant="secondary" disabled={unavailable} onClick={() => setConfirm(true)}>
        {pending ? <Mail aria-hidden="true" className="size-4" /> : <KeyRound aria-hidden="true" className="size-4" />}{label}
      </Button>
    </div>
    {delivery?.accessDelivery === 'sent' && <p role="status" className="mt-3 text-sm text-qms-success">{CORREO_ACCESO_CONFIRMADO}</p>}
    {delivery && delivery.accessDelivery !== 'sent' && <p role="alert" className="mt-3 text-sm text-qms-danger">
      Se generó la contraseña temporal, pero no se pudo enviar el correo de acceso. {delivery.accessDeliveryError}
    </p>}
    {refreshFailed && <p role="status" className="mt-2 text-sm text-qms-muted">El listado de usuarios no se pudo actualizar.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-qms-danger">{error}</p>}
    <ConfirmDialog open={confirm} title={label}
      message={`Se enviará una nueva contraseña temporal a ${usuario.email}. La anterior dejará de funcionar.`}
      confirmLabel={label} loading={running} onCancel={() => setConfirm(false)} onConfirm={() => void run()} />
  </section>
}

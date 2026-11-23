'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { KeyRound, Mail, RotateCcw, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { CORREO_ACCESO_CONFIRMADO, gestionarAccesoUsuario } from '@/lib/services/usuariosService'
import type { Usuario } from '@/lib/queries/useUsuarios'
import type { UserMutationResult } from '@/lib/types/access'

interface Props {
  usuario: Usuario
  esAuto?: boolean
  active?: boolean
  disabled: boolean
  onBegin: () => boolean
  onEnd: () => void
  onChanged: () => void | Promise<void>
}
type Action = 'resend' | 'reset' | 'reset_mfa' | 'manual'

export default function UsuarioSeguridadAcceso({ usuario, esAuto, active = true, disabled, onBegin, onEnd, onChanged }: Props) {
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [running, setRunning] = useState(false)
  const [delivery, setDelivery] = useState<(UserMutationResult & { kind: 'invitation' | 'temporary' }) | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [manualPassword, setManualPassword] = useState<string | null>(null)
  const [manualCopied, setManualCopied] = useState(false)
  const [manualContext, setManualContext] = useState({ active, authId: usuario.auth_id })
  // Borrar el secreto antes de renderizar otra visita o cuenta, sin un efecto
  // que dispare un segundo render. Una respuesta tardía no debe mostrarlo.
  if (manualContext.active !== active || manualContext.authId !== usuario.auth_id) {
    setManualContext({ active, authId: usuario.auth_id })
    setManualPassword(null)
    setManualCopied(false)
  }
  const manualVisit = useRef(0)
  useLayoutEffect(() => {
    return () => { manualVisit.current++ }
  }, [active, usuario.auth_id])
  const policy = usuario.access
  const invited = policy?.status === 'invite_pending' || policy?.status === 'invite_expired'
  const temporary = !!policy?.temporaryPassword
  const pending = invited || temporary
  const action: 'resend' | 'reset' = pending ? 'resend' : 'reset'
  const label = invited ? 'Reenviar invitación' : temporary ? 'Reenviar acceso' : 'Restablecer contraseña'
  const unavailable = disabled || esAuto || usuario.estado !== 'activo' || !usuario.auth_id
  const confirmLabel = confirm === 'manual' ? 'Generar contraseña manual' : confirm === 'reset_mfa' ? 'Restablecer 2FA' : confirm === 'resend' ? label : 'Restablecer contraseña'

  async function run() {
    const operation = confirm
    if (!operation || unavailable || !usuario.auth_id || !onBegin()) return
    const visit = manualVisit.current
    setRunning(true); setError(''); setMessage(''); setRefreshFailed(false)
    setManualPassword(null); setManualCopied(false)
    try {
      const result = await gestionarAccesoUsuario(usuario.auth_id, operation)
      if (operation === 'reset_mfa') {
        setDelivery(null)
        setMessage('Verificación restablecida. La cuenta deberá configurar nuevamente su segundo factor al ingresar.')
      } else if (operation === 'manual') {
        if (typeof result.tempPassword !== 'string') throw new Error('El servicio no confirmó la contraseña manual.')
        setDelivery(null)
        if (active && manualVisit.current === visit) setManualPassword(result.tempPassword)
      } else {
        setDelivery({ ...result, kind: invited && operation === 'resend' ? 'invitation' : 'temporary' })
      }
      setConfirm(null)
      try { await onChanged() } catch { setRefreshFailed(true) }
    } catch (cause) {
      setConfirm(null)
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el acceso.')
    } finally { setRunning(false); onEnd() }
  }

  const confirmation = confirm === 'reset_mfa'
    ? `Se eliminará la verificación actual de ${usuario.nombre}, se cerrarán sus sesiones y deberá configurar un método nuevo. La obligación de 2FA se mantiene.`
    : confirm === 'manual'
      ? `Se generará una contraseña temporal para ${usuario.nombre} y se mostrará una sola vez. La anterior dejará de funcionar. No se enviará correo.`
    : confirm === 'resend' && invited
      ? `Se enviará una nueva invitación a ${usuario.email}. El enlace anterior dejará de funcionar.`
      : `Se enviará una nueva contraseña temporal a ${usuario.email}. La anterior dejará de funcionar.`

  return <section className="rounded-card border border-qms-border bg-qms-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-dark">
          <ShieldCheck aria-hidden="true" className="size-4 text-qms-primary" />Configuración de acceso
        </h3>
        <p className="mt-2 text-sm text-qms-muted">
          {invited ? policy?.status === 'invite_expired' ? 'La invitación venció y puede reenviarse.' : 'El usuario todavía no ha configurado su acceso mediante la invitación.'
            : temporary ? policy?.status === 'password_expired' ? 'La contraseña temporal venció.' : 'El usuario debe cambiar su contraseña temporal.'
              : 'Podés restablecer la contraseña de esta cuenta mediante un correo de acceso.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!invited && policy && <Button type="button" size="sm" variant="secondary" disabled={unavailable} onClick={() => setConfirm('manual')}>
          <KeyRound aria-hidden="true" className="size-4" />Generar acceso manual
        </Button>}
        <Button type="button" size="sm" variant="secondary" disabled={unavailable} onClick={() => setConfirm(action)}>
          {invited || temporary ? <Mail aria-hidden="true" className="size-4" /> : <KeyRound aria-hidden="true" className="size-4" />}{label}
        </Button>
      </div>
    </div>
    {policy && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-qms-border pt-4">
      <div>
        <p className="text-sm font-medium text-qms-dark">Verificación en dos pasos</p>
        <p className="mt-1 text-xs text-qms-muted">
          {!policy.requireMfa ? 'No requerida para esta cuenta.'
            : policy.method === 'totp' ? 'Aplicación autenticadora configurada.'
              : policy.method === 'email' ? 'Correo alternativo verificado.'
                : 'Obligatoria. Pendiente de configurar durante el primer ingreso.'}
        </p>
      </div>
      {policy.requireMfa && <Button type="button" size="sm" variant="secondary" disabled={unavailable} onClick={() => setConfirm('reset_mfa')}>
        <RotateCcw aria-hidden="true" className="size-4" />Restablecer 2FA
      </Button>}
    </div>}
    {delivery?.accessDelivery === 'sent' && <p role="status" className="mt-3 text-sm text-qms-success">
      {delivery.kind === 'invitation' ? 'Invitación enviada al servicio de correo. El enlace anterior dejó de funcionar.' : CORREO_ACCESO_CONFIRMADO}
    </p>}
    {delivery && delivery.accessDelivery !== 'sent' && <p role="alert" className="mt-3 text-sm text-qms-danger">
      {delivery.kind === 'invitation' ? 'La invitación se generó, pero no se confirmó su envío.' : 'Se generó una contraseña temporal, pero no se confirmó su envío.'}
      {delivery.accessDeliveryError ? ' ' + delivery.accessDeliveryError : ' Verificá el resultado antes de reenviar.'}
    </p>}
    {active && manualContext.authId === usuario.auth_id && manualPassword && <div role="status" className="mt-4 space-y-3 rounded-card border border-qms-border bg-qms-background p-4">
      <p className="text-sm font-medium text-qms-dark">Contraseña temporal generada · válida durante 3 días hábiles</p>
      <div><p className="text-xs text-qms-muted">Usuario</p><p className="break-all text-sm text-qms-dark">{usuario.email}</p></div>
      <div><p className="text-xs text-qms-muted">Contraseña temporal</p>
        <div className="mt-2 rounded-md border border-qms-border border-l-4 border-l-qms-primary bg-qms-surface px-3 py-3">
          <code className="block select-all break-all font-mono text-base font-semibold leading-relaxed text-qms-dark">{manualPassword}</code>
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(manualPassword)
        .then(() => setManualCopied(true)).catch(() => setError('No se pudo copiar; seleccioná la contraseña manualmente.'))}>
        {manualCopied ? 'Contraseña copiada' : 'Copiar contraseña'}
      </Button>
      <p className="text-xs leading-relaxed text-qms-muted">Entregala por un canal seguro. Se borrará de esta pantalla al cerrar y el usuario deberá cambiarla al iniciar sesión.</p>
    </div>}
    {message && <p role="status" className="mt-3 text-sm text-qms-success">{message}</p>}
    {refreshFailed && <p role="status" className="mt-2 text-sm text-qms-muted">El listado de usuarios no se pudo actualizar.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-qms-danger">{error}</p>}
    <ConfirmDialog open={confirm !== null} title={confirmLabel} message={confirmation}
      confirmLabel={confirmLabel} danger={confirm === 'reset_mfa'} loading={running}
      onCancel={() => setConfirm(null)} onConfirm={() => void run()} />
  </section>
}

'use client'

import { useRef, useState } from 'react'
import { Mail, RotateCcw, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { gestionarAccesoUsuario } from '@/lib/services/usuariosService'
import type { Usuario } from '@/lib/queries/useUsuarios'

interface Props {
  usuario: Usuario
  esAuto?: boolean
  disabled: boolean
  onBegin: () => boolean
  onEnd: () => void
  onChanged: () => void | Promise<void>
}
export default function UsuarioSeguridadAcceso({ usuario, esAuto, disabled, onBegin, onEnd, onChanged }: Props) {
  const [confirm, setConfirm] = useState(false), [operation, setOperation] = useState<'resend' | 'reset_mfa' | null>(null)
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [reset, setReset] = useState(false)
  const working = useRef(false), policy = usuario.access
  async function run(action: 'resend' | 'reset_mfa') {
    if (working.current || !usuario.auth_id || !onBegin()) return
    working.current = true; setOperation(action); setError(''); setMessage('')
    try {
      await gestionarAccesoUsuario(usuario.auth_id, action, action === 'reset_mfa')
      setConfirm(false)
      if (action === 'reset_mfa') setReset(true)
      setMessage(action === 'resend' ? 'Invitación enviada. El enlace anterior dejó de funcionar.' : 'Verificación restablecida. Se cerraron sus sesiones y deberá configurar un método nuevo.')
      try { await onChanged() } catch { setMessage('El acceso se actualizó, pero el listado no pudo refrescarse. Cerrá y volvé a abrir el registro.') }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el acceso.') }
    finally { working.current = false; setOperation(null); onEnd() }
  }
  return <section className="rounded-card border border-qms-border bg-qms-surface p-5 sm:p-6">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><ShieldCheck aria-hidden="true" className="size-4 text-qms-primary" />Configuración de acceso</h3>
    {!policy ? <p className="mt-2 text-sm text-qms-muted">Esta cuenta conserva su política anterior. Las nuevas exigencias de verificación no se aplican a usuarios existentes.</p> : <div className="mt-4 space-y-4">
      {['invite_pending', 'invite_expired'].includes(policy.status) && <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">Invitación de acceso</p><p className="mt-1 text-xs text-qms-muted">{policy.invitationFailed ? 'El usuario fue creado, pero no se pudo enviar la invitación.' : policy.status === 'invite_expired' ? 'El enlace venció. Reenviá una invitación para configurar el acceso.' : 'Todavía no configuró su contraseña.'}</p></div><Button type="button" size="sm" variant="secondary" disabled={disabled || usuario.estado !== 'activo'} loading={operation === 'resend'} onClick={() => void run('resend')}><Mail aria-hidden="true" className="size-4" />Reenviar invitación</Button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">Verificación en dos pasos</p><p className="mt-1 text-xs text-qms-muted">{reset ? 'Pendiente de configurar nuevamente.' : !policy.requireMfa ? 'No requerida para esta cuenta.' : policy.method === 'totp' ? 'Aplicación autenticadora configurada.' : policy.method === 'email' ? 'Correo alternativo verificado.' : 'Se configurará durante el primer ingreso.'}</p></div>
        {policy.requireMfa && <Button type="button" size="sm" variant="secondary" disabled={disabled || esAuto || reset} onClick={() => setConfirm(true)}><RotateCcw aria-hidden="true" className="size-4" />Restablecer 2FA</Button>}
      </div>
    </div>}
    {message && <p role="status" className="mt-3 text-sm text-qms-success">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-qms-danger">{error}</p>}
    <ConfirmDialog open={confirm} title="Restablecer verificación" message={`Se eliminará el método de ${usuario.nombre}, se cerrarán sus sesiones y tendrá que configurar uno nuevo. La verificación seguirá siendo obligatoria.`} confirmLabel="Restablecer 2FA" danger loading={operation === 'reset_mfa'} onCancel={() => setConfirm(false)} onConfirm={() => void run('reset_mfa')} />
  </section>
}

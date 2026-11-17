'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Mail, ShieldCheck, Smartphone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import SessionScreen from '@/components/SessionScreen'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/auth-store'
import { isLogoutPending } from '@/lib/authLogoutIntent'
import { accessAction } from '@/lib/services/accessClient'
import type { AccessMethod, AccessStatus } from '@/lib/types/access'

interface Challenge { id: string; qrCode?: string; secret?: string; maskedEmail?: string }
export default function AccessPage() {
  const router = useRouter(), access = useAuthStore(s => s.access), identity = useAuthStore(s => s.accessIdentity), user = useAuthStore(s => s.user)
  const refresh = useAuthStore(s => s.refreshAccess), logout = useAuthStore(s => s.logout)
  const [invitation, setInvitation] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [method, setMethod] = useState<AccessMethod | null>(null), [email, setEmail] = useState(''), [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)
  const [help, setHelp] = useState(false)
  const [linkLoaded, setLinkLoaded] = useState(false)
  const working = useRef(false), automatic = useRef(''), linkInvitation = useRef<string | null>(null)
  useEffect(() => {
    // StrictMode limpia y repite este efecto: conservar primero el token en
    // memoria, antes de retirarlo de la URL o cancelar el primer frame.
    if (linkInvitation.current === null) {
      linkInvitation.current = new URLSearchParams(location.hash.slice(1)).get('invitacion') ?? ''
      if (linkInvitation.current) history.replaceState(null, '', location.pathname)
    }
    const frame = requestAnimationFrame(() => { setInvitation(linkInvitation.current ?? ''); setLinkLoaded(true) })
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (linkLoaded && !invitation && user) router.replace('/')
  }, [linkLoaded, invitation, user, router])
  const effective = access?.method ?? method
  async function run(operation: () => Promise<void>) {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try { await operation() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo continuar.') }
    finally { working.current = false; setBusy(false) }
  }
  const current = (id: string | null) => !!id && useAuthStore.getState().accessIdentity === id && !isLogoutPending()
  async function start(chosen: AccessMethod) {
    const owner = identity
    await run(async () => {
      const value = await accessAction<Challenge>(chosen === 'totp' ? { action: 'totp_start' } : { action: 'email_send', ...(access?.phase === 'enroll' ? { email } : {}) })
      if (current(owner)) { setMethod(chosen); setChallenge(value); setCode(''); setCopied(false) }
    })
  }
  // Una sola petición automática por visita/identidad, incluso con StrictMode.
  useEffect(() => {
    if (access?.phase !== 'verify' || !access.method || !identity) return
    const key = identity + ':' + access.generation + ':' + access.method
    if (automatic.current === key) return
    automatic.current = key
    void start(access.method)
    // La identidad y generación definen el desafío, no cada render del formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.phase, access?.method, access?.generation, identity])
  async function verify(event: React.FormEvent) {
    event.preventDefault(); if (!challenge || !effective) return
    const owner = identity
    await run(async () => {
      const result = await accessAction<AccessStatus | { status: AccessStatus; session: { access_token: string; refresh_token: string } }>(
        { action: effective === 'totp' ? 'totp_verify' : 'email_verify', id: challenge.id, code })
      if (!current(owner)) return
      if ('session' in result) { const saved = await supabase.auth.setSession(result.session); if (saved.error) throw new Error('Volvé a iniciar sesión para continuar.') }
      setCode(''); await refresh()
    })
  }
  async function savePassword(event:React.FormEvent) {
    event.preventDefault()
    await run(async()=>{
      if(password!==confirmation)throw new Error('Las contraseñas no coinciden.')
      const owner=identity
      await accessAction({action:'password',password})
      if(current(owner)){setPassword('');setConfirmation('');await refresh()}
    })
  }
  if (!linkLoaded) return <SessionScreen layout="neutral" />
  const title = invitation ? 'Configurá tu acceso' : access?.phase === 'password' ? 'Creá tu contraseña' : 'Protegé tu cuenta'
  return <div className="flex min-h-dvh items-center justify-center bg-qms-background px-4 py-8 text-qms-dark">
    <div className="w-full max-w-lg">
      <div className="mb-6 flex items-center justify-center gap-3"><span className="flex size-11 items-center justify-center rounded-card bg-qms-primary text-xl font-semibold text-white">E</span><span className="text-xl font-semibold">ECA-QMS</span></div>
      <section className="rounded-card border border-qms-border bg-qms-surface p-6 shadow-sm sm:p-8">
        <ShieldCheck className="mx-auto mb-3 size-7 text-qms-primary" aria-hidden="true" />
        <h1 className="text-center text-xl font-semibold">{title}</h1>
        {invitation ? <div className="mt-5 space-y-5"><p className="text-sm leading-relaxed text-qms-muted">Usá esta invitación para elegir tu contraseña y completar la configuración de seguridad. El enlace se utiliza una sola vez.</p>
          {user && <p className="rounded-button bg-qms-background px-3 py-2 text-sm leading-relaxed text-qms-muted">Tenés una sesión abierta como <span className="font-medium text-qms-dark">{user.nombre}</span>. Al continuar cambiarás a la cuenta invitada en este navegador.</p>}
          <Button className="w-full" loading={busy} onClick={() => void run(async () => {
            const previous = useAuthStore.getState().accessIdentity
            const response = await fetch('/api/public/acceso/invitacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: invitation }) })
            const value = await response.json(); if (!response.ok) throw new Error(value.error ?? 'Invitación no disponible.')
            if (isLogoutPending() || useAuthStore.getState().accessIdentity !== previous) throw new Error('La sesión cambió. Abrí nuevamente la invitación para continuar.')
            const result = await supabase.auth.setSession(value.session); if (result.error) throw new Error('No se pudo abrir la sesión.')
            await refresh(); setInvitation('')
          })}>Configurar acceso</Button></div>
          : access?.phase === 'password' ? <form className="mt-5 space-y-4" onSubmit={savePassword}>
            <p className="text-sm text-qms-muted">Elegí una contraseña propia para continuar. La contraseña temporal dejará de funcionar.</p>
            <Field label="Nueva contraseña" id="access-password"><Input id="access-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></Field>
            <Field label="Confirmar contraseña" id="access-confirm"><Input id="access-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></Field>
            <p className="text-xs text-qms-muted">Usá al menos 12 caracteres.</p><Button type="submit" loading={busy} className="w-full"><KeyRound className="size-4" />Guardar y continuar</Button>
          </form>
            : access && ['enroll', 'verify'].includes(access.phase) ? <div className="mt-5 space-y-5">
              <p className="text-center text-sm text-qms-muted">{access.phase === 'enroll' ? 'Elegí un método de seguridad adicional.' : 'Confirmá tu identidad para entrar al sistema.'}</p>
              {access.phase === 'enroll' && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Método de seguridad">
                {(['totp', 'email'] as const).map(value => <button key={value} type="button" disabled={busy} aria-pressed={effective === value} onClick={() => { setMethod(value); setChallenge(null); setCode(''); setError('') }}
                  className={`flex items-center justify-center gap-2 rounded-button border px-3 py-3 text-sm ${effective === value ? 'border-qms-primary bg-qms-primary-soft text-qms-primary' : 'border-qms-border text-qms-muted hover:bg-qms-hover-bg'}`}>
                  {value === 'totp' ? <Smartphone className="size-4" /> : <Mail className="size-4" />}{value === 'totp' ? 'Aplicación' : 'Correo alternativo'}</button>)}
              </div>}
              {effective === 'totp' && !challenge && <Button variant="secondary" className="w-full" loading={busy} onClick={() => void start('totp')}>Configurar aplicación autenticadora</Button>}
              {effective === 'email' && !challenge && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void start('email') }}>
                {access.phase === 'enroll' ? <Field id="alternative-email" label="Correo alternativo"><Input id="alternative-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /><p className="mt-1 text-xs text-qms-muted">Debe ser diferente al correo con el que ingresás.</p></Field>
                  : <p className="text-sm text-qms-muted">Enviaremos el código a {access.maskedEmail}.</p>}
                <Button className="w-full" type="submit" loading={busy}>Enviar código de verificación</Button>
              </form>}
              {challenge && <>
                {effective === 'totp' && challenge.qrCode && <div className="space-y-3 text-center">
                  <p className="text-sm text-qms-muted">Escaneá el código con tu aplicación autenticadora.</p>
                  <Image unoptimized src={challenge.qrCode} width={200} height={200} alt="Código QR para configurar tu aplicación autenticadora" className="mx-auto" />
                  <div className="flex min-w-0 items-center gap-2 rounded-button border border-qms-border p-2"><code className="min-w-0 flex-1 break-all text-xs">{challenge.secret}</code><Button variant="ghost" size="sm" aria-label="Copiar clave manual" onClick={() => void navigator.clipboard.writeText(challenge.secret ?? '').then(() => setCopied(true), () => setError('No se pudo copiar la clave.'))}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button></div>
                </div>}
                {effective === 'email' && <p className="text-sm text-qms-muted">Ingresá el código enviado a <span className="font-medium text-qms-dark">{challenge.maskedEmail}</span>.</p>}
                <form onSubmit={verify} className="space-y-3"><Field label="Código de 6 dígitos" id="security-code"><Input id="security-code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} className="text-center text-xl tracking-[.4em]" /></Field>
                  <Button type="submit" className="w-full" loading={busy}>Verificar y continuar</Button></form>
                <Button variant="link" size="sm" disabled={busy} onClick={() => void start(effective!)}>{effective === 'email' ? 'Solicitar un nuevo código' : 'Reiniciar verificación'}</Button>
              </>}
              {effective === 'totp' && <div><Button size="sm" variant="link" onClick={() => setHelp(v => !v)}>¿Cómo configuro una aplicación autenticadora?</Button>{help && <p className="mt-2 text-xs leading-relaxed text-qms-muted">Abrí tu aplicación autenticadora, elegí agregar una cuenta y escaneá el QR. También podés ingresar la clave manual. Después escribí el código de seis dígitos que muestra la aplicación.</p>}</div>}
            </div>
              : access?.phase === 'locked' ? <div className="mt-5 space-y-4"><p className="text-sm text-qms-muted">Demasiados intentos fallidos. Por seguridad, esperá unos minutos antes de volver a intentarlo.</p><Button variant="secondary" onClick={() => void refresh()}>Volver a comprobar</Button></div>
                : access?.phase === 'reset_pending' ? <p className="mt-5 text-sm text-qms-muted">Un administrador está restableciendo tu verificación. Contactalo para completar el proceso.</p>
                  : <div className="mt-5 space-y-4"><p className="text-sm text-qms-muted">{user ? 'Tu acceso está configurado.' : 'Abrí tu invitación o iniciá sesión para continuar.'}</p><Button className="w-full" onClick={() => router.replace(user ? '/' : '/login')}>{user ? 'Ir al sistema' : 'Iniciar sesión'}</Button></div>}
        {error && <p role="alert" className="mt-4 text-sm text-qms-danger">{error}</p>}
      </section>
      {!invitation && identity && <div className="mt-4 text-center"><Button variant="link" size="sm" disabled={busy} onClick={() => void logout()}>Cerrar sesión</Button></div>}
    </div>
  </div>
}

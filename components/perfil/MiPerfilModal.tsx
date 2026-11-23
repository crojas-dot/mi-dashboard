'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Check, Copy, Eye, EyeOff, Play, WandSparkles } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switch from '@/components/ui/Switch'
import Tabs from '@/components/ui/Tabs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/auth-store'
import { SONIDO_DEFAULT, SONIDOS_NOTIFICACION, playNotificationSound } from '@/lib/services/sonidosNotificacion'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getRoleLabel } from '@/lib/constants/roles'
import { AVATAR_ACCEPT, AVATAR_UPLOAD_BYTES } from '@/lib/constants/avatar'
import { captureQueryContext } from '@/lib/queries/queryContextScope'
import { cambiarClavePerfil, cambiarFotoPerfil, tokenPerfil } from '@/lib/services/miPerfilService'
import { accessAction } from '@/lib/services/accessClient'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { REPLACEMENT_PASSWORD_MIN, isValidReplacementPassword } from '@/lib/constants/accessPassword'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import FotoPerfil from '@/components/perfil/FotoPerfil'
import LogoRecorteModal, { type BorradorLogo } from '@/app/configuracion/components/LogoRecorteModal'

interface Props {
  open: boolean
  onClose: () => void
  fotoUrl?: string
  initialTab?: TabId
}

const TABS = [
  { id: 'detalles', label: 'Detalles del perfil' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'notificaciones', label: 'Notificaciones' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * Perfil personal del usuario autenticado. Reúne lo que antes vivía repartido en
 * el menú del encabezado: nombre, contraseña y preferencias de notificación.
 * Nombre usa la política RLS de autoedición; contraseña va por Supabase Auth y
 * las preferencias conservan el RPC existente. No administra a otras cuentas.
 */
export default function MiPerfilModal({ open, onClose, fotoUrl, initialTab = 'detalles' }: Props) {
  const user = useAuthStore(state => state.user)
  const access = useAuthStore(state => state.access)
  const refreshAccess = useAuthStore(state => state.refreshAccess)
  const temporary = access?.temporaryPassword === true
  const queryClient = useQueryClient()
  const setNombreGuardado = useAuthStore(state => state.setNombre)
  const setPrefs = useAuthStore(state => state.setPrefs)
  const setAvatar = useAuthStore(state => state.setAvatar)
  const [tab, setTab] = useState<TabId>(initialTab)
  const [nombre, setNombre] = useState(user?.nombre ?? '')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [nombreError, setNombreError] = useState('')
  const [nombreAviso, setNombreAviso] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [claveVisible, setClaveVisible] = useState(false)
  const [claveGenerada, setClaveGenerada] = useState(false)
  const [claveCopiada, setClaveCopiada] = useState(false)
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [claveError, setClaveError] = useState('')
  const [claveAviso, setClaveAviso] = useState('')
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)
  const [borradorFoto, setBorradorFoto] = useState<BorradorLogo | null>(null)
  const fotoOperation = useOperationLock<'subir' | 'quitar'>()

  useEffect(() => {
    const temporal = borradorFoto?.url
    return () => { if (temporal) URL.revokeObjectURL(temporal) }
  }, [borradorFoto])

  if (!user) return null

  const inicial = user.nombre.split(' ').map(palabra => palabra[0]).join('').slice(0, 2).toUpperCase() || 'US'
  const nombreLimpio = nombre.trim()
  const nombreCambio = nombreLimpio !== user.nombre
  const notifHabilitadas = user.notif_habilitadas !== false
  const notifSonido = user.notif_sonido !== false
  const sonidoSeleccionado = user.notif_sonido_id || SONIDO_DEFAULT
  const minimoClave = temporary ? REPLACEMENT_PASSWORD_MIN : 8
  const claveCompleta = (temporary ? isValidReplacementPassword(nueva) : nueva.length >= minimoClave) && nueva === confirmacion

  function generarClave() {
    const valor = generatePassword(20)
    setNueva(valor); setConfirmacion(valor); setClaveGenerada(true); setClaveCopiada(false)
    setClaveVisible(true); setClaveError(''); setClaveAviso('')
  }

  async function copiarClave() {
    try { await navigator.clipboard.writeText(nueva); setClaveCopiada(true) }
    catch { setClaveError('No se pudo copiar automáticamente. Seleccioná la contraseña visible y copiala manualmente.') }
  }

  function perfilActual() {
    const identity = useAuthStore.getState().accessIdentity
    const contextCurrent = captureQueryContext(queryClient)
    return {
      token: () => tokenPerfil(identity),
      current: () => {
        const session = useAuthStore.getState()
        return contextCurrent() && !session.signingOut && session.accessIdentity === identity && session.user?.id === user?.id
      },
    }
  }

  const cambiarFoto = async (file: File | null) => {
    if (file && (!AVATAR_ACCEPT.split(',').includes(file.type) || file.size === 0 || file.size > AVATAR_UPLOAD_BYTES)) {
      showError(new Error('Elegí una foto JPG, PNG o WebP de hasta 2 MB.'), 'No se pudo subir la foto')
      return
    }
    if (!fotoOperation.begin(file ? 'subir' : 'quitar')) return
    const scope = perfilActual()
    try {
      const token = await scope.token()
      if (!scope.current()) return
      const path = await cambiarFotoPerfil(token, file)
      if (!scope.current()) return
      setAvatar(path)
      setBorradorFoto(null)
      showSuccess(file ? 'Foto actualizada' : 'Foto quitada')
    } catch (error) {
      if (scope.current()) showError(error, 'No se pudo actualizar la foto')
    } finally {
      fotoOperation.finish()
    }
  }

  // La autoedición de nombre está autorizada por RLS (auth.uid() = auth_id) y el
  // grant por columna; el correo y el rol siguen perteneciendo a Usuarios.
  const guardarNombre = async (event: React.FormEvent) => {
    event.preventDefault()
    if (guardandoNombre) return
    setNombreError('')
    setNombreAviso('')
    if (!nombreLimpio) { setNombreError('El nombre no puede estar vacío.'); return }
    if (!nombreCambio) { onClose(); return }
    setGuardandoNombre(true)
    const scope = perfilActual()
    try {
      const token = await scope.token()
      if (!scope.current()) return
      const { error, data } = await supabase.from('usuarios').update({ nombre: nombreLimpio }).eq('id', user.id)
        .select('id').maybeSingle().setHeader('Authorization', `Bearer ${token}`)
      if (error || !data) throw error ?? new Error('Perfil no disponible')
      if (!scope.current()) return
      setNombreGuardado(nombreLimpio)
      setNombre(nombreLimpio)
      setNombreAviso('Nombre actualizado.')
      showSuccess('Perfil actualizado')
    } catch {
      if (scope.current()) setNombreError('No se pudo guardar el nombre. Intentá de nuevo.')
    } finally {
      setGuardandoNombre(false)
    }
  }

  const guardarClave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (guardandoClave) return
    setClaveError('')
    setClaveAviso('')
    if (temporary ? !isValidReplacementPassword(nueva) : nueva.length < 8) {
      setClaveError(`La contraseña debe tener al menos ${minimoClave} caracteres.`); return
    }
    if (nueva !== confirmacion) { setClaveError('Las contraseñas no coinciden.'); return }
    setGuardandoClave(true)
    const scope = perfilActual()
    try {
      const token = await scope.token()
      if (!scope.current()) return
      if (temporary) await accessAction({ action: 'password', password: nueva, confirmation: confirmacion })
      else await cambiarClavePerfil(token, nueva)
      if (!scope.current()) return
      if (temporary) await refreshAccess()
      if (!scope.current()) return
      setNueva('')
      setConfirmacion('')
      setClaveVisible(false)
      setClaveGenerada(false)
      setClaveCopiada(false)
      setClaveAviso('Contraseña actualizada correctamente.')
      showSuccess('Contraseña actualizada')
    } catch (cause) {
      if (scope.current()) setClaveError(cause instanceof Error ? cause.message : 'No se pudo cambiar la contraseña. Intentá de nuevo.')
    } finally {
      setGuardandoClave(false)
    }
  }

  // Las preferencias se guardan al instante, como en el menú anterior; si el RPC
  // falla, se restauran los valores vigentes en el perfil.
  const guardarPrefs = async (habilitadas: boolean, sonido: boolean, sonidoFinal = sonidoSeleccionado) => {
    if (guardandoPrefs) return
    setGuardandoPrefs(true)
    const scope = perfilActual()
    setPrefs({ notif_habilitadas: habilitadas, notif_sonido: sonido, notif_sonido_id: sonidoFinal })
    try {
      const token = await scope.token()
      if (!scope.current()) return
      const { error } = await supabase.rpc('actualizar_mis_preferencias_notificacion', {
        p_habilitadas: habilitadas, p_sonido: sonido, p_sonido_id: sonidoFinal,
      }).setHeader('Authorization', `Bearer ${token}`)
      if (error) throw error
      if (scope.current()) showSuccess('Preferencias actualizadas')
    } catch (error) {
      if (!scope.current()) return
      showError(error, 'No se pudieron guardar las preferencias')
      setPrefs({ notif_habilitadas: user.notif_habilitadas, notif_sonido: user.notif_sonido, notif_sonido_id: user.notif_sonido_id })
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const tabPanels = {
    detalles: <form id="mi-perfil-panel-detalles" role="tabpanel" aria-labelledby="mi-perfil-tab-detalles"
        hidden={tab !== 'detalles'} onSubmit={guardarNombre} className="mx-auto max-w-4xl">
      <div data-mi-perfil-detalles className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:gap-7">
        <aside className="flex w-full shrink-0 flex-col items-center gap-2.5 rounded-card border border-qms-border bg-qms-panel-soft p-4 sm:w-56">
          <div className="relative">
            <FotoPerfil url={fotoUrl} hasPhoto={!!user.avatarUrl} initials={inicial} size={96}
              className="size-24 border-4 border-qms-surface bg-qms-primary/15 text-3xl font-semibold text-qms-primary shadow-sm" />
            <span aria-hidden="true" className="absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border border-qms-border bg-qms-surface text-qms-primary shadow-sm">
              <Camera className="size-4" />
            </span>
          </div>
          <input ref={inputFoto} type="file" accept={AVATAR_ACCEPT} hidden onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            if (!AVATAR_ACCEPT.split(',').includes(file.type) || file.size === 0 || file.size > AVATAR_UPLOAD_BYTES) {
              showError(new Error('Elegí una foto JPG, PNG o WebP de hasta 2 MB.'), 'No se pudo subir la foto')
              return
            }
            setBorradorFoto({ archivo: file, url: URL.createObjectURL(file) })
          }} />
          <div className="flex flex-wrap justify-center gap-1">
            <Button variant="link" size="sm" loading={fotoOperation.operation === 'subir'} disabled={!!fotoOperation.operation}
              onClick={() => inputFoto.current?.click()}>{user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}</Button>
            {user.avatarUrl && <Button variant="ghost" size="sm" loading={fotoOperation.operation === 'quitar'} disabled={!!fotoOperation.operation}
              onClick={() => { void cambiarFoto(null) }}>Quitar</Button>}
          </div>
          <p className="text-center text-sm font-semibold text-qms-dark">{getRoleLabel(user.rol)}</p>
          <p className="text-center text-[12px] leading-5 text-qms-muted">
            <span className="block whitespace-nowrap">JPG o WebP · Máx. 2 MB</span>
            <span className="block whitespace-nowrap">Tamaño sugerido: 320 × 320 px</span>
          </p>
        </aside>
        <div className="min-w-0 flex-1 space-y-4 rounded-card border border-qms-border bg-qms-surface p-4 shadow sm:p-5">
          {nombreError && <p role="alert" className="rounded-card border border-qms-danger/30 bg-qms-danger/5 p-2.5 text-sm text-qms-danger">{nombreError}</p>}
          {nombreAviso && <p role="status" className="rounded-card border border-qms-success/30 bg-qms-success/5 p-2.5 text-sm text-qms-success">{nombreAviso}</p>}
          <Field id="mi-perfil-nombre" label="Nombre completo">
            <Input id="mi-perfil-nombre" name="nombre" required maxLength={120} value={nombre}
              onChange={event => { setNombre(event.target.value); setNombreError(''); setNombreAviso('') }} className="shadow border-qms-muted/40" />
          </Field>
          <Field id="mi-perfil-correo" label="Correo electrónico" hint="El correo de acceso lo administra Calidad desde Usuarios.">
            <Input id="mi-perfil-correo" name="email" type="email" value={user.email} readOnly disabled className="shadow border-qms-muted/40" />
          </Field>
        </div>
      </div>
    </form>,
    seguridad: <div role="tabpanel" id="mi-perfil-panel-seguridad" aria-labelledby="mi-perfil-tab-seguridad"
        hidden={tab !== 'seguridad'} className="mx-auto max-w-4xl">
      <form onSubmit={guardarClave} className="rounded-card border border-qms-border bg-qms-surface p-4 shadow sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-qms-dark">Contraseña</h3>
            <p className="mt-1 text-sm leading-relaxed text-qms-muted">{temporary
               ? `Usás una contraseña temporal. Reemplazala por otra de al menos ${REPLACEMENT_PASSWORD_MIN} caracteres, escrita por vos o generada automáticamente.`
               : 'Definí una nueva contraseña de al menos 8 caracteres para tu cuenta.'}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" aria-pressed={claveVisible}
            onClick={() => setClaveVisible(valor => !valor)}>
            {claveVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
            {claveVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>
        {temporary && <p role="status" className="mt-4 rounded-card border border-qms-border bg-qms-background px-3 py-2 text-sm text-qms-dark">Podés utilizar ECA-QMS durante el plazo de gracia. Cambiá tu contraseña antes del vencimiento indicado en el aviso de acceso.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={guardandoClave} onClick={generarClave}>
            <WandSparkles aria-hidden="true" className="size-4" />{claveGenerada ? 'Generar otra contraseña' : 'Generar contraseña segura'}
          </Button>
          {claveGenerada && <Button type="button" size="sm" variant="secondary" disabled={guardandoClave || !nueva} onClick={() => void copiarClave()}>
            {claveCopiada ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{claveCopiada ? 'Copiada' : 'Copiar contraseña'}
          </Button>}
        </div>
        {claveGenerada && <p className="mt-2 text-xs leading-relaxed text-qms-muted">La contraseña generada ya completó ambos campos. Mostrala con el ojo y guardala en tu gestor antes de actualizarla.</p>}
        {claveError && <p role="alert" className="mt-4 rounded-card border border-qms-danger/30 bg-qms-danger/5 p-2.5 text-sm text-qms-danger">{claveError}</p>}
        {claveAviso && <p role="status" className="mt-4 rounded-card border border-qms-success/30 bg-qms-success/5 p-2.5 text-sm text-qms-success">{claveAviso}</p>}
        <div className="mt-4 space-y-4">
          <Field id="mi-perfil-clave" label="Nueva contraseña">
            <Input id="mi-perfil-clave" name="nueva-contrasena" autoComplete="new-password" minLength={minimoClave}
              type={claveVisible ? 'text' : 'password'} value={nueva} placeholder={`Mínimo ${minimoClave} caracteres`}
              onChange={event => { setNueva(event.target.value); setClaveGenerada(false); setClaveCopiada(false); setClaveError(''); setClaveAviso('') }} className="shadow border-qms-muted/40" />
          </Field>
          <Field id="mi-perfil-clave-confirmacion" label="Confirmar contraseña">
            <Input id="mi-perfil-clave-confirmacion" name="confirmar-contrasena" autoComplete="new-password" minLength={minimoClave}
              type={claveVisible ? 'text' : 'password'} value={confirmacion} placeholder="Repetí la nueva contraseña"
              onChange={event => { setConfirmacion(event.target.value); setClaveCopiada(false); setClaveError(''); setClaveAviso('') }} className="shadow border-qms-muted/40" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" size="sm" loading={guardandoClave} disabled={!nueva || !confirmacion || !claveCompleta}>Actualizar contraseña</Button>
        </div>
      </form>
    </div>,
    notificaciones: <div role="tabpanel" id="mi-perfil-panel-notificaciones" aria-labelledby="mi-perfil-tab-notificaciones"
        hidden={tab !== 'notificaciones'} className="mx-auto max-w-4xl">
      <section className="rounded-card border border-qms-border bg-qms-surface p-4 shadow sm:p-5">
        <h3 className="text-base font-semibold text-qms-dark">Notificaciones</h3>
        <p className="mt-1 text-sm leading-relaxed text-qms-muted">Elegí qué avisos internos querés recibir. Los cambios se guardan al instante.</p>
        <div className="mt-3 divide-y divide-qms-border">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-qms-dark">Notificaciones activas</p>
              <p className="mt-0.5 text-xs text-qms-muted">Avisos de recepción, plazos y asignaciones de tus expedientes.</p>
            </div>
            <Switch aria-label="Habilitar notificaciones" checked={notifHabilitadas} disabled={guardandoPrefs}
              onChange={valor => { void guardarPrefs(valor, notifSonido) }} />
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-qms-dark">Sonido de alerta</p>
              <p className="mt-0.5 text-xs text-qms-muted">Reproduce un tono cuando llega un aviso nuevo.</p>
            </div>
            <Switch aria-label="Habilitar sonido de notificaciones" checked={notifSonido} disabled={guardandoPrefs || !notifHabilitadas}
              onChange={valor => { void guardarPrefs(notifHabilitadas, valor) }} />
          </div>
          {notifHabilitadas && notifSonido && <div className="py-3">
            <label htmlFor="mi-perfil-sonido" className="mb-1.5 block text-sm font-medium text-qms-dark">Tono de notificación</label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select id="mi-perfil-sonido" aria-label="Tono de notificación" value={sonidoSeleccionado} disabled={guardandoPrefs}
                onChange={event => { void guardarPrefs(notifHabilitadas, notifSonido, event.target.value) }} wrapperClassName="min-w-0 basis-48 flex-1">
                {SONIDOS_NOTIFICACION.map(sound => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
              </Select>
              <Button type="button" size="sm" variant="secondary" disabled={guardandoPrefs}
                onClick={() => { void playNotificationSound(sonidoSeleccionado) }} title="Probar sonido">
                <Play aria-hidden="true" className="size-4" />Probar
              </Button>
            </div>
          </div>}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-qms-muted">El navegador puede requerir una interacción previa con la página para reproducir el sonido.</p>
      </section>
    </div>,
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title="Mi perfil" size="mail" variant="document" height="fill" headerTone="profile"
      footer={<div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-qms-muted">Los cambios del nombre se aplican al guardar.</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{tab === 'detalles' ? 'Cancelar' : 'Cerrar'}</Button>
          {tab === 'detalles' && <Button type="submit" form="mi-perfil-panel-detalles" size="sm" loading={guardandoNombre} disabled={!nombreCambio}>Guardar cambios</Button>}
        </div>
      </div>}>
      <div className="flex min-h-0 flex-1 flex-col bg-qms-surface">
        <Tabs id="mi-perfil" items={TABS} value={tab} onChange={valor => setTab(valor as TabId)} label="Mi perfil" />
        <div data-mi-perfil-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-5 sm:px-7 sm:py-6">
          {tabPanels.detalles}
          {tabPanels.seguridad}
          {tabPanels.notificaciones}
        </div>
      </div>
    </Modal>
    {borradorFoto && <LogoRecorteModal key={borradorFoto.url} borrador={borradorFoto}
      guardando={fotoOperation.operation === 'subir'} nombre="foto de perfil" outputWidth={320} maxEncodedBytes={AVATAR_UPLOAD_BYTES}
      onCerrar={() => setBorradorFoto(null)} onGuardar={blob => {
        void cambiarFoto(new File([blob], 'foto.webp', { type: blob.type }))
      }} />}
    </>
  )
}

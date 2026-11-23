'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, Mail, UserPlus, UserRound, Info, ShieldAlert, Pencil, Check, Camera } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { gestionarAccesoUsuario, mutateUsuario } from '@/lib/services/usuariosService'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import { getUserError } from '@/lib/errors/userError'
import { getRoleLabel, ROLES_GESTIONABLES } from '@/lib/constants/roles'
import type { Usuario } from '@/lib/queries/useUsuarios'
import type { UserMutationResult } from '@/lib/types/access'
import UsuarioAccesoInicial from '@/components/usuarios/UsuarioAccesoInicial'
import UsuarioSeguridadAcceso from '@/components/usuarios/UsuarioSeguridadAcceso'

interface UsuarioFormModalProps {
  open: boolean
  mode: 'crear' | 'editar'
  usuario?: Usuario | null
  esAuto?: boolean
  onClose: () => void
  onSuccess: (result: UserMutationResult) => void | Promise<void>
  onDelete: (usuario: Usuario) => Promise<void>
  initialTab?: 'detalles' | 'seguridad'
  onPasswordSaved?: () => void | Promise<void>
}

export default function UsuarioFormModal({ open, mode, usuario, esAuto, onClose, onSuccess, onDelete, initialTab = 'detalles', onPasswordSaved }: UsuarioFormModalProps) {
  const esEditar = mode === 'editar' && !!usuario
  const lock = useOperationLock<'guardar' | 'eliminar' | 'acceso'>()
  const saving = lock.operation === 'guardar'
  const eliminando = lock.operation === 'eliminar'
  const busy = lock.operation !== null
  const [error, setError] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [tab, setTab] = useState<'detalles' | 'seguridad'>(initialTab)
  const [createdResult, setCreatedResult] = useState<Omit<UserMutationResult, 'tempPassword'> | null>(null)
  const [requireMfa, setRequireMfa] = useState(false)
  const [sendByEmail, setSendByEmail] = useState(true)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [createdEmail, setCreatedEmail] = useState('')
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [confirmResend, setConfirmResend] = useState(false)
  const creation = useRef<{ payload: string; id: string } | null>(null)
  const filaConfirmacionEliminar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirmarEliminar) return
    // La confirmación agrega una fila dentro del área con scroll propio. Sin este
    // ajuste queda bajo el pie fijo y sus botones aparecen recortados, sin acceso.
    const frame = requestAnimationFrame(() => {
      filaConfirmacionEliminar.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [confirmarEliminar])

  function reportarError(cause: unknown, fallback: string) {
    setError(getUserError(cause, fallback).message)
    showError(cause, fallback)
  }

  function cerrar() {
    if (lock.isLocked()) return
    setConfirmarEliminar(false)
    setError(null)
    setTab('detalles')
    setCreatedResult(null)
    setRequireMfa(false)
    setSendByEmail(true)
    setTempPassword(null)
    setCreatedEmail('')
    setPasswordCopied(false)
    setConfirmResend(false)
    creation.current = null
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lock.isLocked() || createdResult) return
    const form = new FormData(e.currentTarget as HTMLFormElement)
    const nombre = String(form.get('nombre') ?? '').trim()
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const rol = form.get('rol')
    const estado = form.get('estado')
    if (!nombre || !email || (!esAuto && (!rol || !estado))) {
      reportarError(null, 'Completa los campos obligatorios del usuario')
      return
    }
    if (!lock.begin('guardar')) return
    setError(null)
    const fallback = esEditar ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario'
    try {
      let result: UserMutationResult = {}
      // FormData omite controles disabled: la propia cuenta no envía rol/estado nulos.
      const perfil = { nombre, email, ...(!esAuto ? { rol, estado } : {}) }
      if (esEditar && usuario) {
        await mutateUsuario('PATCH', { id: usuario.id, ...perfil }, fallback)
      } else {
        const payload = JSON.stringify({ ...perfil, invite: false, requireMfa, sendByEmail })
        if (!creation.current || creation.current.payload !== payload) creation.current = { payload, id: crypto.randomUUID() }
        const created = await mutateUsuario('POST', { ...perfil, access: { id: creation.current.id, invite: false, requireMfa, sendByEmail } }, fallback)
        const { tempPassword: issuedPassword, ...safeResult } = created
        if (!sendByEmail && typeof issuedPassword === 'string') setTempPassword(issuedPassword)
        setCreatedEmail(email)
        setPasswordCopied(false)
        result = safeResult
        setCreatedResult(safeResult)
      }
      if (esEditar) showSuccess('Usuario actualizado')
      try {
        await onSuccess(result)
      } catch {
        // La escritura terminó; repetirla porque falló el refresco duplicaría el alta.
        if (esEditar) onClose()
        showError(null, 'El usuario se guardó, pero no se pudo actualizar el listado')
      }
    } catch (cause) {
      reportarError(cause, fallback)
    } finally {
      lock.finish()
    }
  }

  async function handleEliminar() {
    if (!usuario || esAuto || !lock.begin('eliminar')) return
    setError(null)
    try {
      await onDelete(usuario)
    } catch (cause) {
      reportarError(cause, 'No se pudo eliminar el usuario')
    } finally {
      lock.finish()
    }
  }

  async function reenviarCreada() {
    if (!createdResult?.userId || !lock.begin('acceso')) return
    setConfirmResend(false)
    setError(null)
    try {
      const delivery = await gestionarAccesoUsuario(createdResult.userId, 'resend')
      setCreatedResult({ ...createdResult, accessDelivery: delivery.accessDelivery, accessDeliveryError: delivery.accessDeliveryError })
      try { await onPasswordSaved?.() } catch { showError(null, 'El listado de usuarios no se pudo actualizar') }
    } catch (cause) { reportarError(cause, 'No se pudo reenviar el acceso') }
    finally { lock.finish() }
  }



  async function copiarPassword() {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setPasswordCopied(true)
    } catch { setError('No se pudo copiar la contraseña. Podés seleccionarla y copiarla manualmente.') }
  }

  function abrirSeguridad() {
    setTab('seguridad')
  }

  const formId = 'usuario-formulario'
  const nombreVisible = usuario?.nombre?.trim() || 'Usuario'
  const inicial = nombreVisible.charAt(0).toUpperCase()
  const mensajePendiente = 'Función pendiente de integración'

  // Los campos reutilizados preservan los nombres del contrato POST/PATCH.
  // Las políticas de acceso se aplican exclusivamente al alta nueva.
  const camposPerfil = <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="usuario-nombre" label="Nombre completo">
        <Input id="usuario-nombre" name="nombre" required defaultValue={usuario?.nombre}
          disabled={busy || !!createdResult} placeholder="Ej: María Fernández" className="shadow border-qms-muted/40" />
      </Field>
      <Field id="usuario-email" label="Correo electrónico">
        <Input id="usuario-email" name="email" type="email" required defaultValue={usuario?.email}
          disabled={busy || !!createdResult} placeholder="usuario@eca.or.cr" className="shadow border-qms-muted/40" />
      </Field>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="usuario-rol" label={esEditar ? 'Rol' : 'Rol del sistema'}>
        <Select id="usuario-rol" name="rol" required defaultValue={usuario?.rol || ''}
          disabled={esAuto || busy || !!createdResult} className="w-full shadow border-qms-muted/40">
          <option value="" disabled>Seleccionar rol</option>
          {ROLES_GESTIONABLES.map(rol => <option key={rol} value={rol}>{getRoleLabel(rol)}</option>)}
        </Select>
      </Field>
      <Field id="usuario-estado" label={esEditar ? 'Estado' : 'Estado inicial'}>
        <Select id="usuario-estado" name="estado" required defaultValue={usuario?.estado || 'activo'}
          disabled={esAuto || busy || !!createdResult} className="w-full shadow border-qms-muted/40">
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </Field>
    </div>
  </>

  const eliminarCuenta = usuario && !esAuto && <section data-user-danger className="overflow-hidden rounded-card border border-qms-danger/25 bg-qms-surface">
    <div className="flex flex-wrap items-start justify-between gap-4 bg-qms-danger/5 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-qms-danger">Zona de peligro</h3>
        <p className="mt-2 text-sm font-medium text-qms-dark">Eliminar cuenta permanentemente</p>
        <p className="mt-1 text-xs leading-relaxed text-qms-muted">Elimina el acceso y retira la cuenta del directorio. Los expedientes y su historial se conservan.</p>
      </div>
      {!confirmarEliminar && <Button type="button" size="sm" variant="danger" disabled={busy}
        onClick={() => setConfirmarEliminar(true)}>
        <Trash2 aria-hidden="true" className="size-4" />Eliminar
      </Button>}
    </div>
    {confirmarEliminar && <div ref={filaConfirmacionEliminar} className="flex scroll-mb-4 flex-wrap items-center justify-between gap-3 border-t border-qms-danger/20 px-4 py-3 sm:px-5">
      <span className="text-xs font-medium text-qms-danger">¿Eliminar a {usuario.nombre}?</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy}
          onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
        <Button type="button" size="sm" variant="danger" disabled={busy}
          loading={eliminando} onClick={handleEliminar}>
          <Trash2 aria-hidden="true" className="size-4" />Eliminar
        </Button>
      </div>
    </div>}
  </section>

  return (
    <Modal open={open} onClose={cerrar} title={esEditar ? 'Gestionar usuario' : 'Crear nuevo usuario'}
      size="mail" variant="document" height="fill"
      headerLeading={!esEditar ? <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-card bg-qms-primary-soft text-qms-primary">
        <UserPlus className="size-5" />
      </span> : undefined}>
      <div data-user-editor data-user-mode={esEditar ? 'editar' : 'crear'} className="flex min-h-0 flex-1 flex-col bg-qms-surface">
        {!esEditar && !createdResult && <div className="shrink-0 border-b border-qms-border px-5 py-3 text-sm text-qms-muted sm:px-8">
          Ingresá los datos y configurá el acceso inicial al sistema.
        </div>}
        {esEditar && <div role="tablist" aria-label="Administrar usuario"
          className="flex shrink-0 gap-4 overflow-x-auto border-b border-qms-border bg-qms-surface px-5 sm:px-7">
          <button type="button" role="tab" id="usuario-tab-detalles" aria-selected={tab === 'detalles'}
            aria-controls={formId} disabled={busy} onClick={() => setTab('detalles')}
            className={'shrink-0 border-b-2 px-2 py-3 text-sm font-medium transition-colors ' + (tab === 'detalles' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark')}>
            Detalles del perfil
          </button>
          <button type="button" role="tab" id="usuario-tab-seguridad" aria-selected={tab === 'seguridad'}
            aria-controls="usuario-panel-seguridad" disabled={busy} onClick={abrirSeguridad}
            className={'shrink-0 border-b-2 px-2 py-3 text-sm font-medium transition-colors ' + (tab === 'seguridad' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark')}>
            Seguridad y acceso
          </button>
        </div>}
        <div data-user-editor-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-5 sm:px-7 sm:py-6">
          {createdResult ? <section className="rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5" aria-live="polite">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-success"><Check aria-hidden="true" className="size-4" />Usuario creado</h3>
            {error && <p role="alert" className="mt-3 text-sm text-qms-danger">{error}</p>}
            {tempPassword ? <>
              <p className="mt-3 text-sm text-qms-muted">No se solicitó el envío por correo. Esta contraseña temporal se mostrará solo aquí, hasta cerrar el formulario.</p>
              <div className="mt-3 space-y-3 rounded-card border border-qms-border bg-qms-background p-4">
                <div><p className="text-xs text-qms-muted">Usuario</p><p className="select-text break-all text-sm font-medium text-qms-dark">{createdEmail}</p></div>
                <div><p className="text-xs text-qms-muted">Contraseña temporal · 3 días hábiles</p>
                  <div className="mt-2 rounded-md border border-qms-border border-l-4 border-l-qms-primary bg-qms-surface px-3 py-3">
                    <code className="block select-all break-all font-mono text-base font-semibold leading-relaxed text-qms-dark">{tempPassword}</code>
                  </div></div>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copiarPassword()}>
                  {passwordCopied ? 'Contraseña copiada' : 'Copiar contraseña'}
                </Button>
              </div>
              <p className="mt-3 text-xs text-qms-muted">Entregala por un canal seguro. El usuario deberá cambiarla en el primer ingreso.</p>
            </> : createdResult.accessDelivery === 'sent' ? <p role="status" className="mt-3 text-sm text-qms-success">
              El servicio confirmó el envío del correo de acceso. La contraseña temporal vence en 3 días hábiles.
              {requireMfa && ' Al ingresar deberá configurar 2FA.'}
              <span className="mt-1 block text-xs text-qms-muted">La confirmación del emisor no garantiza recepción en la bandeja de entrada.</span>
            </p> : <>
              <p role="alert" className="mt-3 text-sm text-qms-danger">
                {createdResult.accessDelivery === 'uncertain'
                  ? 'El usuario fue creado, pero el servicio no confirmó si entregó el correo. No se reenviará automáticamente.'
                  : 'El usuario fue creado, pero no se confirmó el envío del correo con la contraseña temporal.'}
              </p>
              {createdResult.accessDeliveryError && <p className="mt-2 text-xs text-qms-muted">{createdResult.accessDeliveryError}</p>}
              {!confirmResend ? <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={busy}
                onClick={() => setConfirmResend(true)}>
                <Mail aria-hidden="true" className="size-4" />Generar nueva contraseña y reenviar
              </Button> : <div className="mt-3 rounded-card border border-qms-border p-3">
                <p className="text-xs leading-relaxed text-qms-muted">
                  Se invalidará la contraseña temporal anterior. Si el primer correo llegó, dejará de funcionar. ¿Confirmás el reenvío?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmResend(false)}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={busy} loading={lock.operation === 'acceso'}
                    onClick={() => void reenviarCreada()}>Confirmar reenvío</Button>
                </div>
              </div>}
            </>}
          </section> : <form key={usuario?.id ?? 'nuevo'} id={formId} role={esEditar ? 'tabpanel' : undefined}
            aria-label={esEditar ? 'Detalles del perfil' : 'Crear nuevo usuario'}
            aria-labelledby={esEditar ? 'usuario-tab-detalles' : undefined}
            hidden={esEditar && tab !== 'detalles'} onSubmit={handleSubmit}
            className={esEditar ? 'mx-auto max-w-4xl' : 'mx-auto max-w-4xl space-y-7'}>
            {error && <div role="alert" className="mb-4 rounded-card border border-qms-danger/30 bg-qms-danger/5 p-3 text-sm text-qms-danger">{error}</div>}
            {esEditar ? <div data-user-profile-layout className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:gap-7">
              <aside className="flex w-full shrink-0 flex-col items-center gap-3 rounded-card border border-qms-border bg-qms-panel-soft p-4 sm:w-44">
                <div className="relative">
                  <div aria-label={'Avatar de ' + nombreVisible} className="flex size-24 items-center justify-center rounded-full border-4 border-qms-surface bg-qms-primary/15 text-3xl font-semibold text-qms-primary shadow-sm">
                    {inicial}
                  </div>
                  <span aria-hidden="true" className="absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border border-qms-border bg-qms-surface text-qms-primary shadow-sm">
                    <Camera className="size-4" />
                  </span>
                </div>
                {/* La carga real de avatar aún no tiene API/almacenamiento: la acción
                    queda visible pero deshabilitada, sin simular una subida. */}
                <button type="button" disabled title={mensajePendiente}
                  aria-label={'Subir foto de perfil. ' + mensajePendiente}
                  className="text-center text-xs font-medium text-qms-primary disabled:cursor-not-allowed">
                  Subir foto de perfil
                </button>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-qms-muted">Rol actual</p>
                  <p className="mt-1 text-sm font-semibold text-qms-dark">{usuario?.rol ? getRoleLabel(usuario.rol) : 'Sin asignar'}</p>
                </div>
              </aside>
              <div className="min-w-0 flex-1 space-y-4 rounded-card border border-qms-border bg-qms-surface p-4 shadow sm:p-5">
                {camposPerfil}
                {esAuto && <div className="flex items-start gap-2 rounded-card border border-qms-primary/20 bg-qms-primary-soft p-3">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-primary" />
                  <p className="text-xs leading-relaxed text-qms-primary">Por seguridad, no se permite cambiar el propio rol ni desactivar la propia cuenta.</p>
                </div>}
              </div>
            </div> : <>
              <section data-user-create-profile>
                <h3 className="mb-4 text-sm font-semibold text-qms-dark">Información del usuario</h3>
                <div className="flex min-w-0 flex-col gap-6 rounded-card border border-qms-border bg-qms-surface p-4 sm:flex-row sm:p-6">
                  <aside className="flex w-full shrink-0 flex-col items-center gap-2 sm:w-28">
                    <div className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-qms-border bg-qms-hover-bg text-qms-muted">
                      <UserRound aria-hidden="true" className="size-10" />
                    </div>
                    <p className="text-center text-xs leading-relaxed text-qms-muted">La foto se podrá asignar más adelante.</p>
                  </aside>
                  <div className="min-w-0 flex-1 space-y-5">{camposPerfil}</div>
                </div>
              </section>
              <UsuarioAccesoInicial sendByEmail={sendByEmail} requireMfa={requireMfa} disabled={busy} onEmail={setSendByEmail} onMfa={setRequireMfa} />
            </>}
          </form>}
          {esEditar && <div id="usuario-panel-seguridad" role="tabpanel" aria-label="Seguridad y acceso"
            aria-labelledby="usuario-tab-seguridad" hidden={tab !== 'seguridad'}
            className="mx-auto max-w-4xl space-y-5">
            <UsuarioSeguridadAcceso usuario={usuario!} esAuto={esAuto} active={open} disabled={busy} onBegin={() => lock.begin('acceso')} onEnd={lock.finish} onChanged={() => onPasswordSaved?.()} />
            {eliminarCuenta}
            {esAuto && <div className="flex items-start gap-2 rounded-card border border-qms-primary/20 bg-qms-primary-soft p-3">
              <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-qms-primary" />
              <p className="text-xs text-qms-primary">Por seguridad, no podés eliminar ni desactivar tu propia cuenta.</p>
            </div>}
          </div>}
        </div>
        <div data-user-editor-footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-7">
          {!createdResult && <p className="flex items-center gap-1.5 text-xs text-qms-muted">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            {esEditar ? (tab === 'seguridad' ? 'Las acciones de seguridad requieren confirmación.' : 'Los cambios se aplican al guardar.') : 'La configuración se aplica únicamente al crear este usuario.'}
          </p>}
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {!createdResult && <Button type="button" variant="secondary" disabled={busy} onClick={cerrar}>{esEditar && tab === 'seguridad' ? 'Cerrar' : 'Cancelar'}</Button>}
            {createdResult ? <Button type="button" onClick={cerrar} disabled={busy}><Check aria-hidden="true" className="size-4" />Listo</Button> : (!esEditar || tab === 'detalles') && <Button type="submit" form={formId} loading={saving} disabled={busy}>
              {!saving && (esEditar ? <Pencil aria-hidden="true" className="size-4" /> : <UserPlus aria-hidden="true" className="size-4" />)}
              {esEditar ? 'Guardar cambios' : 'Crear usuario'}
            </Button>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

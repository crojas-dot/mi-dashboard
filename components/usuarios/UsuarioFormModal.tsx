'use client'

import { useState } from 'react'
import { Trash2, KeyRound, Mail, UserPlus, UserRound, Info, ShieldAlert, ShieldCheck, MonitorSmartphone, RefreshCw, Pencil, LockKeyhole } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { mutateUsuario } from '@/lib/services/usuariosService'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import { getUserError } from '@/lib/errors/userError'
import { getRoleLabel, ROLES_GESTIONABLES } from '@/lib/constants/roles'
import type { Usuario } from '@/lib/queries/useUsuarios'

interface UsuarioFormModalProps {
  open: boolean
  mode: 'crear' | 'editar'
  usuario?: Usuario | null
  esAuto?: boolean
  onClose: () => void
  onSuccess: (result: { tempPassword?: string }) => void | Promise<void>
  onDelete: (usuario: Usuario) => Promise<void>
  onResetPassword?: (usuario: Usuario) => void
}

export default function UsuarioFormModal({ open, mode, usuario, esAuto, onClose, onSuccess, onDelete, onResetPassword }: UsuarioFormModalProps) {
  const esEditar = mode === 'editar' && !!usuario
  const lock = useOperationLock<'guardar' | 'eliminar'>()
  const saving = lock.operation === 'guardar'
  const eliminando = lock.operation === 'eliminar'
  const busy = lock.operation !== null
  const [error, setError] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [tab, setTab] = useState<'detalles' | 'seguridad'>('detalles')

  function reportarError(cause: unknown, fallback: string) {
    setError(getUserError(cause, fallback).message)
    showError(cause, fallback)
  }

  function cerrar() {
    if (lock.isLocked()) return
    setConfirmarEliminar(false)
    setError(null)
    setTab('detalles')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lock.isLocked()) return
    const form = new FormData(e.currentTarget as HTMLFormElement)
    const nombre = String(form.get('nombre') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
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
      let result: { tempPassword?: string } = {}
      // FormData omite controles disabled: la propia cuenta no envía rol/estado nulos.
      const perfil = { nombre, email, ...(!esAuto ? { rol, estado } : {}) }
      if (esEditar && usuario) {
        await mutateUsuario('PATCH', { id: usuario.id, ...perfil }, fallback)
      } else {
        const password = generatePassword(16)
        await mutateUsuario('POST', { ...perfil, password }, fallback)
        result = { tempPassword: password }
      }
      showSuccess(esEditar ? 'Usuario actualizado' : 'Usuario creado')
      try {
        await onSuccess(result)
      } catch {
        // La escritura terminó; repetirla porque falló el refresco duplicaría el alta.
        onClose()
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


  const formId = 'usuario-formulario'
  const nombreVisible = usuario?.nombre?.trim() || 'Usuario'
  const inicial = nombreVisible.charAt(0).toUpperCase()
  const mensajePendiente = 'Función pendiente de integración'

  // Los campos reutilizados preservan los nombres del contrato POST/PATCH.
  // No se activa ningún método de acceso adicional sin backend real.
  const camposPerfil = <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="usuario-nombre" label="Nombre completo">
        <Input id="usuario-nombre" name="nombre" required defaultValue={usuario?.nombre}
          disabled={busy} placeholder="Ej: María Fernández" />
      </Field>
      <Field id="usuario-email" label="Correo electrónico">
        <Input id="usuario-email" name="email" type="email" required defaultValue={usuario?.email}
          disabled={busy} placeholder="usuario@eca.or.cr" />
      </Field>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="usuario-rol" label={esEditar ? 'Rol' : 'Rol del sistema'}>
        <Select id="usuario-rol" name="rol" required defaultValue={usuario?.rol || ''}
          disabled={esAuto || busy} className="w-full">
          <option value="" disabled>Seleccionar rol</option>
          {ROLES_GESTIONABLES.map(rol => <option key={rol} value={rol}>{getRoleLabel(rol)}</option>)}
        </Select>
      </Field>
      <Field id="usuario-estado" label={esEditar ? 'Estado' : 'Estado inicial'}>
        <Select id="usuario-estado" name="estado" required defaultValue={usuario?.estado || 'activo'}
          disabled={esAuto || busy} className="w-full">
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
        <p className="mt-1 text-xs leading-relaxed text-qms-muted">A diferencia de desactivar, elimina la cuenta. Esta acción requiere confirmación.</p>
      </div>
      {!confirmarEliminar && <Button type="button" size="sm" variant="danger" disabled={busy}
        onClick={() => setConfirmarEliminar(true)}>
        <Trash2 aria-hidden="true" className="size-4" />Eliminar
      </Button>}
    </div>
    {confirmarEliminar && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-qms-danger/20 px-4 py-3 sm:px-5">
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
      size={esEditar ? 'lg' : 'mail'} variant="document" height="fill"
      headerLeading={!esEditar ? <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-card bg-qms-primary-soft text-qms-primary">
        <UserPlus className="size-5" />
      </span> : undefined}>
      <div data-user-editor data-user-mode={esEditar ? 'editar' : 'crear'} className="flex min-h-0 flex-1 flex-col bg-qms-surface">
        {!esEditar && <div className="shrink-0 border-b border-qms-border px-5 py-3 text-sm text-qms-muted sm:px-8">
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
            aria-controls="usuario-panel-seguridad" disabled={busy} onClick={() => setTab('seguridad')}
            className={'shrink-0 border-b-2 px-2 py-3 text-sm font-medium transition-colors ' + (tab === 'seguridad' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark')}>
            Seguridad y acceso
          </button>
        </div>}
        <div data-user-editor-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg/40 px-4 py-5 sm:px-7 sm:py-6">
          <form key={usuario?.id ?? 'nuevo'} id={formId} role={esEditar ? 'tabpanel' : undefined}
            aria-label={esEditar ? 'Detalles del perfil' : 'Crear nuevo usuario'}
            aria-labelledby={esEditar ? 'usuario-tab-detalles' : undefined}
            hidden={esEditar && tab !== 'detalles'} onSubmit={handleSubmit}
            className={esEditar ? 'mx-auto max-w-3xl' : 'mx-auto max-w-4xl space-y-7'}>
            {error && <div role="alert" className="mb-4 rounded-card border border-qms-danger/30 bg-qms-danger/5 p-3 text-sm text-qms-danger">{error}</div>}
            {esEditar ? <div data-user-profile-layout className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:gap-7">
              <aside className="flex w-full shrink-0 flex-col items-center gap-3 pt-2 sm:w-36">
                <div aria-label={'Avatar de ' + nombreVisible} className="flex size-24 items-center justify-center rounded-full border-4 border-qms-surface bg-qms-primary-soft text-3xl font-semibold text-qms-primary shadow-sm">
                  {inicial}
                </div>
                <p className="text-center text-xs text-qms-muted">Foto de perfil · próximamente</p>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-qms-muted">Rol actual</p>
                  <p className="mt-1 text-sm font-semibold text-qms-dark">{usuario?.rol ? getRoleLabel(usuario.rol) : 'Sin asignar'}</p>
                </div>
              </aside>
              <div className="min-w-0 flex-1 space-y-5 rounded-card border border-qms-border bg-qms-surface p-4 sm:p-6">
                {camposPerfil}
                {esAuto && <div className="flex items-start gap-2 rounded-card border border-qms-primary/20 bg-qms-primary-soft p-3">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-primary" />
                  <p className="text-xs leading-relaxed text-qms-primary">Por seguridad, no se permite cambiar el propio rol ni desactivar la propia cuenta.</p>
                </div>}
              </div>
            </div> : <>
              <section data-user-create-profile>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-qms-dark">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-qms-primary-soft text-xs font-semibold text-qms-primary">1</span>
                  Información del usuario
                </h3>
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
              <section data-user-create-access>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-qms-dark">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-qms-primary-soft text-xs font-semibold text-qms-primary">2</span>
                  Configuración de acceso
                </h3>
                <div className="overflow-hidden rounded-card border border-qms-border bg-qms-surface">
                  <div className="flex items-start gap-3 border-b border-qms-border bg-qms-primary-soft/40 p-4 sm:p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary">
                      <Mail aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-qms-dark">Enviar invitación por correo</h4>
                        <span className="shrink-0 rounded-button border border-qms-border bg-qms-surface px-2 py-1 text-[11px] font-medium text-qms-muted">Pendiente</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-qms-muted">La invitación con enlace de activación se integrará en una próxima etapa. Todavía no se envía automáticamente.</p>
                    </div>
                  </div>
                  <div className="border-b border-qms-border p-4 sm:p-5">
                    <h4 className="text-sm font-semibold text-qms-dark">Acceso con contraseña temporal</h4>
                    <p className="mt-1 text-xs leading-relaxed text-qms-muted">Al crear la cuenta se genera una contraseña segura. El sistema la mostrará una sola vez para que se la entregués al usuario.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-button border border-qms-primary/20 bg-qms-primary-soft px-3 py-2 text-xs font-medium text-qms-primary">
                        <KeyRound aria-hidden="true" className="size-4" /> Generación automática habilitada
                      </span>
                      <Button type="button" size="sm" variant="secondary" disabled title={mensajePendiente}>
                        <Pencil aria-hidden="true" className="size-4" />Definir manualmente · próximamente
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-qms-dark">
                        <ShieldCheck aria-hidden="true" className="size-4 text-qms-muted" />
                        Requerir verificación en dos pasos (2FA)
                        <span className="rounded-button border border-qms-border bg-qms-hover-bg px-2 py-0.5 text-[11px] font-medium text-qms-muted">Pendiente</span>
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-qms-muted">La configuración de factores todavía no está disponible en el sistema.</p>
                    </div>
                  </div>
                </div>
              </section>
            </>}
          </form>
          {esEditar && <div id="usuario-panel-seguridad" role="tabpanel" aria-label="Seguridad y acceso"
            aria-labelledby="usuario-tab-seguridad" hidden={tab !== 'seguridad'}
            className="mx-auto max-w-3xl space-y-4">
            <section className="overflow-hidden rounded-card border border-qms-border bg-qms-surface">
              <div className="border-b border-qms-border p-4 sm:p-5">
                <h3 className="text-base font-semibold text-qms-dark">Contraseña</h3>
                <p className="mt-1 text-xs leading-relaxed text-qms-muted">Administrá la contraseña de {nombreVisible} con los métodos disponibles.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="primary" disabled={busy || !onResetPassword}
                    onClick={() => { if (usuario && onResetPassword) { setTab('detalles'); onResetPassword(usuario) } }}>
                    <RefreshCw aria-hidden="true" className="size-4" />Restablecer contraseña segura
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled title={mensajePendiente}>
                    <Pencil aria-hidden="true" className="size-4" />Definir contraseña manual
                  </Button>
                </div>
                <p className="mt-3 text-xs text-qms-muted">El restablecimiento abre el modal actual para generar, copiar y guardar la nueva contraseña.</p>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-qms-dark">
                    <LockKeyhole aria-hidden="true" className="size-4 text-qms-muted" />Forzar cambio de contraseña al iniciar
                  </p>
                  <p className="mt-1 text-xs text-qms-muted">Disponible cuando se integre el flujo de cambio obligatorio.</p>
                </div>
                <span className="rounded-button border border-qms-border bg-qms-hover-bg px-2 py-1 text-xs text-qms-muted">Pendiente</span>
              </div>
            </section>
            <section className="rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-dark">
                    <Mail aria-hidden="true" className="size-4 text-qms-muted" />Recuperación por correo
                  </h3>
                  <p className="mt-1 text-xs text-qms-muted">El envío de enlaces de recuperación todavía no está implementado.</p>
                </div>
                <Button type="button" size="sm" variant="secondary" disabled title={mensajePendiente}>Enviar enlace</Button>
              </div>
            </section>
            <section className="rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-qms-dark">
                    <ShieldCheck aria-hidden="true" className="size-4 text-qms-muted" />Verificación en dos pasos (2FA)
                    <span className="rounded-button border border-qms-border bg-qms-hover-bg px-2 py-0.5 text-[11px] font-medium text-qms-muted">Pendiente</span>
                  </h3>
                  <p className="mt-1 text-xs text-qms-muted">Sin factores disponibles por API. No se muestran métodos ni estados inventados.</p>
                </div>
              </div>
            </section>
            <section className="rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-qms-dark">
                    <MonitorSmartphone aria-hidden="true" className="size-4 text-qms-muted" />Sesiones activas
                  </h3>
                  <p className="mt-1 text-xs text-qms-muted">El cierre remoto de sesiones estará disponible en una próxima etapa.</p>
                </div>
                <Button type="button" size="sm" variant="secondary" disabled title={mensajePendiente}>Cerrar sesiones</Button>
              </div>
            </section>
            {eliminarCuenta}
            {esAuto && <div className="flex items-start gap-2 rounded-card border border-qms-primary/20 bg-qms-primary-soft p-3">
              <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-qms-primary" />
              <p className="text-xs text-qms-primary">Por seguridad, no podés eliminar ni desactivar tu propia cuenta.</p>
            </div>}
          </div>}
        </div>
        <div data-user-editor-footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-7">
          <p className="flex items-center gap-1.5 text-xs text-qms-muted">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            {esEditar ? (tab === 'seguridad' ? 'Las funciones pendientes todavía no modifican el acceso.' : 'Los cambios se aplican al guardar.') : 'La contraseña temporal se muestra al terminar el alta.'}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={cerrar}>{esEditar && tab === 'seguridad' ? 'Cerrar' : 'Cancelar'}</Button>
            {(!esEditar || tab === 'detalles') && <Button type="submit" form={formId} loading={saving} disabled={busy}>
              {!saving && (esEditar ? <Pencil aria-hidden="true" className="size-4" /> : <UserPlus aria-hidden="true" className="size-4" />)}
              {esEditar ? 'Guardar cambios' : 'Crear usuario'}
            </Button>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

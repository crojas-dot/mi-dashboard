'use client'

import { useState } from 'react'
import { Trash2, KeyRound, Mail, ShieldCheck } from 'lucide-react'
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

  return (
    <Modal open={open} onClose={cerrar} title={esEditar ? 'Gestionar usuario' : 'Nuevo usuario'} size="mail" variant="document" height="fill">
      <div data-user-editor className="flex min-h-0 flex-1 flex-col bg-qms-surface">
        <div role="tablist" aria-label="Administrar usuario" className="flex shrink-0 gap-1 overflow-x-auto border-b border-qms-border px-4 sm:px-7">
          <button type="button" role="tab" id="usuario-tab-detalles" aria-selected={tab === 'detalles'} aria-controls={formId}
            onClick={() => setTab('detalles')}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === 'detalles' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark'}`}>Detalles del perfil</button>
          <button type="button" role="tab" id="usuario-tab-seguridad" aria-selected={tab === 'seguridad'} aria-controls="usuario-panel-seguridad"
            onClick={() => setTab('seguridad')}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === 'seguridad' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark'}`}>Seguridad y acceso</button>
        </div>
        <div data-user-editor-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6">
          <form key={usuario?.id ?? 'nuevo'} id={formId} role="tabpanel" aria-label="Detalles del perfil" aria-labelledby="usuario-tab-detalles"
            hidden={tab !== 'detalles'} onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
            {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
            <p className="text-sm text-qms-muted">Datos de identificación y permisos generales de la cuenta.</p>
            <Field id="usuario-nombre" label="Nombre completo">
              <Input id="usuario-nombre" name="nombre" required defaultValue={usuario?.nombre} disabled={busy} placeholder="Ej: María Fernández" />
            </Field>
            <Field id="usuario-email" label="Correo electrónico">
              <Input id="usuario-email" name="email" type="email" required defaultValue={usuario?.email} disabled={busy} placeholder="usuario@eca.or.cr" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="usuario-rol" label="Rol">
                <Select id="usuario-rol" name="rol" required defaultValue={usuario?.rol || ''} disabled={esAuto || busy} className="w-full">
                  <option value="" disabled>Seleccionar rol</option>
                  {ROLES_GESTIONABLES.map(rol => <option key={rol} value={rol}>{getRoleLabel(rol)}</option>)}
                </Select>
              </Field>
              <Field id="usuario-estado" label="Estado">
                <Select id="usuario-estado" name="estado" required defaultValue={usuario?.estado || 'activo'} disabled={esAuto || busy} className="w-full">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </Select>
              </Field>
            </div>
            {esAuto && <p className="text-xs text-qms-muted">Por seguridad, no se permite cambiar el propio rol ni desactivar la propia cuenta.</p>}
            {esEditar && usuario && !esAuto && <div className="rounded-card border border-qms-border bg-qms-hover-bg/50 p-4">
              <h3 className="text-sm font-semibold text-qms-dark">Eliminar usuario</h3>
              <p className="mt-1 text-xs leading-relaxed text-qms-muted">Esta operación es distinta de desactivar la cuenta. Confirmá solo cuando sea necesario eliminarla.</p>
              {confirmarEliminar ? <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-qms-danger">¿Eliminar a {usuario.nombre}?</span>
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
                <Button type="button" size="sm" variant="danger" onClick={handleEliminar} loading={eliminando} disabled={busy}>
                  <Trash2 className="size-3.5" />Eliminar
                </Button>
              </div> : <Button type="button" size="sm" variant="danger" className="mt-3" disabled={busy} onClick={() => setConfirmarEliminar(true)}>
                <Trash2 className="size-3.5" />Eliminar
              </Button>}
            </div>}
          </form>
          <div id="usuario-panel-seguridad" role="tabpanel" aria-label="Seguridad y acceso" aria-labelledby="usuario-tab-seguridad" hidden={tab !== 'seguridad'} className="mx-auto max-w-2xl space-y-4">
            <p className="text-sm text-qms-muted">{esEditar ? `Opciones de seguridad de ${usuario?.nombre}.` : 'Opciones de seguridad previstas para la nueva cuenta. Primero debés crearla desde Detalles del perfil.'}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-qms-border bg-qms-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><KeyRound aria-hidden="true" className="size-4 text-qms-primary" />Contraseña temporal</p>
                <p className="mt-1 text-xs leading-relaxed text-qms-muted">{esEditar ? 'Generar y guardar una nueva contraseña segura para esta cuenta.' : 'Se genera una contraseña segura automáticamente al crear el usuario y se muestra una sola vez.'}</p>
              </div>
              {esEditar && <Button size="sm" variant="secondary" disabled={busy || !onResetPassword}
                onClick={() => { if (usuario && onResetPassword) { setTab('detalles'); onResetPassword(usuario) } }}>Restablecer</Button>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-qms-border bg-qms-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><KeyRound aria-hidden="true" className="size-4 text-qms-muted" />Contraseña manual</p>
                <p className="mt-1 text-xs leading-relaxed text-qms-muted">Definir una contraseña personalizada desde esta pantalla.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => showError(null, 'Aún no se puede establecer una contraseña manual desde esta pantalla.')}>Definir</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-qms-border bg-qms-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><Mail aria-hidden="true" className="size-4 text-qms-muted" />Recuperación por correo</p>
                <p className="mt-1 text-xs leading-relaxed text-qms-muted">Enviar un enlace de restablecimiento al correo de la cuenta.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => showError(null, 'Aún no se pueden enviar correos de recuperación desde Usuarios.')}>Enviar enlace</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-qms-border bg-qms-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-qms-dark"><ShieldCheck aria-hidden="true" className="size-4 text-qms-muted" />Autenticación 2FA</p>
                <p className="mt-1 text-xs leading-relaxed text-qms-muted">La administración de factores de autenticación todavía no está disponible aquí.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => showError(null, 'La función 2FA aún no está disponible en Usuarios.')}>Configurar</Button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-7">
          <Button type="button" variant="secondary" disabled={busy} onClick={cerrar}>{tab === 'seguridad' ? 'Cerrar' : 'Cancelar'}</Button>
          {tab === 'detalles' ? <Button type="submit" form={formId} loading={saving} disabled={busy}>{esEditar ? 'Guardar cambios' : 'Crear usuario'}</Button>
            : !esEditar && <Button type="button" onClick={() => setTab('detalles')}>Ir al perfil</Button>}
        </div>
      </div>
    </Modal>
  )
}

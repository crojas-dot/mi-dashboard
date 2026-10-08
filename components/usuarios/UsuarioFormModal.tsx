'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
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
}

export default function UsuarioFormModal({ open, mode, usuario, esAuto, onClose, onSuccess, onDelete }: UsuarioFormModalProps) {
  const esEditar = mode === 'editar' && !!usuario
  const lock = useOperationLock<'guardar' | 'eliminar'>()
  const saving = lock.operation === 'guardar'
  const eliminando = lock.operation === 'eliminar'
  const busy = lock.operation !== null
  const [error, setError] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  function reportarError(cause: unknown, fallback: string) {
    setError(getUserError(cause, fallback).message)
    showError(cause, fallback)
  }

  function cerrar() {
    if (lock.isLocked()) return
    setConfirmarEliminar(false)
    setError(null)
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

  return (
    <Modal open={open} onClose={cerrar} title={esEditar ? 'Editar usuario' : 'Nuevo usuario'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        <Field id="usuario-nombre" label="Nombre completo" className="[&_label]:dark:text-gray-300">
          <Input id="usuario-nombre" name="nombre" required defaultValue={usuario?.nombre} disabled={busy} className="dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Ej: María Fernández" />
        </Field>
        <Field id="usuario-email" label="Correo electrónico" className="[&_label]:dark:text-gray-300">
          <Input id="usuario-email" name="email" type="email" required defaultValue={usuario?.email} disabled={busy} className="dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="usuario@eca-qms.com" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="usuario-rol" label="Rol" className="[&_label]:dark:text-gray-300">
            <Select id="usuario-rol" name="rol" required defaultValue={usuario?.rol || ''} disabled={esAuto || busy} className="w-full">
              <option value="" disabled>Seleccionar rol</option>
              {ROLES_GESTIONABLES.map(rol => <option key={rol} value={rol}>{getRoleLabel(rol)}</option>)}
            </Select>
          </Field>
          <Field id="usuario-estado" label="Estado" className="[&_label]:dark:text-gray-300">
            <Select id="usuario-estado" name="estado" required defaultValue={usuario?.estado || 'activo'} disabled={esAuto || busy} className="w-full">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-qms-border pt-4">
          <div>
            {esEditar && usuario && !esAuto && (
              confirmarEliminar ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-qms-danger">¿Eliminar a {usuario.nombre}?</span>
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
                  <Button type="button" size="sm" variant="danger" onClick={handleEliminar} loading={eliminando} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => setConfirmarEliminar(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={cerrar}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={busy}>{esEditar ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

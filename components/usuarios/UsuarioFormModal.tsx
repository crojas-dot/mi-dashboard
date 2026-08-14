'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { apiFetch, type Usuario } from '@/lib/queries/useUsuarios'

interface UsuarioFormModalProps {
  open: boolean
  mode: 'crear' | 'editar'
  usuario?: Usuario | null
  esAuto?: boolean
  onClose: () => void
  onSuccess: (result: { tempPassword?: string }) => void
  onDelete: (usuario: Usuario) => Promise<void>
}

const inputClass =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'

export default function UsuarioFormModal({ open, mode, usuario, esAuto, onClose, onSuccess, onDelete }: UsuarioFormModalProps) {
  const esEditar = mode === 'editar' && !!usuario
  const [saving, setSaving] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  function cerrar() {
    setConfirmarEliminar(false)
    setEliminando(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget as HTMLFormElement)
    const nombre = (form.get('nombre') as string).trim()
    const email = (form.get('email') as string).trim()
    const rol = form.get('rol') as string
    const estado = form.get('estado') as string

    if (esEditar && usuario) {
      const res = await apiFetch('/api/usuarios', {
        method: 'PATCH',
        body: JSON.stringify({ id: usuario.id, nombre, email, rol, estado }),
      })
      if (res.ok) {
        showSuccess('Usuario actualizado')
        onSuccess({})
        return
      }
      const data = await res.json().catch(() => null)
      showError(null, data?.error || 'No se pudo actualizar el usuario')
      setSaving(false)
      return
    }

    const password = generatePassword(16)
    const res = await apiFetch('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, rol, estado, password }),
    })
    if (res.ok) {
      showSuccess('Usuario creado')
      onSuccess({ tempPassword: password })
      return
    }
    const data = await res.json().catch(() => null)
    showError(null, data?.error || 'No se pudo crear el usuario')
    setSaving(false)
  }

  async function handleEliminar() {
    if (!usuario) return
    setEliminando(true)
    await onDelete(usuario)
    setEliminando(false)
  }

  return (
    <Modal open={open} onClose={cerrar} title={esEditar ? 'Editar usuario' : 'Nuevo usuario'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Nombre completo</label>
          <input name="nombre" required defaultValue={usuario?.nombre} className={inputClass} placeholder="Ej: María Fernández" />
        </div>
        <div>
          <label className={labelClass}>Correo electrónico</label>
          <input name="email" type="email" required defaultValue={usuario?.email} className={inputClass} placeholder="usuario@eca-qms.com" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Rol</label>
            <Select name="rol" required defaultValue={usuario?.rol || ''} disabled={esAuto} className="w-full">
              <option value="" disabled>Seleccionar rol</option>
              <option value="admin">Administrador</option>
              <option value="calidad">Calidad</option>
              <option value="colaborador">Colaborador</option>
            </Select>
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <Select name="estado" required defaultValue={usuario?.estado || 'activo'} disabled={esAuto} className="w-full">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-4" style={{ borderColor: '#e9ecef' }}>
          <div>
            {esEditar && usuario && !esAuto && (
              confirmarEliminar ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#dc3545' }}>¿Eliminar a {usuario.nombre}?</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
                  <Button type="button" size="sm" variant="danger" onClick={handleEliminar} loading={eliminando}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="danger" onClick={() => setConfirmarEliminar(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" loading={saving}>{esEditar ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

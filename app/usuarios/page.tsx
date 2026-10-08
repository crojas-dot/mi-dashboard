'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, RotateCcw, KeyRound } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useUsuarios, usuariosKey, type Usuario } from '@/lib/queries/useUsuarios'
import { useAuthStore } from '@/lib/store/auth-store'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { mutateUsuario } from '@/lib/services/usuariosService'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import UsuarioFormModal from '@/components/usuarios/UsuarioFormModal'
import PasswordModal from '@/components/usuarios/PasswordModal'
import ResetPasswordModal from '@/components/usuarios/ResetPasswordModal'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import {
  getDirectoryRoleAvatarClass,
  getDirectoryRoleVariant,
  getRoleLabel,
  ROLES_GESTIONABLES,
} from '@/lib/constants/roles'

export default function UsuariosPage() {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const router = useRouter()
  const queryClient = useQueryClient()
  const invalidateUsuarios = () => queryClient.invalidateQueries({ queryKey: usuariosKey }, { throwOnError: true })

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'crear' | 'editar'>('crear')
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null)
  const [resetSel, setResetSel] = useState<Usuario | null>(null)
  const [pwModal, setPwModal] = useState<{ password: string; title: string; subtitle?: string } | null>(null)
  const [confirmar, setConfirmar] = useState<{ usuario: Usuario; accion: 'desactivar' | 'activar' } | null>(null)
  const cambioEstado = useOperationLock<'estado'>()
  const confirmando = cambioEstado.operation !== null

  useEffect(() => {
    if (!initialized) return
    if (user?.rol !== 'admin') router.replace('/')
  }, [user, initialized, router])

  const { data: usuarios = [], isLoading, isError } = useUsuarios({
    search: deferredSearch,
    rol: filtroRol || undefined,
    estado: filtroEstado || undefined,
  }, initialized && user?.rol === 'admin')

  if (!initialized || user?.rol !== 'admin') {
    return <LoadingSkeleton label="Verificando acceso…" />
  }

  const esAuto = (u: Usuario) => u.id === user?.id

  function abrirCrear() {
    setFormMode('crear')
    setUsuarioSel(null)
    setFormOpen(true)
  }

  function abrirEditar(u: Usuario) {
    setFormMode('editar')
    setUsuarioSel(u)
    setFormOpen(true)
  }

  async function handleFormSuccess(result: { tempPassword?: string }) {
    setFormOpen(false)
    setUsuarioSel(null)
    if (result.tempPassword) {
      setPwModal({
        password: result.tempPassword,
        title: formMode === 'crear' ? 'Usuario creado' : 'Contraseña actualizada',
        subtitle: formMode === 'crear' ? 'Contraseña temporal del nuevo usuario' : 'Nueva contraseña para el usuario',
      })
    }
    await invalidateUsuarios()
  }

  async function eliminarUsuario(u: Usuario) {
    if (esAuto(u)) throw new Error('No puedes eliminar tu propia cuenta')
    await mutateUsuario('DELETE', { id: u.id }, 'No se pudo eliminar el usuario')
    showSuccess('Usuario eliminado')
    setFormOpen(false)
    setUsuarioSel(null)
    try { await invalidateUsuarios() }
    catch { showError(null, 'El usuario se eliminó, pero no se pudo actualizar el listado') }
  }

  async function confirmarCambioEstado() {
    if (!confirmar || !cambioEstado.begin('estado')) return
    const { usuario: u, accion } = confirmar
    try {
      await mutateUsuario('PATCH', { id: u.id, estado: accion === 'desactivar' ? 'inactivo' : 'activo' }, 'No se pudo cambiar el estado')
      showSuccess(accion === 'desactivar' ? 'Usuario desactivado' : 'Usuario activado')
      setConfirmar(null)
      try { await invalidateUsuarios() }
      catch { showError(null, 'El estado se guardó, pero no se pudo actualizar el listado') }
    } catch (error) {
      showError(error, 'No se pudo cambiar el estado')
    } finally {
      cambioEstado.finish()
    }
  }

  function pedirDesactivar(u: Usuario) {
    if (esAuto(u)) {
      showError(null, 'No puedes desactivar tu propia cuenta')
      return
    }
    setConfirmar({ usuario: u, accion: 'desactivar' })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" description="Gestión de usuarios y accesos del sistema">
        <Button onClick={abrirCrear}><Plus className="h-4 w-4" /> Nuevo usuario</Button>
      </PageHeader>

      <div role="group" aria-label="Buscar y filtrar usuarios" className="grid grid-cols-2 items-center gap-3 lg:grid-cols-[minmax(180px,1fr)_180px_160px]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por nombre o email..."
            aria-label="Buscar por nombre o email"
            className="ui-field h-11 pl-9 pr-3 lg:h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select aria-label="Rol" className="h-11 lg:h-10" value={filtroRol} onChange={(e) => { setFiltroRol(e.target.value); setSearch('') }}>
          <option value="">Todos los roles</option>
          {ROLES_GESTIONABLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </Select>
        <Select aria-label="Estado del usuario" className="h-11 lg:h-10" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setSearch('') }}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton label="Cargando usuarios…" />
      ) : isError ? (
        <EmptyState message="No tienes permisos para ver usuarios" />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Usuario</TableHeaderCell>
              <TableHeaderCell>Rol</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Último acceso</TableHeaderCell>
              <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {usuarios.length === 0 ? (
              <EmptyState message="No hay usuarios registrados" />
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getDirectoryRoleAvatarClass(u.rol)}`}
                      >
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="m-0 text-sm font-medium text-gray-900 dark:text-white">
                          {u.nombre}
                          {esAuto(u) && <span className="ml-2 text-xs font-normal text-qms-muted">(tú)</span>}
                        </p>
                        <p className="m-0 text-xs text-qms-muted">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={getDirectoryRoleVariant(u.rol)}>{getRoleLabel(u.rol)}</Badge></TableCell>
                  <TableCell><Badge variant={u.estado === 'activo' ? 'green' : 'red'}>{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-qms-muted">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin accesos registrados'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" className="w-[88px] justify-center" onClick={() => abrirEditar(u)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="w-[88px] justify-center" onClick={() => setResetSel(u)}>
                        <KeyRound className="h-3.5 w-3.5" /> Resetear
                      </Button>
                      {u.estado === 'activo' ? (
                        <Button size="sm" variant="ghost" className="w-[88px] justify-center" onClick={() => pedirDesactivar(u)} disabled={esAuto(u)}>
                          <Trash2 className="h-3.5 w-3.5" /> Desactivar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="w-[88px] justify-center" onClick={() => setConfirmar({ usuario: u, accion: 'activar' })}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </tbody>
        </Table>
      )}

      <UsuarioFormModal
        open={formOpen}
        mode={formMode}
        usuario={usuarioSel}
        esAuto={usuarioSel ? esAuto(usuarioSel) : false}
        onClose={() => { setFormOpen(false); setUsuarioSel(null) }}
        onSuccess={handleFormSuccess}
        onDelete={eliminarUsuario}
      />

      {pwModal && (
        <PasswordModal
          open={!!pwModal}
          password={pwModal.password}
          title={pwModal.title}
          subtitle={pwModal.subtitle}
          onClose={() => setPwModal(null)}
        />
      )}

      <ResetPasswordModal
        open={!!resetSel}
        usuario={resetSel}
        onClose={() => setResetSel(null)}
        onSaved={() => invalidateUsuarios()}
      />

      <ConfirmDialog
        open={!!confirmar}
        title={confirmar?.accion === 'desactivar' ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          confirmar
            ? confirmar.accion === 'desactivar'
              ? `¿Seguro que deseas desactivar a "${confirmar.usuario.nombre}"? Perderá el acceso al sistema y no podrá iniciar sesión.`
              : `¿Deseas restaurar el acceso de "${confirmar.usuario.nombre}"?`
            : null
        }
        confirmLabel={confirmar?.accion === 'desactivar' ? 'Desactivar' : 'Activar'}
        danger={confirmar?.accion === 'desactivar'}
        loading={confirmando}
        onConfirm={confirmarCambioEstado}
        onCancel={() => { if (!cambioEstado.isLocked()) setConfirmar(null) }}
      />
    </div>
  )
}

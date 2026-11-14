'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, RotateCcw, KeyRound } from 'lucide-react'
import RolesAccesos from './components/RolesAccesos'
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
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(10)

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

  const total = usuarios.length
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaVisible = Math.min(pagina, totalPaginas)
  const inicio = (paginaVisible - 1) * porPagina
  const usuariosVisibles = usuarios.slice(inicio, inicio + porPagina)
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

  function restablecerDesdePerfil(u: Usuario) {
    setFormOpen(false)
    setUsuarioSel(null)
    setResetSel(u)
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-col gap-4 overflow-hidden pb-2">
      <PageHeader compact={false} title="Gestión de accesos" description="Administrá las cuentas y los permisos por módulo del sistema.">
        <Button onClick={abrirCrear}><Plus className="h-4 w-4" /> Nuevo usuario</Button>
      </PageHeader>

      <div role="tablist" aria-label="Gestión de accesos" className="flex gap-1 border-b border-qms-border">
        <button type="button" role="tab" id="usuarios-tab-usuarios" aria-controls="usuarios-panel-usuarios"
          aria-selected={tab === 'usuarios'} onClick={() => setTab('usuarios')}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === 'usuarios' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark'}`}>Usuarios</button>
        <button type="button" role="tab" id="usuarios-tab-roles" aria-controls="usuarios-panel-roles"
          aria-selected={tab === 'roles'} onClick={() => setTab('roles')}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === 'roles' ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark'}`}>Roles y permisos</button>
      </div>

      <section id="usuarios-panel-usuarios" role="tabpanel" aria-labelledby="usuarios-tab-usuarios" hidden={tab !== 'usuarios'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div role="group" aria-label="Buscar y filtrar usuarios" className="grid shrink-0 grid-cols-2 items-center gap-3 rounded-card border border-qms-border bg-qms-surface p-3 sm:p-4 lg:grid-cols-[minmax(220px,400px)_minmax(190px,1fr)_minmax(210px,1fr)]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por nombre o email..."
            aria-label="Buscar por nombre o email"
            className="ui-field h-11 pl-9 pr-3 lg:h-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagina(1) }}
          />
        </div>
        <Select aria-label="Rol" className="h-11 lg:h-10" value={filtroRol} onChange={(e) => { setFiltroRol(e.target.value); setPagina(1) }}>
          <option value="">Todos los roles</option>
          {ROLES_GESTIONABLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </Select>
        <Select aria-label="Estado del usuario" className="h-11 lg:h-10" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1) }}>
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
        <div className="min-h-0 flex-1">
        <div className="hidden h-full min-h-0 lg:block">
        <Table containerClassName="h-full min-h-0 overflow-auto overscroll-contain">
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
              usuariosVisibles.map((u) => (
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
                  <TableCell><Badge variant="neutral">{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-qms-muted">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin accesos registrados'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" className="w-[88px] justify-center" onClick={() => abrirEditar(u)}>
                        <Pencil className="h-3.5 w-3.5" /> Gestionar
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
        </div>
        <div data-users-mobile-list className="h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain lg:hidden">
          {usuariosVisibles.length === 0 ? <div className="ui-panel p-5 text-sm text-qms-muted">No hay usuarios registrados.</div> : usuariosVisibles.map(u => (
            <article key={u.id} className="ui-panel space-y-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getDirectoryRoleAvatarClass(u.rol)}`}>{u.nombre.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-qms-dark">{u.nombre}{esAuto(u) && ' (tú)'}</p><p className="truncate text-xs text-qms-muted">{u.email}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant={getDirectoryRoleVariant(u.rol)}>{getRoleLabel(u.rol)}</Badge><Badge variant="neutral">{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge></div>
              <p className="text-xs text-qms-muted">Último acceso: {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin accesos registrados'}</p>
              <div className="grid grid-cols-3 gap-2 border-t border-qms-border pt-3">
                <Button size="sm" variant="secondary" className="min-w-0 justify-center" onClick={() => abrirEditar(u)}>Gestionar</Button>
                <Button size="sm" variant="secondary" className="min-w-0 justify-center" onClick={() => setResetSel(u)}>Resetear</Button>
                {u.estado === 'activo' ? <Button size="sm" variant="secondary" className="min-w-0 justify-center" disabled={esAuto(u)} onClick={() => pedirDesactivar(u)}>Desactivar</Button>
                  : <Button size="sm" variant="secondary" className="min-w-0 justify-center" onClick={() => setConfirmar({ usuario: u, accion: 'activar' })}>Restaurar</Button>}
              </div>
            </article>
          ))}
        </div>
        </div>
      )}
      {!isLoading && !isError && <div data-users-pagination className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-card border border-qms-border bg-qms-surface px-4 py-3 text-sm">
        <span className="text-qms-muted" aria-live="polite">
          {total ? `Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, total)} de ${total} usuarios` : '0 usuarios'}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor="usuarios-por-pagina" className="text-xs text-qms-muted">Por página</label>
          <Select id="usuarios-por-pagina" aria-label="Usuarios por página" wrapperClassName="w-[86px]" className="h-9 text-xs"
            value={porPagina} onChange={e => { setPorPagina(Number(e.target.value)); setPagina(1) }}>
            <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
          </Select>
          <span className="mx-2 whitespace-nowrap text-xs text-qms-muted">Página {paginaVisible} de {totalPaginas}</span>
          <Button size="sm" variant="secondary" disabled={paginaVisible <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</Button>
          <Button size="sm" variant="secondary" disabled={paginaVisible >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Siguiente</Button>
        </div>
      </div>}
      </section>
      {tab === 'roles' && <section id="usuarios-panel-roles" role="tabpanel" aria-labelledby="usuarios-tab-roles" className="min-h-0 flex-1 overflow-hidden">
        <RolesAccesos active />
      </section>}

      <UsuarioFormModal
        onResetPassword={restablecerDesdePerfil}
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

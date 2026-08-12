'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { Users, UserCheck, UserX, ShieldCheck, Plus, Search, Loader2, Pencil, Trash2, RotateCcw, KeyRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useUsuarios, usuariosKey, apiFetch, type Usuario } from '@/lib/queries/useUsuarios'
import { useAuthStore } from '@/lib/store/auth-store'
import { showError, showSuccess } from '@/lib/services/errorToast'
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

const roles = ['admin', 'calidad'] as const

interface StatCard {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bg: string
}

export default function UsuariosPage() {
  const { user, initialized } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const invalidateUsuarios = () => queryClient.invalidateQueries({ queryKey: usuariosKey })

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
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!initialized) return
    if (user?.rol !== 'admin') router.replace('/')
  }, [user, initialized, router])

  const { data: usuarios = [], isLoading, isError } = useUsuarios({
    search: deferredSearch,
    rol: filtroRol || undefined,
    estado: filtroEstado || undefined,
  })

  if (!initialized || user?.rol !== 'admin') {
    return <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  const esAuto = (u: Usuario) => u.id === user?.id

  const total = usuarios.length
  const activos = usuarios.filter((u) => u.estado === 'activo').length
  const inactivos = total - activos
  const admins = usuarios.filter((u) => u.rol === 'admin').length

  const stats: StatCard[] = [
    { label: 'Usuarios', value: total, icon: <Users className="h-5 w-5" />, color: '#0d6efd', bg: '#e7f1ff' },
    { label: 'Activos', value: activos, icon: <UserCheck className="h-5 w-5" />, color: '#198754', bg: '#e8f5ee' },
    { label: 'Inactivos', value: inactivos, icon: <UserX className="h-5 w-5" />, color: '#dc3545', bg: '#fdeeee' },
    { label: 'Administradores', value: admins, icon: <ShieldCheck className="h-5 w-5" />, color: '#6f42c1', bg: '#f1ecf9' },
  ]

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

  function handleFormSuccess(result: { tempPassword?: string }) {
    setFormOpen(false)
    setUsuarioSel(null)
    invalidateUsuarios()
    if (result.tempPassword) {
      setPwModal({
        password: result.tempPassword,
        title: formMode === 'crear' ? 'Usuario creado' : 'Contraseña actualizada',
        subtitle: formMode === 'crear' ? 'Contraseña temporal del nuevo usuario' : 'Nueva contraseña para el usuario',
      })
    }
  }

  async function eliminarUsuario(u: Usuario) {
    if (esAuto(u)) {
      showError(null, 'No puedes eliminar tu propia cuenta')
      return
    }
    const res = await apiFetch('/api/usuarios', {
      method: 'DELETE',
      body: JSON.stringify({ id: u.id }),
    })
    if (res.ok) {
      showSuccess('Usuario eliminado')
      setFormOpen(false)
      setUsuarioSel(null)
      invalidateUsuarios()
    } else {
      const data = await res.json().catch(() => null)
      showError(null, data?.error || 'No se pudo eliminar el usuario')
    }
  }

  async function confirmarCambioEstado() {
    if (!confirmar) return
    const { usuario: u, accion } = confirmar
    setConfirmando(true)
    const res = await apiFetch('/api/usuarios', {
      method: 'PATCH',
      body: JSON.stringify({ id: u.id, estado: accion === 'desactivar' ? 'inactivo' : 'activo' }),
    })
    setConfirmando(false)
    if (res.ok) {
      showSuccess(accion === 'desactivar' ? 'Usuario desactivado' : 'Usuario activado')
      setConfirmar(null)
      invalidateUsuarios()
    } else {
      const data = await res.json().catch(() => null)
      showError(null, data?.error || 'No se pudo cambiar el estado')
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border p-4" style={{ borderColor: '#dee2e6', backgroundColor: '#fff' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <p className="m-0 text-2xl font-bold leading-none" style={{ color: '#212529' }}>{s.value}</p>
              <p className="m-0 mt-1 text-xs" style={{ color: '#6c757d' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por nombre o email..."
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            style={{ height: '38px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filtroRol} onChange={(e) => { setFiltroRol(e.target.value); setSearch('') }}>
          <option value="">Todos los roles</option>
          {roles.map((r) => <option key={r} value={r}>{r === 'admin' ? 'Administrador' : 'Calidad'}</option>)}
        </Select>
        <Select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setSearch('') }}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: u.rol === 'admin' ? '#0d6efd' : '#6c757d' }}
                      >
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="m-0 text-sm font-medium text-gray-900 dark:text-white">
                          {u.nombre}
                          {esAuto(u) && <span className="ml-2 text-xs font-normal" style={{ color: '#6c757d' }}>(tú)</span>}
                        </p>
                        <p className="m-0 text-xs" style={{ color: '#6c757d' }}>{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={u.rol === 'admin' ? 'blue' : 'gray'}>{u.rol === 'admin' ? 'Administrador' : 'Calidad'}</Badge></TableCell>
                  <TableCell><Badge variant={u.estado === 'activo' ? 'green' : 'red'}>{u.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="text-sm whitespace-nowrap" style={{ color: '#6c757d' }}>
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
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
        onCancel={() => { setConfirmar(null); setConfirmando(false) }}
      />
    </div>
  )
}

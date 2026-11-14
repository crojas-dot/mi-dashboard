'use client'

import { useRef } from 'react'
import { CircleHelp } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ErrorState from '@/components/ui/ErrorState'
import Select from '@/components/ui/Select'
import { usePermisos, useActualizarPermiso } from '@/lib/queries/usePermisos'
import { MODULOS_PERMISOS } from '@/lib/constants/modulos'
import { ROLES_GESTIONABLES, getRoleLabel } from '@/lib/constants/roles'
import type { Permiso } from '@/lib/permisos'
import { showError, showSuccess } from '@/lib/services/errorToast'

type Nivel = 'sin' | 'lectura' | 'edicion' | 'administracion'
const roles = ROLES_GESTIONABLES.map(key => ({ key, label: getRoleLabel(key) }))
const niveles: Record<Nivel, Pick<Permiso, 'leer' | 'escribir'>> = {
  sin: { leer: false, escribir: false },
  lectura: { leer: true, escribir: false },
  edicion: { leer: true, escribir: true },
  administracion: { leer: true, escribir: true },
}
const operacion = MODULOS_PERMISOS.filter(item => !['usuarios', 'configuracion'].includes(item.key))
const administracion = MODULOS_PERMISOS.filter(item => ['usuarios', 'configuracion'].includes(item.key))

/** Presentación por niveles de los permisos actuales (leer/escribir). No crea permisos nuevos. */
export default function RolesAccesos({ active = true }: { active?: boolean }) {
  const { data: permisos = [], isLoading, error, refetch } = usePermisos(active)
  const actualizar = useActualizarPermiso()
  const guardando = useRef(false)

  if (isLoading) return <LoadingSkeleton label="Cargando permisos…" />
  if (error) return <ErrorState message="No se pudieron cargar los permisos." onRetry={() => void refetch()} />

  const permisoDe = (rol: string, modulo: string): Permiso =>
    permisos.find(item => item.rol === rol && item.modulo === modulo)
    ?? { rol, modulo, leer: false, escribir: false }

  const bloqueado = (rol: string, modulo: string) =>
    modulo === 'configuracion' || (modulo === 'usuarios' && rol !== 'admin')

  const nivelDe = (rol: string, modulo: string): Nivel => {
    if (modulo === 'configuracion') return rol === 'admin' ? 'administracion' : 'sin'
    if (modulo === 'usuarios' && rol !== 'admin') return 'sin'
    const permiso = permisoDe(rol, modulo)
    if (!permiso.leer) return 'sin'
    if (!permiso.escribir) return 'lectura'
    return rol === 'admin' ? 'administracion' : 'edicion'
  }

  const cambiar = async (rol: string, modulo: string, nivel: Nivel) => {
    if (guardando.current || bloqueado(rol, modulo)) return
    if (nivel === 'administracion' && rol !== 'admin') return
    const anterior = permisoDe(rol, modulo)
    const siguiente: Permiso = { ...anterior, rol, modulo, ...niveles[nivel] }
    if (anterior.leer === siguiente.leer && anterior.escribir === siguiente.escribir) return
    guardando.current = true
    try {
      await actualizar.mutateAsync(siguiente)
      showSuccess('Permiso actualizado')
    } catch (cause) {
      showError(cause, 'No se pudo actualizar el permiso')
    } finally {
      guardando.current = false
    }
  }

  const renderFilas = (items: typeof MODULOS_PERMISOS) => items.map(modulo => (
    <tr key={modulo.key} className="group border-b border-qms-border last:border-b-0 hover:bg-qms-hover-bg/50">
      <th scope="row" className="sticky left-0 z-10 min-w-[170px] border-r border-qms-border bg-qms-surface px-4 py-3 text-left text-sm font-medium text-qms-dark group-hover:bg-qms-hover-bg">
        {modulo.label}
      </th>
      {roles.map(rol => {
        const fijo = bloqueado(rol.key, modulo.key)
        const value = nivelDe(rol.key, modulo.key)
        return <td key={rol.key} className="min-w-[175px] px-3 py-3 text-center">
          <Select aria-label={modulo.label + ' para ' + rol.label}
            value={value} disabled={fijo || actualizar.isPending}
            title={fijo ? 'Acceso reservado por la política de administración' : 'Se guarda al cambiar'}
            className={'min-w-[145px] text-xs font-medium ' +
              (value === 'administracion' ? 'border-qms-primary/30 bg-qms-primary-soft text-qms-primary' :
              value === 'edicion' ? 'border-qms-success/30 bg-soft-green-bg text-qms-success' :
              value === 'sin' ? 'bg-qms-hover-bg text-qms-muted' : 'bg-qms-surface text-qms-dark')}
            onChange={event => { void cambiar(rol.key, modulo.key, event.target.value as Nivel) }}>
            <option value="sin">Sin acceso</option>
            <option value="lectura">Solo lectura</option>
            <option value="edicion">Edición</option>
            {rol.key === 'admin' && <option value="administracion">Administración</option>}
          </Select>
        </td>
      })}
    </tr>
  ))

  return <section data-users-permissions className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-qms-border px-4 py-2">
      <h2 className="text-sm font-semibold text-qms-dark">Permisos por módulo</h2>
      <details className="group relative z-20">
        <summary aria-label="Ayuda sobre niveles de acceso" title="¿Qué significa cada nivel?"
          className="flex size-9 cursor-pointer list-none items-center justify-center rounded-button border border-qms-border bg-qms-surface text-qms-muted hover:border-qms-primary/30 hover:text-qms-primary [&::-webkit-details-marker]:hidden">
          <CircleHelp aria-hidden="true" className="size-4" />
        </summary>
        <div role="note" className="absolute right-0 top-[calc(100%+8px)] w-[min(360px,85vw)] rounded-card border border-qms-border bg-qms-surface p-4 text-sm leading-relaxed text-qms-dark shadow-lg">
          <p className="font-semibold">Niveles de acceso</p>
          <p className="mt-2"><strong>Administración:</strong> representación de lectura y escritura para el administrador. No añade privilegios nuevos.</p>
          <p className="mt-1"><strong>Edición:</strong> consultar y modificar. <strong>Solo lectura:</strong> consultar. <strong>Sin acceso:</strong> no abrir el módulo.</p>
          <p className="mt-2 text-qms-muted">Los cambios se guardan al instante sobre los permisos vigentes y aplican al recargar la sesión. Usuarios y Configuración tienen restricciones administrativas.</p>
        </div>
      </details>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div data-users-permissions-scroll className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[710px] border-collapse text-sm">
          <caption className="sr-only">Matriz de roles y permisos por módulo</caption>
          <thead className="sticky top-0 z-20 bg-qms-table-head">
            <tr className="border-b border-qms-border text-xs font-semibold text-qms-muted">
              <th scope="col" className="sticky left-0 z-20 min-w-[170px] border-r border-qms-border bg-qms-table-head px-4 py-4 text-left">Módulo</th>
              {roles.map(rol => <th scope="col" key={rol.key} className="min-w-[175px] px-3 py-4 text-center">{rol.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><th colSpan={roles.length + 1} scope="colgroup" className="bg-qms-hover-bg px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-qms-muted">Operación</th></tr>
            {renderFilas(operacion)}
            <tr><th colSpan={roles.length + 1} scope="colgroup" className="bg-qms-hover-bg px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-qms-muted">Administración</th></tr>
            {renderFilas(administracion)}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-qms-border px-4 py-3 text-xs text-qms-muted"><span aria-hidden="true" className="size-2 rounded-full bg-qms-success" />Los cambios se guardan automáticamente.</div>
    </div>
  </section>
}

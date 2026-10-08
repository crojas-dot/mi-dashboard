'use client'

import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useRef } from 'react'
import { usePermisos, useActualizarPermiso } from '@/lib/queries/usePermisos'
import type { Permiso } from '@/lib/permisos'
import { MODULOS_PERMISOS } from '@/lib/constants/modulos'
import Switch from '@/components/ui/Switch'
import ErrorState from '@/components/ui/ErrorState'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getRoleLabel, ROLES_GESTIONABLES } from '@/lib/constants/roles'

const ROLES = ROLES_GESTIONABLES.map(key => ({ key, label: getRoleLabel(key) }))

export default function RolesAccesos({ active = true }: { active?: boolean }) {
  const { data: permisos = [], isLoading, error, refetch } = usePermisos(active)
  const actualizar = useActualizarPermiso()
  const savingRef = useRef(false)

  if (isLoading) {
    return <LoadingSkeleton label="Cargando permisos…" />
  }
  if (error) return <ErrorState message="No se pudieron cargar los permisos." onRetry={() => void refetch()} />

  const permisoDe = (rol: string, modulo: string): Permiso =>
    permisos.find((p) => p.rol === rol && p.modulo === modulo) ?? { rol, modulo, leer: false, escribir: false }

  const cambiar = async (rol: string, modulo: string, campo: 'leer' | 'escribir', valor: boolean) => {
    const restringido = modulo === 'configuracion' || (rol !== 'admin' && modulo === 'usuarios')
    if (savingRef.current || restringido) return
    const actual = permisoDe(rol, modulo)
    const nuevo: Permiso = { ...actual, rol, modulo }
    if (campo === 'leer') {
      nuevo.leer = valor
      if (!valor) nuevo.escribir = false
    } else {
      nuevo.escribir = valor
    }
    try {
      savingRef.current = true
      await actualizar.mutateAsync(nuevo)
      showSuccess('Permiso actualizado')
    } catch (error) {
      showError(error as Error, 'No se pudo actualizar el permiso')
    } finally { savingRef.current = false }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-qms-border bg-qms-hover-bg p-4 text-sm text-qms-muted">
        <p><strong className="font-medium text-qms-dark">Ver</strong> permite abrir el módulo. <strong className="font-medium text-qms-dark">Editar</strong> permite realizar cambios y requiere Ver.</p>
        <p className="mt-1">Al desactivar Ver también se desactiva Editar. Los cambios se guardan al instante y aplican al recargar la sesión. Usuarios y Configuración requieren rol administrador; el administrador siempre conserva Configuración.</p>
      </div>
      <div className="ui-panel overflow-x-auto">
        <table className="ui-table min-w-[680px]">
          <caption className="sr-only">Permisos para ver y editar cada módulo por rol</caption>
          <thead>
            <tr className="bg-qms-table-head">
              <th className="px-3 py-2 text-left font-semibold text-qms-dark">Módulo</th>
              {ROLES.map((r) => (
                <th key={r.key} className="px-3 py-2 text-center font-semibold text-qms-dark">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS_PERMISOS.map((m) => (
              <tr key={m.key} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{m.label}</td>
                {ROLES.map((r) => {
                  const soloAdmin = m.key === 'configuracion' || m.key === 'usuarios'
                  const bloqueado = m.key === 'configuracion' || (r.key !== 'admin' && soloAdmin)
                  const p = m.key === 'configuracion' && r.key === 'admin' ? { leer: true, escribir: true }
                    : r.key !== 'admin' && soloAdmin ? { leer: false, escribir: false } : permisoDe(r.key, m.key)
                  return (
                    <td key={r.key} className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <label className="flex flex-col items-center gap-1 text-xs text-qms-muted">
                          <Switch
                            checked={p.leer}
                            aria-label={`Ver ${m.label} como ${r.label}`}
                            disabled={bloqueado || actualizar.isPending}
                            onChange={(v) => cambiar(r.key, m.key, 'leer', v)}
                          />
                          Ver
                        </label>
                        <label className="flex flex-col items-center gap-1 text-xs text-qms-muted">
                          <Switch
                            checked={p.escribir}
                            aria-label={`Editar ${m.label} como ${r.label}`}
                            disabled={bloqueado || !p.leer || actualizar.isPending}
                            onChange={(v) => cambiar(r.key, m.key, 'escribir', v)}
                          />
                          Editar
                        </label>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

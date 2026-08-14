'use client'

import { Loader2 } from 'lucide-react'
import { usePermisos, useActualizarPermiso } from '@/lib/queries/usePermisos'
import type { Permiso } from '@/lib/permisos'
import Switch from '@/components/ui/Switch'
import { showError, showSuccess } from '@/lib/services/errorToast'

const ROLES = [
  { key: 'admin', label: 'Administrador' },
  { key: 'calidad', label: 'Calidad' },
  { key: 'colaborador', label: 'Colaborador' },
]

const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'quejas', label: 'Quejas' },
  { key: 'mis_quejas', label: 'Mis Quejas' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'sacp', label: 'SACP' },
  { key: 'riesgos', label: 'Riesgos' },
  { key: 'auditorias', label: 'Auditorías' },
  { key: 'revision', label: 'Revisión por Dirección' },
  { key: 'procesos', label: 'Procesos' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'configuracion', label: 'Configuración' },
  { key: 'reporteria', label: 'Reportería' },
]

export default function RolesAccesos() {
  const { data: permisos = [], isLoading } = usePermisos()
  const actualizar = useActualizarPermiso()

  if (isLoading) {
    return <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  const permisoDe = (rol: string, modulo: string): Permiso =>
    permisos.find((p) => p.rol === rol && p.modulo === modulo) ?? { rol, modulo, leer: false, escribir: false }

  const cambiar = async (rol: string, modulo: string, campo: 'leer' | 'escribir', valor: boolean) => {
    const actual = permisoDe(rol, modulo)
    const nuevo: Permiso = { ...actual, rol, modulo }
    if (campo === 'leer') {
      nuevo.leer = valor
      if (!valor) nuevo.escribir = false
    } else {
      nuevo.escribir = valor
    }
    try {
      await actualizar.mutateAsync(nuevo)
      showSuccess('Permiso actualizado')
    } catch (error) {
      showError(error as Error, 'No se pudo actualizar el permiso')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Controla qué módulos puede ver y editar cada rol. Los cambios aplican al recargar la sesión.
      </p>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
        <table className="w-full select-text text-sm">
          <thead>
            <tr style={{ backgroundColor: '#343a40' }}>
              <th className="px-3 py-2 text-left font-semibold text-white">Módulo</th>
              {ROLES.map((r) => (
                <th key={r.key} className="px-3 py-2 text-center font-semibold text-white">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.key} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{m.label}</td>
                {ROLES.map((r) => {
                  const p = permisoDe(r.key, m.key)
                  const bloqueado = r.key === 'admin' && m.key === 'configuracion'
                  return (
                    <td key={r.key} className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <label className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500 cursor-pointer">
                          <Switch
                            checked={p.leer}
                            disabled={bloqueado}
                            onChange={(v) => cambiar(r.key, m.key, 'leer', v)}
                          />
                          Ver
                        </label>
                        <label className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500 cursor-pointer">
                          <Switch
                            checked={p.escribir}
                            disabled={bloqueado || !p.leer}
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
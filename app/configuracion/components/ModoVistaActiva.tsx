'use client'

import { useAuthStore } from '@/lib/store/auth-store'
import Switch from '@/components/ui/Switch'
import Badge from '@/components/ui/Badge'
import { showError, showSuccess } from '@/lib/services/errorToast'

const ROLES = [
  { key: 'admin', label: 'Administrador' },
  { key: 'calidad', label: 'Calidad' },
  { key: 'colaborador', label: 'Colaborador' },
]

const DESCRIPCION: Record<string, string> = {
  admin: 'Vista real. Acceso completo al sistema.',
  calidad: 'Gestiona quejas, documentos, SACP y seguimiento.',
  colaborador: 'Solo ve y procesa sus quejas asignadas.',
}

export default function ModoVistaActiva() {
  const { user, vistaActiva, setVistaActiva } = useAuthStore()
  const rolReal = user?.rol ?? 'admin'
  const activo = vistaActiva ?? rolReal

  const activar = async (rol: string, ahoraOn: boolean) => {
    try {
      if (!ahoraOn) {
        await setVistaActiva(null)
        showSuccess('Vista real restaurada')
        return
      }
      const objetivo = rol === rolReal ? null : rol
      await setVistaActiva(objetivo)
      const label = ROLES.find((r) => r.key === rol)?.label ?? rol
      showSuccess(objetivo === null ? `Vista de ${label} restaurada` : `Vista de ${label} activada`)
    } catch (error) {
      showError(error as Error, 'No se pudo cambiar la vista')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Simulá la interfaz de otro rol sin salir de tu sesión. El acceso a Configuración siempre se mantiene para el
        administrador, por lo que podés revertir la vista en cualquier momento.
      </p>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
        <table className="w-full select-text text-sm">
          <thead>
            <tr style={{ backgroundColor: '#343a40' }}>
              <th className="px-3 py-2 text-left font-semibold text-white">Rol</th>
              <th className="px-3 py-2 text-left font-semibold text-white">Descripción</th>
              <th className="px-3 py-2 text-center font-semibold text-white w-40">Vista activa</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.key} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    {r.label}
                    {r.key === rolReal && <Badge variant="blue">Rol real</Badge>}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{DESCRIPCION[r.key]}</td>
                <td className="px-3 py-2 text-center">
                  <Switch checked={activo === r.key} onChange={(on) => activar(r.key, on)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
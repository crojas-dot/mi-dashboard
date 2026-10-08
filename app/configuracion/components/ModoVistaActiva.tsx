'use client'

import { useRef, useState } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getRoleLabel, ROLES_GESTIONABLES, type RolGestionable } from '@/lib/constants/roles'

const ROLE_VIEW_DESCRIPTIONS: Record<RolGestionable, string> = {
  admin: 'Configuración y acceso completo al sistema.',
  calidad: 'Quejas, documentos, acciones y seguimiento.',
  colaborador: 'Gestión de las quejas que tiene asignadas.',
}
const ROLES = ROLES_GESTIONABLES.map(key => ({
  key,
  label: getRoleLabel(key),
  description: ROLE_VIEW_DESCRIPTIONS[key],
}))

export default function ModoVistaActiva() {
  const user = useAuthStore(state => state.user)
  const vistaActiva = useAuthStore(state => state.vistaActiva)
  const setVistaActiva = useAuthStore(state => state.setVistaActiva)
  const rolReal = user?.rol ?? 'admin'
  const activo = vistaActiva ?? rolReal
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const activar = async (rol: string | null) => {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true)
    try {
      await setVistaActiva(rol === rolReal ? null : rol)
      showSuccess(!rol || rol === rolReal ? 'Vista real restaurada' : 'Vista de rol activada')
    } catch (error) { showError(error as Error, 'No se pudo cambiar la vista') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <div className="space-y-5">
    <p className="rounded-card border border-qms-border bg-qms-hover-bg p-4 text-sm text-qms-muted">Revisá la navegación disponible para otro rol. Esta vista no cambia tu rol real ni los accesos de la base de datos. Configuración sigue disponible para volver a tu vista.</p>
    <div className="grid gap-4 xl:grid-cols-3">{ROLES.map(rol => <section key={rol.key}
      className={`ui-panel p-5 ${activo === rol.key ? 'border-qms-primary/30 bg-qms-primary-soft' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-medium">{rol.label}</h3><Switch aria-label={`Usar vista de ${rol.label}`} checked={activo === rol.key} disabled={saving} onChange={on => void activar(on ? rol.key : null)} /></div>
      <p className="mt-3 text-sm text-qms-muted">{rol.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{rol.key === rolReal && <Badge variant="gray">Rol real</Badge>}{activo === rol.key && <Badge variant="blue">En uso</Badge>}</div>
    </section>)}</div>
    {vistaActiva && <Button variant="secondary" loading={saving} onClick={() => void activar(null)}>Restaurar vista real</Button>}
  </div>
}

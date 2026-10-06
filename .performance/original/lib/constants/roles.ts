export const ROLE_VARIANTS: Record<string, string> = {
  admin: 'blue',
  calidad: 'green',
  colaborador: 'amber',
  coordinador: 'amber',
  revisor: 'purple',
  usuario: 'gray',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  calidad: 'Calidad',
  colaborador: 'Colaborador',
  coordinador: 'Coordinador',
  revisor: 'Revisor',
  usuario: 'Usuario',
}

export function getRoleVariant(role: string): string {
  return ROLE_VARIANTS[role] || 'gray'
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export const ROLES = Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>
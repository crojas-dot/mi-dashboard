import type { VarianteBadge } from './badges'

// Roles asignables desde la UI de administración; no son una fuente de autorización.
export const ROLES_GESTIONABLES = ['admin', 'calidad', 'colaborador'] as const
export type RolGestionable = (typeof ROLES_GESTIONABLES)[number]
const rolesGestionablesSet: ReadonlySet<string> = new Set(ROLES_GESTIONABLES)

export function esRolGestionable(value: unknown): value is RolGestionable {
  return typeof value === 'string' && rolesGestionablesSet.has(value)
}

export const ROLE_VARIANTS: Readonly<Record<string, VarianteBadge>> = {
  admin: 'blue',
  calidad: 'green',
  colaborador: 'amber',
  coordinador: 'amber',
  revisor: 'purple',
  usuario: 'gray',
}

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  admin: 'Administrador',
  calidad: 'Calidad',
  colaborador: 'Colaborador',
  coordinador: 'Coordinador',
  revisor: 'Revisor',
  usuario: 'Usuario',
} as const

export const ROLE_DIRECTORY_VARIANTS = {
  admin: 'blue',
  calidad: 'gray',
  colaborador: 'green',
} as const satisfies Record<RolGestionable, VarianteBadge>

export const ROLE_DIRECTORY_AVATAR_CLASSES = {
  admin: 'bg-qms-primary',
  calidad: 'bg-qms-muted',
  colaborador: 'bg-qms-success',
} as const satisfies Record<RolGestionable, string>

// El directorio conserva colores propios distintos al badge del menú de cuenta.
export function getRoleVariant(role: string): VarianteBadge {
  return ROLE_VARIANTS[role] ?? 'gray'
}

export function getDirectoryRoleVariant(role: string): VarianteBadge {
  return Object.hasOwn(ROLE_DIRECTORY_VARIANTS, role)
    ? ROLE_DIRECTORY_VARIANTS[role as RolGestionable]
    : 'gray'
}

export function getDirectoryRoleAvatarClass(role: string): string {
  return Object.hasOwn(ROLE_DIRECTORY_AVATAR_CLASSES, role)
    ? ROLE_DIRECTORY_AVATAR_CLASSES[role as RolGestionable]
    : 'bg-qms-muted'
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export const ROLES = Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>
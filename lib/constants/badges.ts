/** Paleta de etiquetas: solo presentación. Los hex y la tipografía viven en theme.css. */
export const ESTILOS_BADGE = {
  red: 'bg-qms-danger text-white',
  amber: 'bg-qms-warning text-qms-warning-text',
  green: 'bg-qms-success text-white',
  blue: 'bg-qms-primary text-white',
  orange: 'bg-qms-orange text-white',
  investigacion: 'bg-qms-investigacion text-qms-investigacion-text',
  purple: 'bg-qms-purple text-white',
  gray: 'bg-qms-muted text-white',
} as const
export type VarianteBadge = keyof typeof ESTILOS_BADGE

// Postgres almacena estas claves semánticas, no nombres visuales ni hex arbitrarios.
export const COLORES_CATALOGO = [
  { value: 'primary', label: 'Azul', variante: 'blue' },
  { value: 'info', label: 'Información', variante: 'blue' },
  { value: 'success', label: 'Verde', variante: 'green' },
  { value: 'warning', label: 'Ámbar', variante: 'amber' },
  { value: 'danger', label: 'Rojo', variante: 'red' },
  { value: 'secondary', label: 'Gris', variante: 'gray' },
] as const satisfies readonly { value: string; label: string; variante: VarianteBadge }[]
export type ColorCatalogo = (typeof COLORES_CATALOGO)[number]['value']
const aliasCatalogo: Readonly<Record<string, VarianteBadge>> = Object.fromEntries(
  COLORES_CATALOGO.map(color => [color.value, color.variante]),
)
export function esColorCatalogo(value: unknown): value is ColorCatalogo {
  return typeof value === 'string' && Object.hasOwn(aliasCatalogo, value)
}
export function estiloBadge(variant: string): string {
  const clave = esColorCatalogo(variant) ? aliasCatalogo[variant] : variant
  return Object.hasOwn(ESTILOS_BADGE, clave) ? ESTILOS_BADGE[clave as VarianteBadge] : ESTILOS_BADGE.gray
}

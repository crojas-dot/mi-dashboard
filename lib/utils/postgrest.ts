/** Valor literal para ilike dentro de or(). No interpolar texto del usuario
 * directamente en la gramática de filtros: las comas separan condiciones.
 * Conserva % y _ como comodines compatibles con la búsqueda existente.
 */
export function containsPattern(value: string): string {
  return `"%${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}%"`
}

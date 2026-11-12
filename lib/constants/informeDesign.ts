/** Informe institucional: Guía de Identidad Visual Colores.xlsx, hoja 1.
 * Fuentes secundarias autorizadas: no distribuir Gilroy sin su archivo/licencia.
 * Valores sin # para OOXML; PDF convierte esta misma paleta a RGB.
 */
export const INFORME_DESIGN = {
  accent: '2A61B0',
  text: '1A1718',
  muted: '626162',
  border: 'E6E5E5',
  bodyFont: 'Arial',
  headingFont: 'Century Gothic',
} as const

export function informeRgb(hex: string): [number, number, number] {
  return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
}

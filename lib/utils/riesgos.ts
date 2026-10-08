export type NivelRiesgo = 'Bajo' | 'Medio' | 'Alto' | 'Critico'
/** Fórmula única de la escala 3×3; UI y alta persisten el mismo nivel. */
export function calcularNivelRiesgo(probabilidad: number, impacto: number): NivelRiesgo {
  const valor = probabilidad * impacto
  if (valor <= 2) return 'Bajo'
  if (valor <= 4) return 'Medio'
  if (valor <= 6) return 'Alto'
  return 'Critico'
}

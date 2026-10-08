import type { FilaInforme } from './tipos'

export const cellValue = (row: FilaInforme, key: string) => {
  const v = row[key]
  if (v == null || v === '') return '—'
  if (key === 'descripcion' && typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…'
  if (key === 'impacto' || key === 'probabilidad') return String(v)
  if (typeof v === 'string' && v.includes('T')) return new Date(v).toLocaleDateString('es-ES')
  return String(v)
}

export function contarEstados(resultados: FilaInforme[]): Record<string, number> {
  return resultados.reduce((acc: Record<string, number>, row) => {
    acc[row.estado] = (acc[row.estado] || 0) + 1
    return acc
  }, {})
}

export function contarDistribucion(resultados: FilaInforme[], campo: string): Record<string, number> {
  return resultados.reduce((acc: Record<string, number>, row) => {
    const valor = String(row[campo] || 'Sin asignar')
    acc[valor] = (acc[valor] || 0) + 1
    return acc
  }, {})
}

/** Conserva la clasificación actual del informe, independiente del motor QMS de plazos. */
export function filtrarVencidos(resultados: FilaInforme[], campo: string, hoy = new Date()): FilaInforme[] {
  return resultados.filter(row => {
    const valor = row[campo]
    if (!valor || ['Cerrada', 'Finalizado', 'No Procede'].includes(row.estado)) return false
    return new Date(String(valor)) < hoy
  })
}

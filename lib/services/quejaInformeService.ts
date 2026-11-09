import { apiFetch } from '@/lib/services/apiClient'
import { INFORME_MAX_LENGTH, type QuejaInforme } from '@/lib/utils/quejaInforme'

export async function guardarQuejaInforme(input: { quejaId: string; version: number; contenido: string; fuenteRevision: number }): Promise<QuejaInforme> {
  if (!input.contenido.trim() || input.contenido.length > INFORME_MAX_LENGTH) throw new Error('Revisá la extensión del informe antes de guardar.')
  const response = await apiFetch('/api/quejas/informe', { method: 'PUT', body: JSON.stringify(input) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'No se pudo guardar el informe.')
  return body.informe
}

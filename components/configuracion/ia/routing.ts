import type { AIProvider, AIRouting } from '@/lib/ai/types'

export type CampoRutaIA = 'proveedor_id' | 'modelo_nombre' | 'system_prompt' | 'fallback_provider_id' | 'fallback_modelo'

/** Copiar la ruta editada evita que el borrador anterior cambie por referencia. */
export function cambiarRutaIA(previous: AIRouting, modulo: string, campo: CampoRutaIA, valor: string, providers: readonly AIProvider[]): AIRouting {
  const ruta = { ...previous[modulo], [campo]: valor }
  if (campo === 'proveedor_id' || campo === 'fallback_provider_id') {
    const provider = providers.find(p => p.id === valor)
    const modelo = provider?.modelos.length === 1 ? provider.modelos[0] : ''
    if (campo === 'proveedor_id') ruta.modelo_nombre = modelo
    else ruta.fallback_modelo = modelo
  }
  return { ...previous, [modulo]: ruta }
}

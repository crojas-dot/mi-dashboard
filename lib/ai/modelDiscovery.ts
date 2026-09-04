import type { AIProvider } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_TTL = 1440
const MAX_MODELS = 50

export function esOpenRouter(provider: AIProvider): boolean {
  const url = (provider.base_url ?? '').toLowerCase()
  const nombre = (provider.nombre ?? '').toLowerCase()
  return url.includes('openrouter.ai') || nombre.includes('openrouter')
}

export async function obtenerModelosDisponibles(provider: AIProvider): Promise<{ modelos: string[]; total: number; descartados: number }> {
  try {
    if (provider.tipo === 'gemini') {
      const modelos = await listarModelosGemini(provider.api_key)
      return { modelos, total: modelos.length, descartados: 0 }
    }
    if (provider.tipo === 'openai') {
      if (esOpenRouter(provider)) {
        return await listarModelosOpenRouter(provider)
      }
      const modelos = await listarModelosOpenAI(provider)
      return { modelos, total: modelos.length, descartados: 0 }
    }
    if (provider.tipo === 'anthropic') {
      const modelos = await listarModelosAnthropic(provider.api_key)
      return { modelos, total: modelos.length, descartados: 0 }
    }
    return { modelos: [], total: 0, descartados: 0 }
  } catch (e) {
    console.warn(`[modelDiscovery] No se pudieron obtener modelos de ${provider.nombre}:`, (e as Error).message)
    return { modelos: [], total: 0, descartados: 0 }
  }
}

async function listarModelosGemini(apiKey: string): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }
  const regexEstable = /^models\/gemini-\d+\.\d+-(flash|pro|ultra)$/
  const excluded = /preview|exp|thinking|omni|lite/i
  return (json.models ?? [])
    .filter((m) => {
      const name = String(m?.name ?? '').replace(/^models\//, '')
      if (!regexEstable.test(m.name ?? '')) return false
      if (excluded.test(name)) return false
      return (m.supportedGenerationMethods ?? []).includes('generateContent')
    })
    .map((m) => String(m?.name ?? '').replace(/^models\//, ''))
    .filter(Boolean)
}

async function listarModelosOpenRouter(provider: AIProvider): Promise<{ modelos: string[]; total: number; descartados: number }> {
  const base = (provider.base_url ?? '').trim().replace(/\/+$/, '') || 'https://openrouter.ai/api/v1'
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${provider.api_key}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as {
    data?: Array<{
      id?: string
      name?: string
      pricing?: { prompt?: string; completion?: string }
      context_length?: number
      top_provider?: { max_completion_tokens?: number }
      architecture?: { modality?: string }
    }>
  }

  const excluded = /embedding|whisper|tts|dall-e|moderation|audio|image|realtime|codex|moderator|guardrail/i
  const allModels = (json.data ?? []).map(m => ({
    id: String(m?.id ?? ''),
    pricing: m?.pricing,
    modality: m?.architecture?.modality ?? '',
  }))

  let descartados = 0
  const freeModels = allModels.filter(m => {
    if (!m.id) { descartados++; return false }
    if (m.id.startsWith('~')) { descartados++; return false }
    if (/:paid|:premium/i.test(m.id)) { descartados++; return false }
    if (excluded.test(m.id)) { descartados++; return false }
    if (m.id.endsWith(':batch')) { descartados++; return false }
    if (/-preview|-beta|-exp|-dev/i.test(m.id)) { descartados++; return false }
    if (/preview$/i.test(m.id)) { descartados++; return false }
    if (m.modality && !m.modality.includes('text')) { descartados++; return false }
    const esGratuito = m.pricing?.prompt === '0' && m.pricing?.completion === '0'
    if (!esGratuito) { descartados++; return false }
    return true
  })

  const sorted = freeModels.sort((a, b) => a.id.localeCompare(b.id))
  const limitados = sorted.slice(0, MAX_MODELS)

  console.log(`[modelDiscovery] OpenRouter: ${allModels.length} totales, ${freeModels.length} gratuitos, ${limitados.length} guardados`)

  return {
    modelos: limitados.map(m => m.id),
    total: allModels.length,
    descartados,
  }
}

async function listarModelosOpenAI(provider: AIProvider): Promise<string[]> {
  const base = (provider.base_url ?? '').trim().replace(/\/+$/, '') || 'https://api.openai.com/v1'
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${provider.api_key}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Array<{ id?: string }> }
  const excluded = /embedding|whisper|tts|dall-e|moderation|audio|image|realtime|codex/i
  return (json.data ?? [])
    .map((m) => String(m?.id ?? ''))
    .filter((id) => id && !excluded.test(id))
}

async function listarModelosAnthropic(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Array<{ id?: string }> }
  const excluded = /preview|expired|deprecated/i
  return (json.data ?? [])
    .map((m) => String(m?.id ?? ''))
    .filter((id) => id && !excluded.test(id))
}

export async function obtenerModelosCache(
  admin: SupabaseClient,
  providerId: string,
): Promise<string[] | null> {
  const { data: ttlData } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', 'ai_cache_ttl_minutes')
    .maybeSingle()
  const ttlMinutes = typeof ttlData?.valor === 'number' ? ttlData.valor : DEFAULT_TTL
  const ttlMs = ttlMinutes * 60 * 1000

  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_modelos_cache_${providerId}`)
    .maybeSingle()
  const cache = data?.valor as { modelos?: string[]; timestamp?: number } | null

  if (cache?.modelos && cache?.timestamp && Date.now() - cache.timestamp < ttlMs) {
    return cache.modelos
  }
  return null
}

export async function guardarModelosCache(
  admin: SupabaseClient,
  providerId: string,
  modelos: string[],
): Promise<void> {
  await admin.from('configuraciones_sistema').upsert(
    {
      clave: `ai_modelos_cache_${providerId}`,
      valor: { modelos, timestamp: Date.now() },
      descripcion: 'Caché de modelos disponibles por proveedor',
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )
}

export async function invalidarModelosCache(
  admin: SupabaseClient,
  providerId: string,
): Promise<void> {
  await admin
    .from('configuraciones_sistema')
    .delete()
    .eq('clave', `ai_modelos_cache_${providerId}`)
}

export function esModeloAuto(modelo: string): boolean {
  return /-auto$/i.test(modelo) || /^auto$/i.test(modelo)
}

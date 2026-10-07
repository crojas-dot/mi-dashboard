import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { AISettingsInputError, AISettingsConflictError, providersRevision, publicProviders, publicTestResult, readAISetting, writeAISetting, validSettingKey, normalizeProviders } from '@/lib/server/aiSettings'
import { obtenerModelosDisponibles } from '@/lib/ai/modelDiscovery'
import { limpiarMemoriaModelos } from '@/lib/ai/modelMemory'
import { limpiarResultadoTest } from '@/lib/ai/modelTestingClient'
import { logger } from '@/lib/utils/logger'
import type { AIProvider } from '@/lib/ai/types'

export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_BODY_BYTES = 1_048_576
const response = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
})

async function authorized(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 30, 60_000, 'ai-settings')) {
    return { error: response({ error: 'Demasiadas solicitudes. Espera un momento.' }, 429) }
  }
  const user = await getCurrentUser(request, request.signal)
  if (!user) return { error: response({ error: 'No autorizado' }, 401) }
  if (user.rol !== 'admin') return { error: response({ error: 'Solo administradores' }, 403) }
  const admin = createServiceClient()
  if (!admin) return { error: response({ error: 'Servidor mal configurado' }, 500) }
  return { admin }
}

function failure(error: unknown) {
  if (error instanceof AISettingsConflictError) return response({ error: error.message }, 409)
  if (error instanceof AISettingsInputError) return response({ error: error.message }, 400)
  logger.error('No se pudo completar la configuración IA', { module: 'ia', action: 'settings' }, error)
  return response({ error: 'No se pudo completar la operación de configuración IA.' }, 502)
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new AISettingsInputError('Solicitud demasiado grande.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new AISettingsInputError('Solicitud inválida.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      request.signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new AISettingsInputError('Solicitud demasiado grande.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new AISettingsInputError('Solicitud JSON inválida.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AISettingsInputError('Solicitud inválida.')
  return value as Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const access = await authorized(request)
  if (access.error) return access.error
  try {
    const key = new URL(request.url).searchParams.get('clave')
    if (key) {
      if (!validSettingKey(key)) throw new AISettingsInputError('Configuración no permitida.')
      const value = await readAISetting(access.admin!, key)
      return response({ valor: key === 'ai_providers' ? publicProviders(value)
        : key.startsWith('ai_test_resultado_') ? publicTestResult(value) : value })
    }
    const [providers, routing, ttl] = await Promise.all(
      ['ai_providers', 'ai_routing', 'ai_cache_ttl_minutes'].map(key => readAISetting(access.admin!, key)),
    )
    return response({ providers: publicProviders(providers), routing: routing ?? {}, ttl: typeof ttl === 'number' ? ttl : 1440, revision: providersRevision(providers) })
  } catch (error) { return failure(error) }
}

export async function PUT(request: NextRequest) {
  const access = await authorized(request)
  if (access.error) return access.error
  try {
    const input = await body(request)
    if (!validSettingKey(input.clave)) throw new AISettingsInputError('Configuración no permitida.')
    const saved = await writeAISetting(access.admin!, input.clave, input.valor, input.resetTokens, input.expectedRevision)
    return response(input.clave === 'ai_providers' ? saved : { valor: saved })
  } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  const access = await authorized(request)
  if (access.error) return access.error
  try {
    const input = await body(request)
    if (!['connect', 'models', 'cleanMemory'].includes(String(input.action))) throw new AISettingsInputError('Acción no permitida.')
    const saved = await readAISetting(access.admin!, 'ai_providers')
    const providers = Array.isArray(saved) ? saved as AIProvider[] : []
    const current = providers.find(p => p && (p.id === input.providerId || p.id === (input.provider as AIProvider | undefined)?.id))
    if (input.action === 'cleanMemory') {
      if (!current || !Array.isArray(input.modelos) || input.modelos.length > 200 || input.modelos.some(m => typeof m !== 'string' || m.length > 500)) {
        throw new AISettingsInputError('Proveedor o modelos inválidos.')
      }
      await limpiarMemoriaModelos(access.admin!, current.id, input.modelos as string[])
      await limpiarResultadoTest(access.admin!, current.id, input.modelos as string[])
      return response({ ok: true })
    }
    // También validar registros históricos antes de conectar desde el servidor.
    const existing = current ? normalizeProviders([current])[0] : undefined
    let provider = existing
    if (input.provider) {
      const draft = input.provider as AIProvider
      const normalized = normalizeProviders([{ ...draft, id: draft.id || 'draft', modelos: Array.isArray(draft.modelos) ? draft.modelos : [], limite_tokens: draft.limite_tokens ?? 0 }])[0]
      if (!normalized.api_key && existing && (normalized.tipo !== existing.tipo || normalized.base_url !== existing.base_url)) {
        throw new AISettingsInputError('Al cambiar URL o tipo, vuelve a indicar la clave.')
      }
      provider = { ...normalized, api_key: normalized.api_key || existing?.api_key || '' }
    }
    if (!provider?.api_key) throw new AISettingsInputError('El proveedor necesita una clave configurada.')
    const result = await obtenerModelosDisponibles(provider, true)
    return response(input.action === 'connect' ? { ok: true } : result)
  } catch (error) { return failure(error) }
}

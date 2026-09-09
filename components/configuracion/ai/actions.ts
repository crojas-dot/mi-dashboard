'use client'

import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/services/errorToast';
import type { AIProvider, AIProviderTipo } from '@/lib/ai/types';
import { LIMITE_POR_TIPO, CLAVE_PROVEEDORES, CLAVE_ROUTING } from './constants';

export { CLAVE_PROVEEDORES, CLAVE_ROUTING }

interface PersistResult {
  providers: AIProvider[]
  reseteados: Set<string>
}

export const upsertClaveFn = async (clave: string, valor: unknown) => {
  const { error } = await supabase.from('configuraciones_sistema').upsert(
    {
      clave,
      valor,
      descripcion: 'Subsistema de IA multi-proveedor',
      categoria: 'ia',
    },
    { onConflict: 'clave' }
  )
  if (error) throw error
}

export const persistirProveedores = async (
  lista: AIProvider[],
  reseteados: Set<string>
): Promise<PersistResult> => {
  try {
    const { data: actual } = await supabase
      .from('configuraciones_sistema')
      .select('valor')
      .eq('clave', CLAVE_PROVEEDORES)
      .maybeSingle()
    const dbProviders = Array.isArray(actual?.valor) ? (actual.valor as AIProvider[]) : []
    const dbPorId = new Map(dbProviders.map((p) => [p.id, p]))
    const aGuardar = lista.map((p) => {
      const db = dbPorId.get(p.id)
      const tokens = reseteados.has(p.id) ? 0 : db?.tokens_usados ?? p.tokens_usados ?? 0
      return { ...p, tokens_usados: tokens }
    })
    await upsertClaveFn(CLAVE_PROVEEDORES, aGuardar)
    return { providers: aGuardar, reseteados: new Set() }
  } catch (e) {
    showError(e as Error, 'No se pudo guardar el proveedor')
    throw e
  }
}

export const getLimitePorTipo = (tipo: AIProviderTipo) => LIMITE_POR_TIPO[tipo] ?? 250_000

export const probarConexion = async (
  providerId: string,
  providers: AIProvider[],
  onProvidersChange: (providers: AIProvider[]) => void
) => {
  const targetProvider = providers.find(p => p.id === providerId)
  if (!targetProvider) return

  const base_url = targetProvider.base_url ?? ''
  const api_key = targetProvider.api_key
  const tipo = targetProvider.tipo

  if (!base_url.trim() || !api_key.trim()) {
    showError(null, 'URL Base y API Key son requeridos para probar la conexión')
    return
  }

  try {
    const base = base_url.trim().replace(/\/+$/, '')
    const testUrl = tipo === 'gemini'
      ? `${base}/v1beta/models?key=${api_key}`
      : `${base}/models`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (tipo !== 'gemini') headers['Authorization'] = `Bearer ${api_key}`
    const res = await fetch(testUrl, { method: 'GET', headers, signal: AbortSignal.timeout(10000) })

    if (res.ok) {
      const newProviders = providers.map(p =>
        p.id === targetProvider.id ? { ...p, tokens_usados: 0 } : p
      )
      onProvidersChange(newProviders)
      showSuccess('Conexión exitosa ✓')
    } else {
      const err = await res.json().catch(() => ({}))
      showError(null, `Falló la conexión: ${res.status} ${err?.error?.message || res.statusText}`)
    }
  } catch (e) {
    showError(e as Error, 'No se pudo conectar con el proveedor')
  }
}

export const sincronizarModelos = async (
  providerId: string,
  providers: AIProvider[],
  onProvidersChange: (providers: AIProvider[]) => void
) => {
  const provider = providers.find(p => p.id === providerId)
  if (!provider) return

  try {
    const { obtenerModelosDisponibles, esOpenRouter } = await import('@/lib/ai/modelDiscovery')
    const resultado = await obtenerModelosDisponibles(provider)

    if (resultado.modelos.length === 0) {
      if (esOpenRouter(provider)) {
        showError(null, 'OpenRouter no tiene modelos gratuitos disponibles. Agregue créditos o use otro proveedor (Groq, Gemini, etc.).')
      } else {
        showError(null, `No se encontraron modelos para ${provider.nombre}. Verifique la API key.`)
      }
      return
    }

    let modelosFinales = resultado.modelos
    let excluidosPorTest = 0
    try {
      const { modelosExcluidosPorTest } = await import('@/lib/ai/modelTesting')
      modelosFinales = await modelosExcluidosPorTest(supabase, providerId, resultado.modelos)
      excluidosPorTest = resultado.modelos.length - modelosFinales.length
    } catch {
      // Sin test previo o error, usar todos
    }

    const nuevaLista = providers.map(p =>
      p.id === providerId ? { ...p, modelos: modelosFinales } : p
    )
    onProvidersChange(nuevaLista)
    await persistirProveedores(nuevaLista, new Set())

    try {
      const { limpiarMemoriaModelos } = await import('@/lib/ai/modelMemory')
      const { limpiarResultadoTest } = await import('@/lib/ai/modelTesting')
      await limpiarMemoriaModelos(supabase, providerId, modelosFinales)
      await limpiarResultadoTest(supabase, providerId, modelosFinales)
    } catch {
      // Silenciar errores de limpieza de memoria
    }

    // Note: routing update would need to be handled by parent

    let toastMsg = `${modelosFinales.length} modelos gratuitos sincronizados para ${provider.nombre}`
    if (excluidosPorTest > 0) {
      toastMsg += ` (${excluidosPorTest} excluidos por test previo)`
    }
    if (resultado.descartados > 0) {
      toastMsg += ` (${resultado.descartados} de pago/descartados de ${resultado.total} totales)`
    }
    showSuccess(toastMsg)
  } catch (e) {
    showError(e as Error, 'No se pudieron obtener los modelos del proveedor')
  }
}

export const reiniciarContador = async (
  id: string,
  providers: AIProvider[],
  onProvidersChange: (providers: AIProvider[]) => void
) => {
  const nuevaLista = providers.map((p) => (p.id === id ? { ...p, tokens_usados: 0 } : p))
  onProvidersChange(nuevaLista)
  await persistirProveedores(nuevaLista, new Set([id]))
}

export const eliminarProveedor = async (
  id: string,
  providers: AIProvider[],
  onProvidersChange: (providers: AIProvider[]) => void
) => {
  if (!confirm('¿Eliminar este proveedor? Los módulos que lo usen dejarán de funcionar hasta reasignarlos.')) return
  const nuevaLista = providers.filter((p) => p.id !== id)
  onProvidersChange(nuevaLista)
  await persistirProveedores(nuevaLista, new Set())
  // Routing cleanup would be handled by parent
}
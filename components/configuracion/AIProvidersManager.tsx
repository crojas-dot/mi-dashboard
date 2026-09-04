'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Save, Eye, EyeOff, Loader2, Sparkles, KeyRound, Brain, Check, RotateCcw, ChevronRight, Wifi, RefreshCw, Play, CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import type { AIProvider, AIProviderTipo, AIRouting } from '@/lib/ai/types'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'

const MODULOS_QMS: { id: string; label: string }[] = [
  { id: 'quejas', label: 'Quejas' },
  { id: 'sacp', label: 'SACP (Acciones)' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'auditorias', label: 'Auditorías' },
  { id: 'riesgos', label: 'Riesgos' },
  { id: 'revision', label: 'Revisión Dirección' },
  { id: 'general', label: 'General' },
]

const TIPOS: { value: AIProviderTipo; label: string }[] = [
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'Estándar OpenAI (OpenAI, DeepSeek, Grok, OpenRouter…)' },
]

const LIMITE_POR_TIPO: Record<AIProviderTipo, number> = {
  gemini: 30_000_000,
  anthropic: 250_000,
  openai: 6_000_000, // Groq / OpenAI / Otros compatibles
}

const CLAVE_PROVEEDORES = 'ai_providers'
const CLAVE_ROUTING = 'ai_routing'

const fmtNum = new Intl.NumberFormat('es-ES')

export default function AIProvidersManager() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [routing, setRouting] = useState<AIRouting>({})
  const [loading, setLoading] = useState(true)
  const [guardandoRut, setGuardandoRut] = useState(false)

  interface EditingProvider extends Omit<AIProvider, 'modelos'> {
  modelos: string | string[]
}
const [editingProvider, setEditingProvider] = useState<EditingProvider | null>(null)
  const [mostrarKey, setMostrarKey] = useState<Record<string, boolean>>({})
  const [modalModulo, setModalModulo] = useState<string | null>(null)
  const [sysPrompt, setSysPrompt] = useState('')
  const [reseteados, setReseteados] = useState<Set<string>>(new Set())
  const [expandedFallbacks, setExpandedFallbacks] = useState<Set<string>>(new Set())
  const [syncingModels, setSyncingModels] = useState<Set<string>>(new Set())
  const [cacheTtlValue, setCacheTtlValue] = useState<number>(1)
  const [cacheTtlUnit, setCacheTtlUnit] = useState<'minutes' | 'hours' | 'days'>('days')
  const [testModal, setTestModal] = useState<{
    abierto: boolean
    providerId: string | null
    providerNombre: string
    modelos: string[]
    progreso: { [modelo: string]: 'pendiente' | 'probando' | 'ok' | 'fallo' }
    enCurso: boolean
    cancelado: boolean
    resultado: { buenos: number; malos: number; total: number } | null
  }>({
    abierto: false,
    providerId: null,
    providerNombre: '',
    modelos: [],
    progreso: {},
    enCurso: false,
    cancelado: false,
    resultado: null,
  })
  const testAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase
        .from('configuraciones_sistema')
        .select('clave, valor')
        .in('clave', [CLAVE_PROVEEDORES, CLAVE_ROUTING, 'ai_cache_ttl_minutes'])
      if (!activo) return
      const porClave = new Map((data ?? []).map((r) => [r.clave, r.valor]))
      const provs = Array.isArray(porClave.get(CLAVE_PROVEEDORES)) ? (porClave.get(CLAVE_PROVEEDORES) as AIProvider[]) : []
      const rut = porClave.get(CLAVE_ROUTING)
      const ttlMinutes = typeof porClave.get('ai_cache_ttl_minutes') === 'number' ? (porClave.get('ai_cache_ttl_minutes') as number) : 1440
      let value: number
      let unit: 'minutes' | 'hours' | 'days'
      if (ttlMinutes >= 1440 && ttlMinutes % 1440 === 0) {
        value = ttlMinutes / 1440
        unit = 'days'
      } else if (ttlMinutes >= 60 && ttlMinutes % 60 === 0) {
        value = ttlMinutes / 60
        unit = 'hours'
      } else {
        value = ttlMinutes
        unit = 'minutes'
      }
      setProviders(provs)
      setRouting(rut && typeof rut === 'object' ? (rut as AIRouting) : {})
      setCacheTtlValue(value)
      setCacheTtlUnit(unit)
      setLoading(false)
    })()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (loading || providers.length === 0) return
    let cancelado = false
    ;(async () => {
      const { esOpenRouter, obtenerModelosDisponibles } = await import('@/lib/ai/modelDiscovery')
      const openRouterProviders = providers.filter(p => esOpenRouter(p))
      for (const p of openRouterProviders) {
        if (p.modelos.some(m => m.startsWith('~') || /:paid|:premium/i.test(m))) {
          try {
            const resultado = await obtenerModelosDisponibles(p)
            if (cancelado) return
            if (resultado.modelos.length > 0) {
              const listaLimpia = providers.map(pr => pr.id === p.id ? { ...pr, modelos: resultado.modelos } : pr)
              setProviders(listaLimpia)
              await supabase.from('configuraciones_sistema').upsert({ clave: CLAVE_PROVEEDORES, valor: listaLimpia, descripcion: 'Subsistema de IA multi-proveedor', categoria: 'ia' }, { onConflict: 'clave' })
              const nuevoRouting = { ...routing }
              let routingCambiado = false
              for (const m of Object.keys(nuevoRouting)) {
                if (nuevoRouting[m]?.proveedor_id === p.id && !resultado.modelos.includes(nuevoRouting[m].modelo_nombre)) {
                  nuevoRouting[m] = { ...nuevoRouting[m], modelo_nombre: resultado.modelos[0] }
                  routingCambiado = true
                }
              }
              if (routingCambiado) {
                setRouting(nuevoRouting)
                await supabase.from('configuraciones_sistema').upsert({ clave: CLAVE_ROUTING, valor: nuevoRouting, descripcion: 'Subsistema de IA multi-proveedor', categoria: 'ia' }, { onConflict: 'clave' })
              }
            }
          } catch {
            // Silenciar errores de auto-cleanup
          }
        }
      }
    })()
    return () => { cancelado = true }
  }, [loading, providers, routing])

  const upsertClave = async (clave: string, valor: unknown) => {
    const { error } = await supabase.from('configuraciones_sistema').upsert(
      {
        clave,
        valor,
        descripcion: 'Subsistema de IA multi-proveedor',
        categoria: 'ia',
      },
      { onConflict: 'clave' },
    )
    if (error) throw error
  }

  const persistirProveedores = async (lista: AIProvider[]) => {
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
      await upsertClave(CLAVE_PROVEEDORES, aGuardar)
      setReseteados(new Set())
      showSuccess('Proveedor de IA guardado')
    } catch (e) {
      showError(e as Error, 'No se pudo guardar el proveedor')
    }
  }

  const guardarRouting = async () => {
    setGuardandoRut(true)
    try {
      await upsertClave(CLAVE_ROUTING, routing)
      showSuccess('Enrutamiento de IA guardado')
    } catch (e) {
      showError(e as Error, 'No se pudo guardar el enrutamiento')
    } finally {
      setGuardandoRut(false)
    }
  }

  const guardarTtl = async () => {
    const val = Math.max(1, Math.round(cacheTtlValue))
    const multiplier = cacheTtlUnit === 'days' ? 1440 : cacheTtlUnit === 'hours' ? 60 : 1
    const ttlMinutes = val * multiplier
    try {
      await upsertClave('ai_cache_ttl_minutes', ttlMinutes)
      const unitLabel = cacheTtlUnit === 'days' ? 'días' : cacheTtlUnit === 'hours' ? 'horas' : 'minutos'
      showSuccess(`TTL de caché actualizado a ${val} ${unitLabel} (${ttlMinutes} min)`)
    } catch (e) {
      showError(e as Error, 'No se pudo guardar el TTL')
    }
  }

  const getLimitePorTipo = (tipo: AIProviderTipo) => LIMITE_POR_TIPO[tipo] ?? 250_000

  const abrirNuevo = () =>
    setEditingProvider({ id: '', nombre: '', tipo: 'openai', base_url: '', api_key: '', modelos: [], tokens_usados: 0, limite_tokens: getLimitePorTipo('openai') } as AIProvider)

  const abrirEditar = (p: AIProvider) =>
    setEditingProvider(p)

  const cerrarEditor = () =>
    setEditingProvider(null)

  const probarConexion = async (providerId?: string) => {
    const targetProvider = providerId ? providers.find(p => p.id === providerId) : editingProvider
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
        // Actualizar tokens_usados localmente (simulado - en producción usar headers de rate limit)
        setProviders(prev => prev.map(p => 
          p.id === targetProvider.id ? { ...p, tokens_usados: 0 } : p
        ))
        
        showSuccess('Conexión exitosa ✓')
      } else {
        const err = await res.json().catch(() => ({}))
        showError(null, `Falló la conexión: ${res.status} ${err?.error?.message || res.statusText}`)
      }
    } catch (e) {
      showError(e as Error, 'No se pudo conectar con el proveedor')
    }
  }

  const aplicarForm = async () => {
    if (!editingProvider) return
    const p = editingProvider
    if (!p.nombre.trim() || !p.api_key.trim()) {
      showError(null, 'Nombre y API Key son obligatorios')
      return
    }
    const modelosArray = (p.modelos as string[]).filter(Boolean).map(m => m.trim())
    const base = {
      nombre: p.nombre.trim(),
      tipo: p.tipo,
      base_url: p.base_url?.trim() || undefined,
      api_key: p.api_key.trim(),
      modelos: modelosArray,
      limite_tokens: p.limite_tokens ?? 100000,
    }
    const nuevaLista: AIProvider[] = p.id && p.id !== ''
      ? providers.map((prov) => (prov.id === p.id ? { ...prov, ...base } : prov))
      : [...providers, { id: crypto.randomUUID(), tokens_usados: 0, ...base }]
    setProviders(nuevaLista)
    await persistirProveedores(nuevaLista)
    cerrarEditor()

    const savedId = p.id && p.id !== '' ? p.id : nuevaLista[nuevaLista.length - 1].id
    const savedProvider = nuevaLista.find(pr => pr.id === savedId)
    if (savedProvider && savedProvider.modelos.length === 0) {
      try {
        const { obtenerModelosDisponibles } = await import('@/lib/ai/modelDiscovery')
        const resultado = await obtenerModelosDisponibles(savedProvider)
        if (resultado.modelos.length > 0) {
          const listaFinal = nuevaLista.map(pr =>
            pr.id === savedId ? { ...pr, modelos: resultado.modelos } : pr
          )
          setProviders(listaFinal)
          await persistirProveedores(listaFinal)
          showSuccess(`${resultado.modelos.length} modelos sincronizados automáticamente para ${savedProvider.nombre}`)
        }
      } catch {
        // Silenciar errores de auto-sync
      }
    }
  }

  const eliminarProveedor = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor? Los módulos que lo usen dejarán de funcionar hasta reasignarlos.')) return
    const nuevaLista = providers.filter((p) => p.id !== id)
    const nuevoRouting = { ...routing }
    for (const m of Object.keys(nuevoRouting)) {
      if (nuevoRouting[m]?.proveedor_id === id) delete nuevoRouting[m]
    }
    setProviders(nuevaLista)
    setReseteados((prev) => {
      const s = new Set(prev)
      s.delete(id)
      return s
    })
    setRouting(nuevoRouting)
    await persistirProveedores(nuevaLista)
    try {
      await upsertClave(CLAVE_ROUTING, nuevoRouting)
    } catch (e) {
      showError(e as Error, 'No se pudo actualizar el enrutamiento')
    }
  }

  const reiniciarContador = async (id: string) => {
    const nuevaLista = providers.map((p) => (p.id === id ? { ...p, tokens_usados: 0 } : p))
    setProviders(nuevaLista)
    setReseteados((prev) => new Set(prev).add(id))
    await persistirProveedores(nuevaLista)
  }

  const sincronizarModelos = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    setSyncingModels(prev => new Set(prev).add(providerId))
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
      setProviders(nuevaLista)
      await persistirProveedores(nuevaLista)

      try {
        const { limpiarMemoriaModelos } = await import('@/lib/ai/modelMemory')
        const { limpiarResultadoTest } = await import('@/lib/ai/modelTesting')
        const { createServiceClient } = await import('@/lib/server/supabase-admin')
        const admin = createServiceClient()
        if (admin) {
          await limpiarMemoriaModelos(admin, providerId, modelosFinales)
          await limpiarResultadoTest(admin, providerId, modelosFinales)
        }
      } catch {
        // Silenciar errores de limpieza de memoria
      }

      let routingActualizado = false
      if (esOpenRouter(provider)) {
        const modeloDefault = modelosFinales[0]
        const nuevoRouting = { ...routing }
        for (const m of Object.keys(nuevoRouting)) {
          if (nuevoRouting[m]?.proveedor_id === providerId && !modelosFinales.includes(nuevoRouting[m].modelo_nombre)) {
            nuevoRouting[m] = { ...nuevoRouting[m], modelo_nombre: modeloDefault }
            routingActualizado = true
          }
        }
        if (routingActualizado) {
          setRouting(nuevoRouting)
          await upsertClave(CLAVE_ROUTING, nuevoRouting)
        }
      }

      let toastMsg = `${modelosFinales.length} modelos gratuitos sincronizados para ${provider.nombre}`
      if (excluidosPorTest > 0) {
        toastMsg += ` (${excluidosPorTest} excluidos por test previo)`
      }
      if (resultado.descartados > 0) {
        toastMsg += ` (${resultado.descartados} de pago/descartados de ${resultado.total} totales)`
      }
      if (routingActualizado) {
        toastMsg += `. Enrutamiento actualizado (modelos de pago reemplazados)`
      }
      showSuccess(toastMsg)
    } catch (e) {
      showError(e as Error, 'No se pudieron obtener los modelos del proveedor')
    } finally {
      setSyncingModels(prev => {
        const s = new Set(prev)
        s.delete(providerId)
        return s
      })
    }
  }

  const abrirTestModal = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider || provider.modelos.length === 0) return

    const initial: { [modelo: string]: 'pendiente' | 'probando' | 'ok' | 'fallo' } = {}
    for (const m of provider.modelos) initial[m] = 'pendiente'

    setTestModal({
      abierto: true,
      providerId,
      providerNombre: provider.nombre,
      modelos: provider.modelos,
      progreso: initial,
      enCurso: false,
      cancelado: false,
      resultado: null,
    })
  }

  const cerrarTestModal = () => {
    if (testModal.enCurso) {
      testAbortRef.current?.abort()
    }
    setTestModal(prev => ({ ...prev, abierto: false, enCurso: false }))
    testAbortRef.current = null
  }

  const iniciarTest = async () => {
    if (!testModal.providerId) return
    const provider = providers.find(p => p.id === testModal.providerId)
    if (!provider) return

    const abortController = new AbortController()
    testAbortRef.current = abortController

    const initial: { [modelo: string]: 'pendiente' | 'probando' | 'ok' | 'fallo' } = {}
    for (const m of provider.modelos) initial[m] = 'probando'

    setTestModal(prev => ({ ...prev, enCurso: true, cancelado: false, progreso: initial, resultado: null }))

    try {
      const { testearProveedor } = await import('@/lib/ai/modelTesting')

      const resultado = await testearProveedor(supabase, provider, {
        maxModelos: 20,
        signal: abortController.signal,
        onProgress: (modelo: string, r: { ok: boolean }) => {
          setTestModal(prev => ({
            ...prev,
            progreso: { ...prev.progreso, [modelo]: r.ok ? 'ok' : 'fallo' },
          }))
        },
      })

      const buenos = resultado.resultados.filter(r => r.ok).length
      const malos = resultado.resultados.filter(r => !r.ok).length

      const modelosOk = resultado.resultados.filter(r => r.ok).map(r => r.modelo)
      const nuevosModelos = provider.modelos.filter(m => modelosOk.includes(m))

      if (nuevosModelos.length > 0) {
        const nuevaLista = providers.map(pr =>
          pr.id === testModal.providerId ? { ...pr, modelos: nuevosModelos } : pr
        )
        setProviders(nuevaLista)
        await persistirProveedores(nuevaLista)
      }

      setTestModal(prev => ({
        ...prev,
        enCurso: false,
        resultado: { buenos, malos, total: resultado.resultados.length },
      }))

      const toastMsg = `${buenos} modelos buenos, ${malos} malos. Lista actualizada.`
      if (malos > 0) {
        showSuccess(`${toastMsg} (${malos} excluidos por test)`)
      } else {
        showSuccess(toastMsg)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setTestModal(prev => ({ ...prev, enCurso: false, cancelado: true }))
        showSuccess('Test cancelado por el usuario')
      } else {
        setTestModal(prev => ({ ...prev, enCurso: false }))
        showError(e as Error, 'No se pudo completar el test')
      }
    } finally {
      testAbortRef.current = null
    }
  }

  const cancelarTest = () => {
    testAbortRef.current?.abort()
  }

  const actualizarRuta = (
    modulo: string,
    campo: 'proveedor_id' | 'modelo_nombre' | 'system_prompt',
    valor: string,
  ) => {
    setRouting((prev) => {
      const next = { ...prev, [modulo]: { ...prev[modulo], [campo]: valor } }
      // Auto-seleccionar modelo si el proveedor tiene exactamente 1 modelo
      if (campo === 'proveedor_id' && valor) {
        const prov = providers.find((p) => p.id === valor)
        if (prov?.modelos?.length === 1) {
          next[modulo].modelo_nombre = prov.modelos[0]
        } else {
          next[modulo].modelo_nombre = ''
        }
      }
      return next
    })
  }

  const abrirModalContexto = (moduloId: string) => {
    setSysPrompt(routing[moduloId]?.system_prompt || '')
    setModalModulo(moduloId)
  }

  const guardarSysPrompt = () => {
    if (modalModulo) actualizarRuta(modalModulo, 'system_prompt', sysPrompt)
    setModalModulo(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: '#0d6efd' }} />
        <h3 className="text-sm font-semibold text-gray-800">Proveedores de IA</h3>
        <span className="text-xs text-gray-400">Sin modelos fijos: cualquier endpoint compatible funciona.</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="secondary" onClick={abrirNuevo}>
          <Plus className="h-3.5 w-3.5" /> Nuevo proveedor
        </Button>
        <span className="text-xs text-gray-400">Los cambios se guardan automáticamente al agregar o eliminar.</span>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
        <table className="w-full select-text text-sm">
          <thead>
            <tr style={{ backgroundColor: '#343a40' }}>
              <th className="px-3 py-2 text-left font-semibold text-white">Nombre</th>
              <th className="px-3 py-2 text-left font-semibold text-white">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold text-white">URL Base</th>
              <th className="px-3 py-2 text-left font-semibold text-white">Modelos</th>
              <th className="px-3 py-2 text-left font-semibold text-white">API Key</th>
              <th className="px-3 py-2 text-left font-semibold text-white">Consumo / Límite</th>
              <th className="px-3 py-2 text-center font-semibold text-white w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No hay proveedores configurados todavía.
                </td>
              </tr>
            ) : (
              providers.map((p) => {
                const visible = mostrarKey[p.id]
                const usados = p.tokens_usados ?? 0
                const limite = p.limite_tokens ?? 100000
                const pct = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0
                const colorBarra = pct > 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'
                const colorTexto = pct > 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600'
                return (
                  <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-3 py-2">
                      <Badge variant="blue">{p.tipo}</Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.base_url || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        {(p.modelos ?? []).length > 0 ? (
                          (p.modelos as string[]).slice(0, 5).map((modelo) => {
                            const testStatus = testModal.providerId === p.id ? testModal.progreso[modelo] : undefined
                            return (
                              <span key={modelo} className="font-mono text-xs text-gray-600 flex items-center gap-1">
                                {testStatus === 'probando' && <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />}
                                {testStatus === 'ok' && <CheckCircle className="h-2.5 w-2.5 text-green-500" />}
                                {testStatus === 'fallo' && <XCircle className="h-2.5 w-2.5 text-red-500" />}
                                {modelo}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                        {(p.modelos ?? []).length > 5 && (
                          <span className="text-xs text-gray-400">+{(p.modelos as string[]).length - 5} más</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-gray-500">
                          {visible ? p.api_key : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMostrarKey((m) => ({ ...m, [p.id]: !m[p.id] }))}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          title={visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-36 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`${colorBarra} h-full transition-all duration-300`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono ${colorTexto} whitespace-nowrap`}>
                          {fmtNum.format(usados)} / {fmtNum.format(limite)} ({pct}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => probarConexion(p.id)}
                          className="rounded p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          title="Probar conexión y actualizar consumo"
                        >
                          <Wifi className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => reiniciarContador(p.id)}
                          className="rounded p-0.5 text-gray-300 transition-colors hover:text-gray-500"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          title="Reiniciar contador"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirTestModal(p.id)}
                          disabled={syncingModels.has(p.id) || p.modelos.length === 0}
                          className="rounded p-1 text-gray-400 hover:text-purple-600 transition-colors disabled:opacity-50"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          title="Testear modelos con prompts de prueba"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => sincronizarModelos(p.id)}
                          disabled={syncingModels.has(p.id) || testModal.enCurso && testModal.providerId === p.id}
                          className="rounded p-1 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          title="Sincronizar modelos desde el proveedor"
                        >
                          {syncingModels.has(p.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => abrirEditar(p)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarProveedor(p.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-800">Enrutamiento por módulo</h3>
        <p className="mt-1 text-xs text-gray-500">
          Asigná qué proveedor y qué modelo exacto se usa en cada módulo del QMS.
        </p>

        <div className="mt-3 space-y-2">
          {MODULOS_QMS.map((m) => {
            const ruta = routing[m.id]
            const prov = providers.find((p) => p.id === ruta?.proveedor_id)
            return (
              <div key={m.id} className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-slate-50 p-3">
                  <span className="w-40 shrink-0 text-sm font-medium text-gray-700">{m.label}</span>
                  <Select
                    value={ruta?.proveedor_id ?? ''}
                    onChange={(e) => actualizarRuta(m.id, 'proveedor_id', e.target.value)}
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.tipo})
                      </option>
                    ))}
                  </Select>
                  {!prov ? (
                    <input
                      className="w-56 rounded-md border border-gray-300 bg-gray-100 px-2.5 py-1.5 text-sm text-gray-400"
                      placeholder="Elegí un proveedor primero"
                      disabled
                    />
                  ) : (
                    <Select
                      value={ruta?.modelo_nombre ?? ''}
                      onChange={(e) => actualizarRuta(m.id, 'modelo_nombre', e.target.value)}
                    >
                      <option value="">Seleccionar modelo</option>
                      {(prov.modelos?.length ?? 0) > 0 ? (
                        prov.modelos.map((mod) => <option key={mod} value={mod}>{mod}</option>)
                      ) : (
                        <option value="" disabled>Sincronice modelos con el botón ↻</option>
                      )}
                    </Select>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirModalContexto(m.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      ruta?.system_prompt?.trim()
                        ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                        : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                    title="Definir el rol / system prompt de la IA para este módulo"
                  >
                    {ruta?.system_prompt?.trim() ? <Check className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
                    {ruta?.system_prompt?.trim() ? 'Especializado' : 'Especializar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedFallbacks(prev => {
                      const next = new Set(prev)
                      if (next.has(m.id)) next.delete(m.id)
                      else next.add(m.id)
                      return next
                    })}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Configurar proveedor de respaldo (fallback)"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expandedFallbacks.has(m.id) ? 'rotate-90' : ''}`} />
                    Respaldo
                  </button>
                </div>
                {expandedFallbacks.has(m.id) && (
                  <div className="ml-11 mt-2 pt-2 border-t border-gray-200 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs font-medium text-gray-500">Respaldo (Fallback)</span>
                      <Select
                        value={routing[m.id]?.fallback_provider_id ?? ''}
                        onChange={(e) => {
                          const newRouting = { ...routing }
                          if (!newRouting[m.id]) newRouting[m.id] = { proveedor_id: '', modelo_nombre: '', system_prompt: '' }
                          newRouting[m.id].fallback_provider_id = e.target.value
                          // Auto-seleccionar modelo fallback si el proveedor tiene exactamente 1 modelo
                          if (e.target.value) {
                            const fbProv = providers.find((p) => p.id === e.target.value)
                            if (fbProv?.modelos?.length === 1) {
                              newRouting[m.id].fallback_modelo = fbProv.modelos[0]
                            } else {
                              newRouting[m.id].fallback_modelo = ''
                            }
                          } else {
                            newRouting[m.id].fallback_modelo = ''
                          }
                          setRouting(newRouting)
                        }}
                      >
                        <option value="">Sin proveedor de respaldo</option>
                        {providers.filter(p => p.id !== routing[m.id]?.proveedor_id).map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                        ))}
                      </Select>
                      {routing[m.id]?.fallback_provider_id && (
                        <Select
                          value={routing[m.id]?.fallback_modelo ?? ''}
                          onChange={(e) => {
                            const newRouting = { ...routing }
                            if (!newRouting[m.id]) newRouting[m.id] = { proveedor_id: '', modelo_nombre: '', system_prompt: '' }
                            newRouting[m.id].fallback_modelo = e.target.value
                            setRouting(newRouting)
                          }}
                        >
                          <option value="">Seleccionar modelo</option>
                          {(() => {
                            const fallbackProvId = routing[m.id]?.fallback_provider_id
                            const fallbackProv = fallbackProvId ? providers.find(p => p.id === fallbackProvId) : null
                            if (!fallbackProv) return <option value="" disabled>Primero elegí un proveedor</option>
                            return (fallbackProv.modelos?.length ?? 0) > 0 ? (
                              fallbackProv.modelos.map((mod) => <option key={mod} value={mod}>{mod}</option>)
                            ) : (
                              <option value="" disabled>Sincronice modelos con el botón ↻</option>
                            )
                          })()}
                        </Select>
                      )}
                    </div>
                  </div>
                )}
                </div>
              )
            })}
        </div>

        <div className="mt-3">
          <Button size="sm" onClick={guardarRouting} loading={guardandoRut}>
            <Save className="h-3.5 w-3.5" /> Guardar enrutamiento
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-800">Caché de resolución de modelos</h3>
        <p className="mt-1 text-xs text-gray-500">
          Los modelos se resuelven dinámicamente desde la API de cada proveedor. Este caché evita consultas frecuentes a ListModels.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">TTL del caché:</label>
          <input
            type="number"
            min="1"
            className="w-20 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={cacheTtlValue}
            onChange={(e) => setCacheTtlValue(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <select
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={cacheTtlUnit}
            onChange={(e) => setCacheTtlUnit(e.target.value as 'minutes' | 'hours' | 'days')}
          >
            <option value="minutes">minutos</option>
            <option value="hours">horas</option>
            <option value="days">días</option>
          </select>
          <Button size="sm" onClick={guardarTtl}>
            <Save className="h-3.5 w-3.5" /> Guardar TTL
          </Button>
        </div>
      </div>

      <Modal
        open={!!modalModulo}
        onClose={() => setModalModulo(null)}
        title={`Especialización de IA para ${MODULOS_QMS.find((m) => m.id === modalModulo)?.label ?? ''}`}
        size="md"
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Rol de la IA (System Prompt)</label>
          <textarea
            rows={10}
            className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400"
            placeholder="Eres un auditor de calidad del ECA. Analizás quejas identificando riesgos ISO 9001, causas raíz y recomendaciones…"
            value={sysPrompt}
            onChange={(e) => setSysPrompt(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalModulo(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarSysPrompt}>Guardar contexto</Button>
          </div>
        </div>
      </Modal>

      {/* Modal para editar/crear proveedor con fallback - usando el Modal estándar */}
      <Modal
        open={!!editingProvider}
        onClose={cerrarEditor}
        title={editingProvider?.id && editingProvider.id !== '' ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-4">
            <h6 className="text-sm font-medium text-gray-700">Datos del Proveedor</h6>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej: Grok xAI"
                  value={editingProvider?.nombre ?? ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider!, nombre: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de API *</label>
                <div className="w-full">
                  <Select value={editingProvider?.tipo ?? 'openai'} onChange={(e) => {
                      const nuevoTipo = e.target.value as AIProviderTipo
                      setEditingProvider({ ...editingProvider!, tipo: nuevoTipo, limite_tokens: getLimitePorTipo(nuevoTipo) })
                    }}>
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Límite de Tokens</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={editingProvider?.limite_tokens ?? 100000}
                  onChange={(e) => setEditingProvider({ ...editingProvider!, limite_tokens: parseInt(e.target.value) || 100000 })}
                />
              </div>
              {editingProvider?.tipo === 'openai' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL Base (opcional)</label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="https://api.x.ai/v1"
                    value={editingProvider?.base_url ?? ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider!, base_url: e.target.value })}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Modelos Soportados *</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="ej. modelo-1, modelo-2"
                  value={(editingProvider?.modelos as string[] | undefined)?.join(', ') || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider!, modelos: e.target.value.split(',').map(m => m.trimStart()) })}
                />
                <p className="mt-1 text-xs text-gray-500">Separados por coma: modelo-1, modelo-2</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key *</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={(editingProvider?.id && editingProvider?.id !== '') ? 'password' : 'text'}
                    className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="sk-..."
                    value={editingProvider?.api_key ?? ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider!, api_key: e.target.value })}
                  />
                </div>
              </div>
          </div>

          <div className="flex items-end justify-end gap-2 pt-4 border-t border-gray-200">
            <Button size="sm" variant="secondary" onClick={cerrarEditor}>
              Cancelar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => editingProvider?.id && probarConexion(editingProvider.id)}>
              <Wifi className="h-3.5 w-3.5 mr-1" /> Probar Conexión
            </Button>
            <Button size="sm" onClick={aplicarForm}>
              <Save className="h-3.5 w-3.5 mr-1" /> {editingProvider?.id && editingProvider?.id !== '' ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </div>
        </div>
      </div>
      </Modal>

      <Modal
        open={testModal.abierto}
        onClose={cerrarTestModal}
        title={`Testear modelos — ${testModal.providerNombre}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Se probarán <strong>{testModal.modelos.length}</strong> modelos con 2 prompts (corto y largo).
            {!testModal.enCurso && !testModal.resultado && ' Presione "Iniciar test" para comenzar.'}
            {testModal.enCurso && ' El test está en curso…'}
            {testModal.resultado && (
              <span className={testModal.resultado.malos > 0 ? 'text-amber-600' : 'text-green-600'}>
                {' '}{testModal.resultado.buenos} buenos, {testModal.resultado.malos} malos de {testModal.resultado.total} probados.
              </span>
            )}
            {testModal.cancelado && ' Test cancelado por el usuario.'}
          </p>

          {testModal.enCurso && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              {Object.values(testModal.progreso).filter(v => v !== 'pendiente').length} de {testModal.modelos.length} probados
            </div>
          )}

          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: '#dee2e6', maxHeight: '50vh' }}
          >
            <div className="overflow-y-auto monday-scroll" style={{ maxHeight: 'calc(50vh - 8px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: '#343a40' }}>
                    <th className="px-3 py-2 text-left font-semibold text-white">Modelo</th>
                    <th className="px-3 py-2 text-center font-semibold text-white w-24">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {testModal.modelos.map((modelo) => {
                    const status = testModal.progreso[modelo]
                    return (
                      <tr key={modelo} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-800">{modelo}</td>
                        <td className="px-3 py-1.5 text-center">
                          {status === 'pendiente' && <span className="text-xs text-gray-400">—</span>}
                          {status === 'probando' && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <Loader2 className="h-3 w-3 animate-spin" /> Probando
                            </span>
                          )}
                          {status === 'ok' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" /> OK
                            </span>
                          )}
                          {status === 'fallo' && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <XCircle className="h-3 w-3" /> Fallo
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            {!testModal.enCurso && !testModal.resultado && (
              <Button size="sm" onClick={iniciarTest}>
                <Play className="h-3.5 w-3.5 mr-1" /> Iniciar test
              </Button>
            )}
            {testModal.enCurso && (
              <Button size="sm" variant="secondary" onClick={cancelarTest}>
                <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
            )}
            {(testModal.resultado || testModal.cancelado || (!testModal.enCurso && testModal.modelos.length > 0)) && (
              <Button size="sm" variant="secondary" onClick={cerrarTestModal}>
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

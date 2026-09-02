'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Eye, EyeOff, Loader2, Sparkles, KeyRound, Brain, Check, RotateCcw, ChevronRight, Wifi } from 'lucide-react'
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

const MODELOS_SUGERIDOS: Record<AIProviderTipo, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
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
  const [customModulos, setCustomModulos] = useState<Set<string>>(new Set())

  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await supabase
        .from('configuraciones_sistema')
        .select('clave, valor')
        .in('clave', [CLAVE_PROVEEDORES, CLAVE_ROUTING])
      if (!activo) return
      const porClave = new Map((data ?? []).map((r) => [r.clave, r.valor]))
      const provs = Array.isArray(porClave.get(CLAVE_PROVEEDORES)) ? (porClave.get(CLAVE_PROVEEDORES) as AIProvider[]) : []
      const rut = porClave.get(CLAVE_ROUTING)
      setProviders(provs)
      setRouting(rut && typeof rut === 'object' ? (rut as AIRouting) : {})
      setLoading(false)
    })()
    return () => {
      activo = false
    }
  }, [])

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

  const abrirNuevo = () =>
    setEditingProvider({ id: '', nombre: '', tipo: 'openai', base_url: '', api_key: '', modelos: [], tokens_usados: 0, limite_tokens: 100000 } as AIProvider)

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

  const aplicarForm = () => {
    if (!editingProvider) return
    const p = editingProvider
    if (!p.nombre.trim() || !p.api_key.trim()) {
      showError(null, 'Nombre y API Key son obligatorios')
      return
    }
    const modelosArray = (p.modelos as unknown as string).split(',').map((m: string) => m.trim()).filter(Boolean) as string[]
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
    persistirProveedores(nuevaLista)
    cerrarEditor()
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
    setCustomModulos((prev) => {
      const s = new Set(prev)
      s.delete(id)
      return s
    })
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

  const actualizarRuta = (
    modulo: string,
    campo: 'proveedor_id' | 'modelo_nombre' | 'system_prompt',
    valor: string,
  ) => {
    setRouting((prev) => ({ ...prev, [modulo]: { ...prev[modulo], [campo]: valor } }))
  }

  const manejarCambioModelo = (modulo: string, valor: string) => {
    if (valor === '__otro__') {
      setCustomModulos((prev) => new Set(prev).add(modulo))
      actualizarRuta(modulo, 'modelo_nombre', '')
    } else {
      setCustomModulos((prev) => {
        const s = new Set(prev)
        s.delete(modulo)
        return s
      })
      actualizarRuta(modulo, 'modelo_nombre', valor)
    }
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
                const modelos = (p.modelos ?? []).length > 0
                  ? (p.modelos as string[]).slice(0, 3).join(', ') + ((p.modelos as string[]).length > 3 ? '…' : '')
                  : '—'
                return (
                  <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-3 py-2">
                      <Badge variant="blue">{p.tipo}</Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.base_url || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-gray-600" title={(p.modelos ?? []).join(', ')}>{modelos}</span>
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
            const sugerencias = prov ? MODELOS_SUGERIDOS[prov.tipo] : []
            const esCustom = customModulos.has(m.id) || (!!ruta?.modelo_nombre && !sugerencias.includes(ruta.modelo_nombre))
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-slate-50 p-3">
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
                  <>
                    <Select
                      value={esCustom ? '__otro__' : ruta?.modelo_nombre ?? ''}
                      onChange={(e) => manejarCambioModelo(m.id, e.target.value)}
                    >
                      <option value="">Seleccionar modelo</option>
                      {sugerencias.map((mod) => (
                        <option key={mod} value={mod}>{mod}</option>
                      ))}
                      <option value="__otro__">Otro (Escribir manual)</option>
                    </Select>
                    {esCustom && (
                      <input
                        className="w-56 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                        placeholder="Modelo personalizado (ej: grok-beta)"
                        value={ruta?.modelo_nombre ?? ''}
                        onChange={(e) => actualizarRuta(m.id, 'modelo_nombre', e.target.value)}
                      />
                    )}
                  </>
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
                  <Select value={editingProvider?.tipo ?? 'openai'} onChange={(e) => setEditingProvider({ ...editingProvider!, tipo: e.target.value as AIProviderTipo })}>
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
                  placeholder="gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash"
                  value={Array.isArray(editingProvider?.modelos) ? (editingProvider?.modelos as string[]).join(', ') : ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider!, modelos: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">Separados por coma: gemini-1.5-flash, gemini-1.5-pro</p>
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
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-4">
            <h6 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ChevronRight className="h-4 w-4" /> Enrutamiento de Respaldo (Fallback)
            </h6>
            <p className="text-xs text-gray-500">Si el proveedor principal falla, se usará este respaldo automáticamente.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor Secundario</label>
                <Select
                  value={routing[editingProvider?.id ?? '']?.fallback_provider_id ?? ''}
                  onChange={(e) => {
                    const providerId = editingProvider?.id
                    if (!providerId) return
                    const newRouting = { ...routing }
                    if (!newRouting[providerId]) newRouting[providerId] = { proveedor_id: providerId, modelo_nombre: '', system_prompt: '' }
                    newRouting[providerId].fallback_provider_id = e.target.value
                    // Reset modelo secundario al cambiar proveedor
                    newRouting[providerId].fallback_modelo = ''
                    setRouting(newRouting)
                  }}
                >
                  <option value="">Sin respaldo</option>
                  {providers.filter(p => p.id !== editingProvider?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Modelo Secundario</label>
                <Select
                  value={routing[editingProvider?.id ?? '']?.fallback_modelo ?? ''}
                  onChange={(e) => {
                    const providerId = editingProvider?.id
                    if (!providerId) return
                    const newRouting = { ...routing }
                    if (!newRouting[providerId]) newRouting[providerId] = { proveedor_id: providerId, modelo_nombre: '', system_prompt: '' }
                    newRouting[providerId].fallback_modelo = e.target.value
                    setRouting(newRouting)
                  }}
                >
                  <option value="">Seleccionar modelo</option>
                  {(() => {
                    const fallbackProvId = routing[editingProvider?.id ?? '']?.fallback_provider_id
                    const fallbackProv = fallbackProvId ? providers.find(p => p.id === fallbackProvId) : null
                    if (!fallbackProv) return <option value="" disabled>Primero elegí un proveedor</option>
                    return (fallbackProv?.modelos as string[])?.map((mod) => <option key={mod} value={mod}>{mod}</option>) || <option value="" disabled>Sin modelos</option>
                  })()}
                </Select>
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
      </Modal>
    </div>
  )
}

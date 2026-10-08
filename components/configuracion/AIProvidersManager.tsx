'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Save } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { apiFetch } from '@/lib/services/apiClient'
import { cargarConfigIA, guardarConfigIA, guardarProveedoresIA, modelosIA, conectarIA, limpiarMemoriaIA, modelosSinFallos } from '@/lib/services/aiConfigService'
import { esOpenRouter } from '@/lib/ai/providerDisplay'
import { MODULOS_IA } from '@/lib/constants/modulos'
import { showError, showSuccess } from '@/lib/services/errorToast'
import type { AIProvider, AIRouting, ModeloTestResultado } from '@/lib/ai/types'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import ErrorState from '@/components/ui/ErrorState'
import AIProviderList from '@/components/configuracion/AIProviderList'
import ProviderEditorModal from '@/components/configuracion/ia/ProviderEditorModal'
import ModelTestModal from '@/components/configuracion/ia/ModelTestModal'
import ModuleRoutingEditor from '@/components/configuracion/ia/ModuleRoutingEditor'
import type { EditingProvider, ModelTestState } from '@/components/configuracion/ia/types'
import { limitePorTipo, modelosDelEditor } from '@/components/configuracion/ia/configuracion'
import { cambiarRutaIA, type CampoRutaIA } from '@/components/configuracion/ia/routing'

const CLAVE_ROUTING = 'ai_routing'

export default function AIProvidersManager() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [routing, setRouting] = useState<AIRouting>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [guardandoRut, setGuardandoRut] = useState(false)
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)
  const guardandoProveedorRef = useRef(false)

const [editingProvider, setEditingProvider] = useState<EditingProvider | null>(null)
  const [modalModulo, setModalModulo] = useState<string | null>(null)
  const [sysPrompt, setSysPrompt] = useState('')
  const providersRevisionRef = useRef('')
  const savingProvidersRef = useRef(false)
  const [expandedFallbacks, setExpandedFallbacks] = useState<Set<string>>(new Set())
  const [syncingModels, setSyncingModels] = useState<Set<string>>(new Set())
  const [cacheTtlValue, setCacheTtlValue] = useState<number>(1)
  const [cacheTtlUnit, setCacheTtlUnit] = useState<'minutes' | 'hours' | 'days'>('days')
  const [testModal, setTestModal] = useState<ModelTestState>({
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
  useEffect(() => () => {
    testAbortRef.current?.abort()
    testAbortRef.current = null
  }, [])

  useEffect(() => {
    let activo = true
    const controller = new AbortController()
    ;(async () => {
      const config = await cargarConfigIA(controller.signal)
      if (!activo) return
      setLoadError(false)
      const provs=config.providers
      const rut=config.routing
      const ttlMinutes=config.ttl
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
      providersRevisionRef.current = config.revision
      setProviders(provs)
      setRouting(rut && typeof rut === 'object' ? (rut as AIRouting) : {})
      setCacheTtlValue(value)
      setCacheTtlUnit(unit)
      setLoading(false)
    })().catch(() => { if (activo) { setLoadError(true); setLoading(false) } })
    return () => {
      activo = false
      controller.abort()
    }
  }, [loadVersion])

  const providersRef = useRef(providers)
  const routingRef = useRef(routing)
  useEffect(() => { providersRef.current = providers }, [providers])
  useEffect(() => { routingRef.current = routing }, [routing])

  useEffect(() => {
    if (loading || providersRef.current.length === 0) return
    let cancelado = false
    const expectedRevision = providersRevisionRef.current
    ;(async () => {
      const openRouterProviders = providersRef.current.filter((p) => esOpenRouter(p))
      if (openRouterProviders.length === 0) return

      // Acumular cambios en variables locales y aplicar setState una sola vez al final,
      // evitando el lost-update entre múltiples proveedores OpenRouter.
      let listaLimpia: AIProvider[] | null = null
      let routingLimpio: AIRouting | null = null

      for (const p of openRouterProviders) {
        if (!p.modelos.some((m) => m.startsWith('~') || /:paid|:premium/i.test(m))) continue
        try {
          const resultado = await modelosIA(p.id)
          if (cancelado) return
          if (resultado.modelos.length > 0) {
            listaLimpia = (listaLimpia ?? providersRef.current).map((pr) => (pr.id === p.id ? { ...pr, modelos: resultado.modelos } : pr))
            const nuevoRouting: AIRouting = { ...(routingLimpio ?? routingRef.current) }
            let routingCambiado = false
            for (const m of Object.keys(nuevoRouting)) {
              if (nuevoRouting[m]?.proveedor_id === p.id && !resultado.modelos.includes(nuevoRouting[m].modelo_nombre)) {
                nuevoRouting[m] = { ...nuevoRouting[m], modelo_nombre: resultado.modelos[0] }
                routingCambiado = true
              }
            }
            if (routingCambiado) routingLimpio = nuevoRouting
          }
        } catch {
          // Silenciar errores de auto-cleanup
        }
      }

      if (cancelado) return
      if (listaLimpia) {
        const saved = await guardarProveedoresIA(listaLimpia, expectedRevision)
        if (!cancelado) { providersRevisionRef.current = saved.revision; providersRef.current = saved.valor; setProviders(saved.valor) }
      }
      if (routingLimpio) {
        await guardarConfigIA(CLAVE_ROUTING, routingLimpio)
        if (!cancelado) setRouting(routingLimpio)
      }
    })().catch(error => { if (!cancelado) showError(error, 'No se pudo actualizar la lista de modelos') })
    return () => { cancelado = true }
  }, [loading])

  const upsertClave = async (clave:string,valor:unknown) => { await guardarConfigIA(clave,valor) }
  const persistirProveedores = async (lista: AIProvider[], resetTokens: string[] = [], expectedRevision = providersRevisionRef.current) => {
    if (savingProvidersRef.current) return false
    savingProvidersRef.current = true
    try {
      const saved = await guardarProveedoresIA(lista, expectedRevision, resetTokens)
      providersRevisionRef.current = saved.revision
      providersRef.current = saved.valor
      setProviders(saved.valor)
      showSuccess('Proveedor de IA guardado')
      return true
    } catch (error) {
      showError(error as Error, 'No se pudo guardar el proveedor')
      return false
    } finally { savingProvidersRef.current = false }
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

  const getLimitePorTipo = limitePorTipo

  const abrirNuevo = () =>
    setEditingProvider({ id: '', nombre: '', tipo: 'openai', base_url: '', api_key: '', modelos: [], tokens_usados: 0, limite_tokens: getLimitePorTipo('openai') } as AIProvider)

  const abrirEditar = (p: AIProvider) =>
    setEditingProvider(p)

  const cerrarEditor = () => { if (!guardandoProveedorRef.current) setEditingProvider(null) }

  const probarConexion = async (providerId?:string) => {
    const provider=providerId?providers.find(value=>value.id===providerId):editingProvider
    if(!provider)return
    try { await conectarIA({...provider,modelos:modelosDelEditor(provider.modelos)});showSuccess('Conexión exitosa') }
    catch(error){showError(error as Error,'No se pudo conectar con el proveedor')}
  }

  const aplicarForm = async () => {
    if (!editingProvider || guardandoProveedorRef.current) return
    const p = editingProvider
    if (!p.nombre.trim() || (!p.api_key.trim() && !p.has_api_key)) {
      showError(null, 'Nombre y una clave configurada son obligatorios')
      return
    }
    const modelosArray = modelosDelEditor(p.modelos)
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
    guardandoProveedorRef.current = true
    setGuardandoProveedor(true)
    try {
      if (!await persistirProveedores(nuevaLista)) return
      setEditingProvider(null)

      const savedRevision = providersRevisionRef.current
      const savedList = providersRef.current
      const savedId = p.id && p.id !== '' ? p.id : nuevaLista[nuevaLista.length - 1].id
      const savedProvider = nuevaLista.find(pr => pr.id === savedId)
      if (savedProvider && savedProvider.modelos.length === 0) {
        try {
          const resultado = await modelosIA(savedId)
          if (resultado.modelos.length > 0) {
            const listaFinal = savedList.map(pr =>
              pr.id === savedId ? { ...pr, modelos: resultado.modelos } : pr
            )
            if (await persistirProveedores(listaFinal, [], savedRevision)) {
              showSuccess(`${resultado.modelos.length} modelos sincronizados automáticamente para ${savedProvider.nombre}`)
            }
          }
        } catch {
          // Silenciar errores de auto-sync
        }
      }
    } finally { guardandoProveedorRef.current = false; setGuardandoProveedor(false) }
  }

  const eliminarProveedor = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor? Los módulos que lo usen dejarán de funcionar hasta reasignarlos.')) return
    const nuevaLista = providers.filter((p) => p.id !== id)
    const nuevoRouting = { ...routing }
    for (const m of Object.keys(nuevoRouting)) {
      if (nuevoRouting[m]?.proveedor_id === id) delete nuevoRouting[m]
    }
    if (!await persistirProveedores(nuevaLista)) return
    try {
      await upsertClave(CLAVE_ROUTING, nuevoRouting)
      setRouting(nuevoRouting)
    } catch (e) {
      showError(e as Error, 'No se pudo actualizar el enrutamiento')
    }
  }

  const reiniciarContador = async (id: string) => {
    const nuevaLista = providers.map((p) => (p.id === id ? { ...p, tokens_usados: 0 } : p))
    await persistirProveedores(nuevaLista, [id])
  }

  const sincronizarModelos = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    const expectedRevision = providersRevisionRef.current
    setSyncingModels(prev => new Set(prev).add(providerId))
    try {
      const resultado = await modelosIA(providerId)

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
        modelosFinales = await modelosSinFallos(providerId, resultado.modelos)
        excluidosPorTest = resultado.modelos.length - modelosFinales.length
      } catch {
        // Sin test previo o error, usar todos
      }

      const nuevaLista = providers.map(p =>
        p.id === providerId ? { ...p, modelos: modelosFinales } : p
      )
      if (!await persistirProveedores(nuevaLista, [], expectedRevision)) return

      try {
        await limpiarMemoriaIA(providerId, modelosFinales)
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
          await upsertClave(CLAVE_ROUTING, nuevoRouting)
          setRouting(nuevoRouting)
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
    if (!testModal.providerId || testAbortRef.current) return
    const provider = providers.find(p => p.id === testModal.providerId)
    if (!provider) return

    const expectedRevision = providersRevisionRef.current
    const abortController = new AbortController()
    testAbortRef.current = abortController

    const initial: { [modelo: string]: 'pendiente' | 'probando' | 'ok' | 'fallo' } = {}
    for (const m of provider.modelos) initial[m] = 'pendiente'

    setTestModal(prev => ({ ...prev, enCurso: true, cancelado: false, progreso: initial, resultado: null }))

    try {

      const modelos = provider.modelos.slice(0, 20)
      const resultados: ModeloTestResultado[] = []

      for (const modelo of modelos) {
        if (abortController.signal.aborted) break
        setTestModal(prev => ({ ...prev, progreso: { ...prev.progreso, [modelo]: 'probando' } }))
        try {
          const res = await apiFetch('/api/ai/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId: testModal.providerId, modelo }),
            signal: abortController.signal,
          })
          const json = await res.json().catch(() => null)
          if (!res.ok) throw new Error(json?.error || 'Error al probar el modelo')
          if (abortController.signal.aborted || testAbortRef.current !== abortController) break
          const r = json as ModeloTestResultado
          resultados.push(r)
          setTestModal(prev => ({ ...prev, progreso: { ...prev.progreso, [modelo]: r.ok ? 'ok' : 'fallo' } }))
        } catch (e) {
          if (abortController.signal.aborted) break
          resultados.push({ modelo, ok: false, latenciaMs: null, error: e instanceof Error ? e.message : String(e) })
          setTestModal(prev => ({ ...prev, progreso: { ...prev.progreso, [modelo]: 'fallo' } }))
        }
      }

      if (testAbortRef.current !== abortController) return
      abortController.signal.throwIfAborted()
      if (resultados.length > 0) {
        await guardarConfigIA('ai_test_resultado_'+testModal.providerId,{timestamp:Date.now(),resultados})
      }

      if (testAbortRef.current !== abortController) return
      const buenos = resultados.filter(r => r.ok).length
      const malos = resultados.filter(r => !r.ok).length

      const modelosOk = resultados.filter(r => r.ok).map(r => r.modelo)
      const modelosProbados = new Set(resultados.map(r => r.modelo))
      const nuevosModelos = provider.modelos.filter(m => !modelosProbados.has(m) || modelosOk.includes(m))

      if (nuevosModelos.length > 0) {
        const nuevaLista = providers.map(pr =>
          pr.id === testModal.providerId ? { ...pr, modelos: nuevosModelos } : pr
        )
        if (!await persistirProveedores(nuevaLista, [], expectedRevision)) return
      }

      setTestModal(prev => ({
        ...prev,
        enCurso: false,
        resultado: { buenos, malos, total: resultados.length },
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
      if (testAbortRef.current === abortController) {
        testAbortRef.current = null
        setTestModal(prev => ({ ...prev, enCurso: false }))
      }
    }
  }

  const cancelarTest = () => {
    testAbortRef.current?.abort()
  }

  const actualizarRuta = (modulo: string, campo: CampoRutaIA, valor: string) => {
    setRouting(previous => cambiarRutaIA(previous, modulo, campo, valor, providers))
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
    return <LoadingSkeleton variant="cards" label="Cargando proveedores de IA…" />
  }
  if (loadError) return <ErrorState message="No se pudo cargar la configuración de IA." onRetry={() => { setLoading(true); setLoadVersion(version => version + 1) }} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-qms-dark">Proveedores de IA</h3>
        <span className="text-sm text-qms-muted">Conectá un proveedor, seleccioná un modelo y definí un respaldo para cada módulo.</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button disabled={guardandoProveedor} onClick={abrirNuevo}>
          <Plus className="h-3.5 w-3.5" /> Nuevo proveedor
        </Button>
        <span className="text-xs text-qms-muted">Los cambios se guardan automáticamente al agregar o eliminar.</span>
      </div>

      <AIProviderList
        providers={providers}
        syncingModels={syncingModels}
        testProviderId={testModal.providerId}
        testInProgress={testModal.enCurso}
        testProgress={testModal.progreso}
        onTest={abrirTestModal}
        onSync={sincronizarModelos}
        onEdit={abrirEditar}
        onDelete={eliminarProveedor}
        onConnect={probarConexion}
        onReset={reiniciarContador}
      />

      <ModuleRoutingEditor providers={providers} routing={routing} expandedFallbacks={expandedFallbacks} setExpandedFallbacks={setExpandedFallbacks} actualizarRuta={actualizarRuta} abrirModalContexto={abrirModalContexto} guardandoRut={guardandoRut} guardarRouting={guardarRouting} />

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
            className="ui-field w-20 px-2.5 py-1.5 text-sm"
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
        title={`Especialización de IA para ${MODULOS_IA.find((m) => m.id === modalModulo)?.label ?? ''}`}
        size="md"
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Rol de la IA (System Prompt)</label>
          <textarea
            rows={10}
            className="ui-textarea w-full resize-y px-3 py-2 text-sm transition-colors placeholder:text-gray-400"
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

      <ProviderEditorModal editingProvider={editingProvider} setEditingProvider={setEditingProvider} guardandoProveedor={guardandoProveedor} cerrarEditor={cerrarEditor} probarConexion={probarConexion} aplicarForm={aplicarForm} />

      <ModelTestModal testModal={testModal} cerrarTestModal={cerrarTestModal} iniciarTest={iniciarTest} cancelarTest={cancelarTest} />
    </div>
  )
}

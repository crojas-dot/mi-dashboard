import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'
import { createClient } from '@supabase/supabase-js'

const clone = value => JSON.parse(JSON.stringify(value))
const filtros = { fechaDesde: '', fechaHasta: '', estado: '', prioridad: '', tipo: '' }

function lecturas(tables = {}, failures = {}) {
  const calls = []
  const supabase = { from(table) {
    const call = { table, filters: [], start: 0, end: Infinity }
    calls.push(call)
    const predicates = []
    const query = {
      select(columns, options) { call.columns = columns; call.options = options; return query },
      eq(column, value) { call.filters.push(['eq', column, value]); predicates.push(row => row[column] === value); return query },
      gte(column, value) { call.filters.push(['gte', column, value]); predicates.push(row => String(row[column]) >= value); return query },
      lt(column, value) { call.filters.push(['lt', column, value]); predicates.push(row => String(row[column]) < value); return query },
      or(value) { call.active = value; predicates.push(row => row.activo == null || row.activo === true); return query },
      order(column) { call.order = column; return query },
      range(start, end) { call.start = start; call.end = end; return query },
      abortSignal(signal) { call.signal = signal; return query },
      then(resolve, reject) {
        const rows = (tables[table] ?? []).filter(row => predicates.every(filter => filter(row)))
          .sort((a, b) => String(a[call.order]).localeCompare(String(b[call.order])))
        return Promise.resolve({ data: rows.slice(call.start, call.end + 1), count: rows.length, error: failures[call.start] ?? null }).then(resolve, reject)
      },
    }
    return query
  } }
  return { calls, ...loadModule('app/reporteria/components/generador/consultas.ts', { '@/lib/supabase': { supabase } }) }
}

test('fechas filtran el día final completo, incluida la transición de febrero bisiesto', async () => {
  const rows = [
    { id: 'a', fecha: '2024-02-28T23:59:00Z', estado: 'Recibido', prioridad: 'Alta' },
    { id: 'b', fecha: '2024-02-29T23:59:59Z', estado: 'Recibido', prioridad: 'Alta' },
    { id: 'c', fecha: '2024-03-01T00:00:00Z', estado: 'Recibido', prioridad: 'Alta' },
    { id: 'd', fecha: '2024-02-29T12:00:00Z', estado: 'Recibido', prioridad: 'Baja' },
  ]
  const api = lecturas({ quejas: rows })
  const result = await api.fetchFilasInforme('quejas', { ...filtros, fechaDesde: '2024-02-29', fechaHasta: '2024-02-29', estado: 'Recibido', prioridad: 'Alta' })
  assert.deepEqual(clone(result.map(row => row.id)), ['b'])
  assert.deepEqual(api.calls[0].filters, [['gte', 'fecha', '2024-02-29'], ['lt', 'fecha', '2024-03-01'], ['eq', 'estado', 'Recibido'], ['eq', 'prioridad', 'Alta']])
})

test('lectura por lotes conserva todas las filas de un informe de 5000, con orden estable', async () => {
  const rows = Array.from({ length: 5000 }, (_, index) => ({ id: String(index).padStart(5, '0'), estado: 'Abierto' })).reverse()
  const api = lecturas({ acciones: rows })
  const result = await api.fetchFilasInforme('sacp', filtros)
  assert.equal(result.length, 5000)
  assert.equal(new Set(result.map(row => row.id)).size, 5000)
  assert.equal(result[0].id, '00000')
  assert.equal(result.at(-1).id, '04999')
  assert.equal(api.calls.length, 10)
  assert.ok(api.calls.every(call => call.order === 'id' && call.end - call.start + 1 === 500))
  assert.deepEqual(api.calls.map(call => call.start), [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500])
})

test('un informe superior al tope y un fallo en un lote no devuelven datos truncados', async () => {
  const rows = Array.from({ length: 5001 }, (_, index) => ({ id: String(index), estado: 'Abierto' }))
  const excessive = lecturas({ quejas: rows })
  await assert.rejects(excessive.fetchFilasInforme('quejas', filtros), /supera 5000/)
  assert.equal(excessive.calls.length, 1)
  const failed = lecturas({ quejas: rows.slice(0, 501) }, { 500: new Error('synthetic-network-error') })
  await assert.rejects(failed.fetchFilasInforme('quejas', filtros), /synthetic-network-error/)
  assert.equal(failed.calls.length, 2)
})

test('cada módulo conserva su tabla/fecha y prioridad solo filtra Quejas', async () => {
  const expected = {
    quejas: ['quejas', 'fecha'], sacp: ['acciones', 'fecha_apertura'], documentos: ['documentos', 'created_at'],
    riesgos: ['riesgos', 'fecha_identificacion'], auditorias: ['auditorias', 'fecha_inicio'], revision_direccion: ['reuniones', 'fecha_programada'],
  }
  for (const [modulo, [table, fecha]] of Object.entries(expected)) {
    const api = lecturas()
    await api.fetchFilasInforme(modulo, { ...filtros, fechaDesde: '2026-10-01', fechaHasta: '2026-10-07', prioridad: 'Alta', tipo: 'Interna' })
    assert.equal(api.calls[0].table, table)
    assert.deepEqual(api.calls[0].filters.slice(0, 2), [['gte', fecha, '2026-10-01'], ['lt', fecha, '2026-10-08']])
    assert.equal(api.calls[0].filters.some(filter => filter[1] === 'prioridad'), modulo === 'quejas')
    assert.ok(api.calls[0].filters.some(filter => filter[1] === 'tipo'))
  }
})

test('catálogos conservan activos/NULL, orden y scope de cada selector sin leer todo al abrir', async () => {
  const api = lecturas({ catalogos: [
    { valor: 'Recibido', color: 'blue', tipo: 'estado_queja', modulo: 'quejas', activo: true, orden: 1 },
    { valor: 'Legacy', color: 'gray', tipo: 'estado_queja', modulo: 'quejas', activo: null, orden: 2 },
    { valor: 'Oculto', color: 'gray', tipo: 'estado_queja', modulo: 'quejas', activo: false, orden: 3 },
    { valor: 'Alta', color: 'orange', tipo: 'prioridad', modulo: 'quejas', activo: true, orden: 1 },
    { valor: 'Ajeno', color: 'gray', tipo: 'estado_sacp', modulo: 'sacp', activo: true, orden: 1 },
  ] })
  const result = await api.fetchCatalogosInforme('quejas')
  assert.deepEqual(clone(result.estados.map(row => row.valor)), ['Recibido', 'Legacy'])
  assert.deepEqual(clone(result.prioridades.map(row => row.valor)), ['Alta'])
  assert.deepEqual(clone(result.tipos), [])
  assert.equal(api.calls.length, 2)
  assert.ok(api.calls.every(call => call.active === 'activo.is.null,activo.eq.true' && call.order === 'orden'))
  const none = lecturas()
  await none.fetchCatalogosInforme('revision_direccion')
  assert.equal(none.calls.length, 0)
})

test('formato y vencidos conservan fechas locales, resumen y exclusiones históricas', () => {
  const format = loadModule('app/reporteria/components/generador/formato.ts')
  const rows = [
    { id: '1', estado: 'Abierto', categoria: 'A', fecha_sla: '2026-10-01' },
    { id: '2', estado: 'Cerrada', categoria: 'A', fecha_sla: '2026-10-01' },
    { id: '3', estado: 'Finalizado', categoria: '', fecha_sla: '2026-10-01' },
    { id: '4', estado: 'No Procede', categoria: '', fecha_sla: '2026-10-01' },
    { id: '5', estado: 'Abierto', categoria: '', fecha_sla: '2026-11-01' },
  ]
  assert.deepEqual(clone(format.filtrarVencidos(rows, 'fecha_sla', new Date('2026-10-07T12:00:00Z')).map(row => row.id)), ['1'])
  assert.deepEqual(clone(format.contarEstados(rows)), { Abierto: 2, Cerrada: 1, Finalizado: 1, 'No Procede': 1 })
  assert.deepEqual(clone(format.contarDistribucion(rows, 'categoria')), { A: 2, 'Sin asignar': 3 })
  assert.equal(format.cellValue({ descripcion: 'x'.repeat(61) }, 'descripcion'), 'x'.repeat(60) + '…')
  assert.equal(format.cellValue({ impacto: 0 }, 'impacto'), '0')
  assert.equal(format.cellValue({ valor: '' }, 'valor'), '—')
  const date = '2026-10-07T01:00:00Z'
  assert.equal(format.cellValue({ fecha: date }, 'fecha'), new Date(date).toLocaleDateString('es-ES'))
})

test('vista de impresión escapa filas como texto y conserva controles y estado sin registros', () => {
  const { default: Vista } = loadModule('app/reporteria/components/generador/VistaPreviaInforme.tsx')
  const props = { modulo: 'quejas', incluir: { tabla: true, resumen: false, distribucion: false, vencidos: false }, fechaDesde: '', fechaHasta: '', loading: false, setPaso() {}, onClose() {} }
  const html = renderToStaticMarkup(createElement(Vista, { ...props, resultados: [{ id: 'fixture', estado: 'Recibido', cliente_nombre: '<img src=x onerror=alert(1)>', folio: 'F-1' }] }))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.doesNotMatch(html, /<img|<script|dangerouslySetInnerHTML/)
  assert.match(html, /no-print/)
  assert.match(html, /Imprimir/)
  assert.match(html, /Cerrar/)
  assert.match(html, /Informe de Quejas/)
  const empty = renderToStaticMarkup(createElement(Vista, { ...props, resultados: [] }))
  assert.match(empty, /colSpan="6"|colspan="6"/)
  assert.match(empty, /Sin registros/)
})

test('modal cerrado no monta estado o lecturas; el key conserva reinicio de borrador por módulo', () => {
  let mounted = 0
  const { default: Modal } = loadModule('app/reporteria/components/GeneradorInformeModal.tsx', {
    '@/lib/supabase': { supabase: {} },
    '@/app/reporteria/components/generador/useGeneradorInforme': { useGeneradorInforme() { mounted++; throw new Error('No debe montar') } },
  })
  assert.equal(Modal({ open: false, onClose() {}, moduloInicial: 'quejas' }), null)
  assert.equal(mounted, 0)
  assert.equal(Modal({ open: true, onClose() {}, moduloInicial: 'quejas' }).key, 'quejas')
  assert.equal(Modal({ open: true, onClose() {}, moduloInicial: null }).key, 'nuevo')
})

test('generación mantiene filtros y borrador tras fallo y publica resultados solo al terminar', async () => {
  const slots = [], effects = [], reads = [], errors = []
  let cursor = 0, rejectRows, resolveRows
  const { useGeneradorInforme } = loadModule('app/reporteria/components/generador/useGeneradorInforme.ts', {
    react: {
      useState: initial => {
        const index = cursor++
        if (!(index in slots)) slots[index] = initial
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
      },
      useEffect: callback => effects.push(callback),
      useLayoutEffect() {},
      useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    },
    './consultas': {
      fetchCatalogosInforme: async modulo => { reads.push(['catalogos', modulo]); return { estados: [], prioridades: [], tipos: [] } },
      fetchFilasInforme: (modulo, filters) => {
        reads.push(['filas', modulo, clone(filters)])
        return new Promise((resolve, reject) => { resolveRows = resolve; rejectRows = reject })
      },
    },
    '@/lib/services/errorToast': { showError: (error, fallback) => errors.push([error.message, fallback]) },
  })
  const useResult = () => { cursor = 0; effects.length = 0; return useGeneradorInforme(null) }
  let state = useResult()
  for (const effect of effects) effect()
  assert.equal(reads.length, 0, 'paso de selección no consulta catálogos')
  state.setModulo('quejas'); state.setPaso(2); state.setFechaDesde('2026-10-01'); state.setFilterPrioridad('Alta')
  state = useResult()
  const failed = state.generarInforme()
  state = useResult()
  assert.equal(state.loading, true)
  assert.equal(state.paso, 2)
  assert.equal(state.resultados.length, 0)
  rejectRows(new Error('synthetic-network-error'))
  await failed
  state = useResult()
  assert.equal(state.loading, false)
  assert.equal(state.paso, 2)
  assert.equal(state.fechaDesde, '2026-10-01')
  assert.equal(state.filterPrioridad, 'Alta')
  assert.equal(errors.length, 1)
  const success = state.generarInforme()
  resolveRows([{ id: 'fixture', estado: 'Recibido' }])
  await success
  state = useResult()
  assert.equal(state.paso, 3)
  assert.equal(state.loading, false)
  assert.deepEqual(clone(state.resultados), [{ id: 'fixture', estado: 'Recibido' }])
  assert.deepEqual(reads.filter(read => read[0] === 'filas').map(read => read[2].prioridad), ['Alta', 'Alta'])
})

function reportSdk(fetch) {
  return createClient('https://qms.test', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  })
}

test('un fallo de catálogos conserva el error remoto en vez de convertirlo en filtros vacíos', async () => {
  const supabase = reportSdk(async () => Response.json({ code: '42501', message: 'denegado' }, { status: 403 }))
  const { fetchCatalogosInforme } = loadModule('app/reporteria/components/generador/consultas.ts', { '@/lib/supabase': { supabase } })
  await assert.rejects(fetchCatalogosInforme('quejas'), error => error.code === '42501')
})

test('cancelar catálogos o filas aborta su transporte real; un aborto entre lotes no inicia el siguiente', async () => {
  for (const read of ['catalogos', 'filas']) {
    const requests = []
    const supabase = reportSdk((_url, options) => new Promise((_resolve, reject) => {
      requests.push(options)
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const api = loadModule('app/reporteria/components/generador/consultas.ts', { '@/lib/supabase': { supabase } })
    const controller = new AbortController()
    const pending = read === 'catalogos'
      ? api.fetchCatalogosInforme('quejas', controller.signal)
      : api.fetchFilasInforme('quejas', filtros, controller.signal)
    await new Promise(setImmediate)
    assert.ok(requests.length > 0)
    assert.ok(requests.every(options => options.signal === controller.signal))
    controller.abort()
    await assert.rejects(pending)
    assert.ok(requests.every(options => options.signal.aborted))
  }
  const controller = new AbortController()
  let requests = 0
  const supabase = reportSdk(async () => {
    requests++
    controller.abort()
    return Response.json(Array.from({ length: 500 }, (_, index) => ({ id: String(index) })), {
      headers: { 'Content-Range': '0-499/1000' },
    })
  })
  const api = loadModule('app/reporteria/components/generador/consultas.ts', { '@/lib/supabase': { supabase } })
  await assert.rejects(api.fetchFilasInforme('quejas', filtros, controller.signal), error => error.name === 'AbortError')
  assert.equal(requests, 1)
})

function reportHarness() {
  const slots = [], pendingEffects = new Map(), requests = [], toasts = [], warnings = []
  let cursor = 0, changed = false, state
  const effect = (callback, deps) => {
    const index = cursor++
    const previous = slots[index]
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pendingEffects.set(index, { callback, deps })
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; changed = true }
      }]
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useEffect: effect,
    useLayoutEffect: effect,
  }
  function request(kind, modulo, signal, filters) {
    let resolve, reject
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
    requests.push({ kind, modulo, signal, filters, resolve, reject })
    return promise
  }
  const { useGeneradorInforme: reportHook } = loadModule('app/reporteria/components/generador/useGeneradorInforme.ts', {
    react,
    './consultas': {
      fetchCatalogosInforme: (modulo, signal) => request('catalogos', modulo, signal),
      fetchFilasInforme: (modulo, filters, signal) => request('filas', modulo, signal, clone(filters)),
    },
    sonner: { toast: { error: message => toasts.push(message) } },
  }, { console: { warn: (...args) => warnings.push(args) } })
  function render() {
    do {
      changed = false
      cursor = 0
      state = reportHook(null)
      for (const [index, { callback, deps }] of pendingEffects) {
        slots[index]?.cleanup?.()
        slots[index] = { deps, cleanup: callback() }
      }
      pendingEffects.clear()
    } while (changed)
    return state
  }
  return {
    requests, toasts, warnings, render,
    select(modulo) { state.setModulo(modulo); state.setPaso(2); return render() },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}
const flushReport = () => new Promise(setImmediate)

test('catálogos tardíos de A → B → A no sustituyen los filtros de la visita vigente', async () => {
  const view = reportHarness()
  view.render(); view.select('quejas'); view.select('sacp'); view.select('quejas')
  assert.equal(view.requests[0].signal.aborted, true)
  assert.equal(view.requests[1].signal.aborted, true)
  view.requests[2].resolve({ estados: [{ valor: 'Actual', color: 'blue' }], prioridades: [], tipos: [] })
  await flushReport()
  view.requests[0].resolve({ estados: [{ valor: 'Anterior', color: 'gray' }], prioridades: [], tipos: [] })
  view.requests[1].reject(new Error('Fallo tardío'))
  await flushReport()
  assert.deepEqual(clone(view.render().catalogoEstados), [{ valor: 'Actual', color: 'blue' }])
  assert.equal(view.toasts.length, 0)
  view.unmount()
})

test('fallo de catálogos se muestra seguro; el borrador se conserva y cerrar ignora errores posteriores', async () => {
  const view = reportHarness()
  let state = view.render(); state = view.select('quejas')
  state.setFechaDesde('2026-10-01'); state.setFilterPrioridad('Alta')
  view.requests[0].reject({ code: '42501', message: 'select private from source', details: 'https://private.test' })
  await flushReport()
  state = view.render()
  assert.equal(state.fechaDesde, '2026-10-01')
  assert.equal(state.filterPrioridad, 'Alta')
  assert.deepEqual(view.toasts, ['Tu usuario no tiene permiso para esta operación.'])
  assert.doesNotMatch(JSON.stringify(view.toasts.concat(view.warnings)), /private|select/)
  view.select('sacp'); view.unmount()
  assert.equal(view.requests[1].signal.aborted, true)
  view.requests[1].reject(new Error('Fallo tras cerrar'))
  await flushReport()
  assert.equal(view.toasts.length, 1)
})

test('generación bloquea doble envío, cancela la visita anterior y no finaliza la operación nueva', async () => {
  const view = reportHarness()
  let state = view.render(); state = view.select('quejas')
  const first = state.generarInforme()
  await state.generarInforme()
  assert.equal(view.requests.filter(request => request.kind === 'filas').length, 1)
  state = view.select('sacp')
  const current = state.generarInforme()
  const rows = view.requests.filter(request => request.kind === 'filas')
  assert.equal(rows[0].signal.aborted, true)
  rows[0].reject(new Error('Fallo anterior'))
  await first
  state = view.render()
  assert.equal(state.loading, true)
  assert.equal(state.paso, 2)
  assert.equal(view.toasts.length, 0)
  rows[1].resolve([{ id: 'actual', estado: 'Abierta' }])
  await current
  state = view.render()
  assert.equal(state.loading, false)
  assert.equal(state.paso, 3)
  assert.deepEqual(clone(state.resultados), [{ id: 'actual', estado: 'Abierta' }])
  view.unmount()
})

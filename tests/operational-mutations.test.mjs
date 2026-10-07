import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const cases = [
  ['app/procesos/components/NuevoProcesoModal.tsx', 'procesos', { nombre_proceso: '  Proceso A  ', tipo: 'Estratégico', objetivo: '  Objetivo  ' }],
  ['app/auditorias/components/NuevaAuditoriaModal.tsx', 'auditorias', { folio: '  AUD-2026-1  ', tipo: 'Interna', objetivo: '', alcance: '', proceso_area: '', fecha_inicio: '2026-10-07', fecha_fin: '2026-10-08' }],
  ['app/riesgos/components/NuevoRiesgoModal.tsx', 'riesgos', { folio: '  RIESGO-2026-1  ', tipo: 'Riesgo Operativo', categoria: '', descripcion: '', causa: '', efecto: '', probabilidad: 1, impacto: 2, accion_mitigacion: '' }],
  ['app/revision/components/NuevaReunionModal.tsx', 'reuniones', { titulo: '  Reunión A  ', tipo: 'Revisión por Dirección', fecha_programada: '2026-10-07', participantes: '', agenda: '' }],
  ['app/sacp/components/NuevaSACPModal.tsx', 'acciones', { folio: '  SACP-2026-1  ', tipo: 'Correctiva', descripcion: '', fecha_limite: '' }],
  ['app/documentos/components/NuevoDocumentoModal.tsx', 'documentos', { codigo_doc: '  PR-001  ', titulo: '  Procedimiento A  ' }],
]

function modalHarness(file, values, options = {}) {
  const slots = [], requests = [], errors = [], successes = [], logs = []
  let cursor = 0, tree, closes = 0, created = 0, folios = 0
  const state = initial => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
  }
  const { default: Modal } = loadModule(file, {
    react: { useState: state, useRef: current => state({ current })[0] },
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Select': { default: 'Select' },
    '@/components/ui/Badge': { default: 'Badge' },
    '@/lib/supabase': { supabase: { from: table => ({ insert: payload =>
      new Promise((resolve, reject) => requests.push({ table, payload, resolve, reject })) }) } },
    '@/lib/services/folioService': { generarFolio: async () => {
      folios++
      if (options.folioError) throw options.folioError
      return options.folio ?? 'AUTO-2026-1'
    } },
    sonner: { toast: { error: message => errors.push(message), success: message => successes.push(message) } },
  }, { console: { warn: (...args) => logs.push(args), log: record => logs.push(record) } })
  const props = { open: true, onClose: () => closes++, onCreated() {
    created++
    if (options.onCreatedError) throw options.onCreatedError
  } }
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const render = () => { cursor = 0; tree = Modal(props); return tree }
  const nodes = () => visit(tree)
  render()
  slots[0] = { ...values }
  render()
  return { requests, errors, successes, logs, render,
    submit: () => nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }),
    close: () => tree.props.onClose(),
    state: () => ({ form: slots[0], loading: slots[1], error: slots[2], closes, created, folios }),
    alert: () => nodes().find(node => node.props.role === 'alert'),
    values(next) { slots[0] = { ...slots[0], ...next }; render() },
  }
}

for (const [file, table, values] of cases) {
  test(table + ': bloqueo inmediato de doble submit, cierre protegido y recuperación de fallo de red', async () => {
    const modal = modalHarness(file, values)
    const pending = modal.submit()
    await modal.submit() // Mismo handler antes de que el botón disabled pueda rerenderizar.
    assert.equal(modal.requests.length, 1)
    modal.close()
    assert.equal(modal.state().closes, 0)
    modal.render()
    assert.equal(modal.state().loading, true)
    modal.requests[0].reject(new TypeError('Failed to fetch'))
    await pending
    modal.render()
    assert.equal(modal.state().loading, false)
    assert.equal(JSON.stringify(modal.state().form), JSON.stringify(values))
    assert.ok(modal.alert())
    assert.equal(modal.state().created, 0)
    assert.equal(modal.successes.length, 0)
    const retry = modal.submit()
    assert.equal(modal.requests.length, 2)
    modal.requests[1].resolve({ error: null })
    await retry
    assert.equal(modal.state().loading, false)
    assert.equal(modal.state().created, 1)
    assert.equal(modal.state().closes, 1)
    assert.equal(modal.successes.length, 1)
  })

  test(table + ': trim del payload y error RLS sanitizado sin anunciar alta', async () => {
    const modal = modalHarness(file, values)
    const pending = modal.submit()
    const request = modal.requests[0]
    assert.equal(request.table, table)
    for (const [key, value] of Object.entries(values)) {
      if (key in request.payload[0] && typeof value === 'string')
        assert.equal(request.payload[0][key], value.trim() || (key.startsWith('fecha_') ? null : ''))
    }
    request.resolve({ error: { code: '42501', message: 'permission denied secret=privado', details: 'select private_table', hint: 'api_key=privado' } })
    await pending
    assert.equal(modal.state().loading, false)
    assert.match(modal.state().error, /no tiene permiso/)
    assert.equal(modal.state().closes, 0)
    assert.equal(modal.state().created, 0)
    assert.equal(modal.successes.length, 0)
    assert.doesNotMatch(JSON.stringify([modal.errors, modal.logs, modal.state().error]), /secret=|private_table|api_key=|privado/)
  })
}

test('campos obligatorios sin contenido se rechazan antes de llamar al transporte', async () => {
  for (const [index, field] of [[0, 'nombre_proceso'], [3, 'titulo'], [5, 'codigo_doc'], [5, 'titulo']]) {
    const [file, , values] = cases[index]
    const modal = modalHarness(file, { ...values, [field]: '   ' })
    await modal.submit()
    assert.equal(modal.requests.length, 0)
    assert.equal(modal.state().loading, false)
    assert.match(modal.state().error, /Completa el campo/)
  }
})

test('fechas imposibles, orden invertido y escalas fuera de 1–3 no consumen folios ni insertan', async () => {
  const failures = [
    [1, { fecha_inicio: '2026-02-29' }],
    [1, { fecha_fin: '2026-10-06' }],
    [3, { fecha_programada: '' }],
    [3, { fecha_programada: '2026-13-01' }],
    [4, { fecha_limite: '2026-04-31' }],
    [2, { probabilidad: 0 }], [2, { impacto: 4 }],
    [2, { probabilidad: 1.5 }], [2, { impacto: NaN }],
  ]
  for (const [index, invalid] of failures) {
    const [file, , values] = cases[index]
    const modal = modalHarness(file, { ...values, ...invalid, folio: '   ' })
    await modal.submit()
    assert.equal(modal.requests.length, 0)
    assert.equal(modal.state().folios, 0)
    assert.equal(modal.state().loading, false)
    assert.ok(modal.state().error)
  }
})

test('opciones ajenas al selector no pasan la validación y permiten corregir el borrador', async () => {
  for (const [file, , values] of cases.filter(([, , form]) => 'tipo' in form)) {
    const modal = modalHarness(file, { ...values, tipo: 'otro valor' })
    await modal.submit()
    assert.equal(modal.requests.length, 0)
    assert.match(modal.state().error, /opción válida/)
    modal.values({ tipo: values.tipo })
    const retry = modal.submit()
    modal.requests[0].resolve({ error: null })
    await retry
    assert.equal(modal.successes.length, 1)
  }
})

test('folio con espacios usa el generador y sus fallos liberan el formulario sin insertar', async () => {
  for (const [file, , values] of [cases[1], cases[2], cases[4]]) {
    const failed = modalHarness(file, { ...values, folio: '   ' }, { folioError: new TypeError('Failed to fetch') })
    await failed.submit()
    assert.equal(failed.state().folios, 1)
    assert.equal(failed.requests.length, 0)
    assert.equal(failed.state().loading, false)
    const empty = modalHarness(file, { ...values, folio: '   ' }, { folio: '' })
    await empty.submit()
    assert.equal(empty.requests.length, 0)
    assert.match(empty.state().error, /Folio/)
    const successful = modalHarness(file, { ...values, folio: '   ' })
    const pending = successful.submit()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(successful.requests[0].payload[0].folio, 'AUTO-2026-1')
    successful.requests[0].resolve({ error: null })
    await pending
  }
})

test('un callback de vista fallido tras el insert no se comunica como guardado fallido', async () => {
  const [file, , values] = cases[0]
  const modal = modalHarness(file, values, { onCreatedError: new Error('UI callback failed') })
  const pending = modal.submit()
  modal.requests[0].resolve({ error: null })
  await pending
  assert.match(modal.state().error, /ya se guardó/)
  assert.equal(modal.state().form.nombre_proceso, '')
  assert.equal(modal.state().loading, false)
  assert.equal(modal.requests.length, 1)
  assert.match(modal.errors[0], /ya se guardó/)
})

test('validación de fechas admite bisiestos y opcionales vacíos sin inventar mínimos o máximos', () => {
  const api = loadModule('lib/utils/operationalFormValidation.ts')
  api.validateDate('2024-02-29', 'Inicio')
  api.validateDate('', 'Inicio')
  api.validateDateOrder('', '2026-10-01')
  api.requireText('A', 'Nombre')
  api.requireText('A'.repeat(5000), 'Nombre')
  assert.throws(() => api.validateDate('0000-01-01', 'Inicio'), /Revisa/)
  assert.throws(() => api.validateDate('fecha', 'Inicio'), /Revisa/)
  assert.equal(api.trimTextFields({ text: '  primera\nsegunda  ', score: 2 }).text, 'primera\nsegunda')
})

test('folioService registra solo contexto seguro y mantiene el error para el llamador', async () => {
  const error = { code: '42501', message: 'select password from private_table', details: 'token=privado' }
  const logs = []
  const api = loadModule('lib/services/folioService.ts', {
    '@/lib/supabase': { supabase: { rpc: async () => ({ data: null, error }) } },
  }, { console: { log: record => logs.push(record) } })
  await assert.rejects(api.generarFolio('auditoria'), caught => caught === error)
  assert.equal(logs[0].action, 'generate_folio')
  assert.equal(logs[0].code, '42501')
  assert.doesNotMatch(JSON.stringify(logs), /password|private_table|token=|privado/)
})

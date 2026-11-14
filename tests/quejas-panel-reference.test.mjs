import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { getCaseProcessCycle } = loadModule('app/quejas/components/quejaExpedienteModel.ts')
const { CaseCycle, CaseProcessHeader, CaseSidebarShortcut, CaseWorkspace, CaseAction, CaseRequestHeader } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
const queja = { id: 'case', folio: '2026-001', cliente_nombre: 'Cliente de prueba', estado: 'En Investigación', estado_color: 'blue' }
const html = (Component, props) => renderToStaticMarkup(createElement(Component, props))

test('el ciclo de referencia muestra el recorrido completo sin modificar el expediente', () => {
  for (const [estado, position] of [['Recibido', 0], ['En Investigación', 1], ['Pendiente de Revisión GC', 2], ['Resuelto', 3], ['Finalizado', -1]]) {
    const input = Object.freeze({ estado })
    const flow = getCaseProcessCycle(input)
    assert.deepEqual(Array.from(flow.steps, step => step.label), ['Evaluación', 'Investigación', 'Revisión de Calidad', 'Cierre'])
    assert.equal(flow.steps.findIndex(step => step.current), position)
    assert.equal(flow.steps.filter(step => step.completed).length, position < 0 ? 4 : position)
    assert.equal(input.estado, estado)
  }
  const rejected = getCaseProcessCycle({ estado: 'No Procede' })
  assert.deepEqual(Array.from(rejected.steps, step => step.label), ['Evaluación', 'Cierre'])
  assert.ok(rejected.steps.every(step => step.completed))
  assert.ok(getCaseProcessCycle({ estado: 'Desconocido' }).steps.every(step => !step.current && !step.completed))
})

test('contraído presenta solo el paso actual y cuatro segmentos con el avance', () => {
  const result = html(CaseCycle, { queja, process: true, currentOnly: true })
  assert.match(result, /Investigación · paso 2 de 4/)
  assert.doesNotMatch(result, /Revisión de Calidad/)
  assert.equal((result.match(/h-1 flex-1/g) || []).length, 4)
  assert.equal((result.match(/bg-qms-success/g) || []).length, 1)
  assert.equal((result.match(/bg-qms-primary/g) || []).length, 1)
})

test('ampliado presenta las etapas con líneas bajo las etiquetas, sin checks ni círculos', () => {
  const result = html(CaseCycle, { queja, process: true })
  assert.match(result, /aria-current="step"/)
  assert.match(result, /Revisión de Calidad/)
  assert.match(result, /data-case-process-lines[^>]*w-full/)
  assert.equal((result.match(/data-case-cycle-line/g) || []).length, 4)
  assert.equal((result.match(/data-case-cycle-connector/g) || []).length, 0)
  assert.match(result, /data-case-cycle-line[^>]*bg-qms-success/)
  assert.match(result, /data-case-cycle-line[^>]*bg-qms-primary/)
})

test('las dos disposiciones conservan una sola instancia de acción, solicitud y documento', () => {
  for (const expanded of [false, true]) {
    const result = html(CaseWorkspace, { documentKey: 'case', presentation: 'reference', expanded,
      compact: createElement('span', null, 'Paso actual'), cycle: createElement('span', null, 'Ciclo completo'),
      action: createElement('button', null, 'Acción única'), request: createElement('div', null, 'Datos únicos'),
      children: createElement('textarea', { defaultValue: 'Borrador conservado' }),
    })
    assert.equal((result.match(/Acción única/g) || []).length, 1)
    assert.equal((result.match(/Datos únicos/g) || []).length, 1)
    assert.equal((result.match(/Borrador conservado/g) || []).length, 1)
    assert.match(result, expanded ? /Ciclo completo/ : /Paso actual/)
    assert.doesNotMatch(result, expanded ? /Paso actual/ : /Ciclo completo/)
    assert.doesNotMatch(result, /Estado del trámite/)
    assert.equal(/data-case-request-region="true" hidden=""/.test(result), !expanded)
  }
})

test('Mis Quejas deja los dos laterales sticky en el scroll único del expediente', () => {
  const result = html(CaseWorkspace, {
    documentKey: 'case', presentation: 'reference', expanded: true, cyclePlacement: 'header',
    request: createElement('div', null, 'Datos'),
    requestFooter: createElement('div', null, 'Notas y archivos'),
    action: createElement('div', null, 'Acción'),
    compact: null, cycle: null, children: createElement('div', null, 'Documento extenso'),
  })
  const left = result.match(/<aside data-case-request-region[^>]+>/)?.[0] ?? ''
  const right = result.match(/<aside data-case-action[^>]+>/)?.[0] ?? ''
  for (const panel of [left, right]) {
    assert.match(panel, /@min-\\[1100px\\]:sticky/)
    assert.match(panel, /@min-\\[1100px\\]:top-4/)
    assert.doesNotMatch(panel, /overflow-y-auto|max-h-/)
  }
  assert.match(result, /data-case-scroll[^>]*overflow-y-auto/)
  assert.doesNotMatch(result, /data-case-top-cycle/)
})

test('Quejas y Mis Quejas recuperan los cuatro segmentos al contraer el modal', () => {
  for (const expanded of [false, true]) {
    const result = html(CaseWorkspace, {
      documentKey: 'case', presentation: 'reference', expanded, cyclePlacement: 'header',
      compact: createElement(CaseCycle, { queja, process: true, currentOnly: true }),
      cycle: createElement(CaseCycle, { queja, process: true }),
      request: createElement('span', null, 'Cliente'),
      requestFooter: createElement('div', null, 'Historial'),
      action: createElement('span', null, 'Acciones'),
      children: createElement('div', null, 'Documento'),
    })
    assert.equal((result.match(/data-case-top-cycle/g) || []).length, expanded ? 0 : 1)
    assert.equal((result.match(/data-case-cycle-compact/g) || []).length, expanded ? 0 : 1)
    if (!expanded) assert.match(result, /Investigación · paso 2 de 4/)
    assert.equal((result.match(/Historial/g) || []).length, 1)
    assert.equal((result.match(/Acciones/g) || []).length, 1)
  }
})

test('un único componente de progreso sirve para los encabezados de Quejas y Mis Quejas', () => {
  const result = html(CaseProcessHeader, { queja })
  assert.match(result, /data-case-process-header/)
  assert.match(result, /data-case-cycle-line/)
  assert.equal((result.match(/data-case-cycle-line/g) || []).length, 4)
  assert.match(result, /4\. Cierre/)
})

test('las tarjetas laterales conservan acciones accesibles sin duplicar botones del encabezado', () => {
  const card = html(CaseSidebarShortcut, {
    title: 'Historial y observaciones', description: 'Consultar movimientos',
    icon: createElement('span', null, 'Icono'), actionLabel: 'Ver actividad',
    onClick() {}, count: 7,
  })
  assert.match(card, /aria-label="Ver actividad"/)
  assert.match(card, /Historial y observaciones/)
  assert.match(card, /Consultar movimientos/)
  assert.match(card, />7<\/span>/)
})

test('el panel de referencia conserva el color configurado del estado sin añadir otro plazo al finalizar', () => {
  const result = html(CaseAction, { queja: { ...queja, estado: 'Finalizado' }, runs: [], presentation: 'reference' })
  assert.match(result, /Siguiente paso/)
  assert.match(result, /Finalizado/)
  assert.match(result, /bg-qms-primary text-white/)
  assert.match(result, /Por asignar/)
  assert.doesNotMatch(result, /Completado|Sin plazo|Plazo vigente/)
  const assigned = html(CaseAction, { queja, runs: [], presentation: 'reference', responsable: 'Administrador' })
  assert.match(assigned, /Administrador/)
})

test('el responsable precede a las acciones en todas las etapas sin repetirse', () => {
  for (const estado of ['Recibido', 'En Investigación', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede']) {
    const result = html(CaseAction, { queja: { ...queja, estado }, runs: [], presentation: 'reference', responsable: 'Persona responsable', children: createElement('button', null, 'Acción disponible') })
    assert.equal((result.match(/Persona responsable/g) || []).length, 1)
    assert.ok(result.indexOf('Persona responsable') < result.indexOf('Acción disponible'))
  }
})

test('el color y nombre del catálogo prevalecen sobre la variante histórica del estado', () => {
  for (const estado of ['Recibido', 'En Investigación', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede']) {
    const result = html(CaseAction, { queja: { ...queja, estado, estado_color: 'warning', estado_nombre: 'Etiqueta configurada' }, runs: [], presentation: 'reference' })
    assert.match(result, /bg-qms-warning text-qms-warning-text/)
    assert.match(result, /Etiqueta configurada/)
  }
})

test('el contacto conserva los datos y muestra el nombre una sola vez sin el rótulo redundante', () => {
  for (const variant of ['details', 'panel']) {
    const result = html(CaseRequestHeader, { queja: { ...queja, email_cliente: 'persona@example.test', telefono: '00000000', fecha: '2026-11-10' }, reference: true, variant })
    assert.equal((result.match(/Cliente de prueba/g) || []).length, 1)
    assert.match(result, /persona@example.test/)
    assert.match(result, /00000000/)
    assert.doesNotMatch(result, /Datos de la solicitud/)
  }
})

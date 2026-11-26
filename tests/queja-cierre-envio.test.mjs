import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { CaseCompletionDate, CaseFinalMailStatus, CaseAction, hasCaseMailIncidents } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
const html = (component, props) => renderToStaticMarkup(createElement(component, props))
const close = '2026-11-10T15:40:11.373Z', sent = '2026-11-10T15:44:33.526Z'
const queja = { estado: 'Finalizado', fecha_cierre: close }

test('la fecha visible de finalización usa el cierre persistido en hora Costa Rica', () => {
  for (const estado of ['Finalizado', 'No Procede']) {
    const result = html(CaseCompletionDate, { queja: { ...queja, estado } })
    assert.match(result, /10\/11\/26/)
    assert.match(result, /9:40/)
    assert.ok(result.includes(`dateTime="${close}"`))
  }
  const panel = html(CaseAction, { queja, runs: [], presentation: 'reference' })
  assert.match(panel, /Finalizada el/)
  assert.match(panel, /9:40/)
})

test('reabrir o no tener un cierre válido nunca inventa una fecha de finalización', () => {
  for (const input of [{ ...queja, estado: 'En Investigación' }, { ...queja, estado: 'Resuelto' }, { estado: 'Finalizado' }, { ...queja, fecha_cierre: 'invalid' }]) assert.equal(html(CaseCompletionDate, { queja: input }), '')
})

test('el resumen distingue cola, envío incierto y envío aceptado con su propia fecha', () => {
  for (const [status, expected] of [['pending', 'En cola de envío'], ['leased', 'Enviando'], ['retry', 'Reintento automático pendiente'], ['uncertain', 'Envío por comprobar'], ['failed', 'No se pudo enviar']]) {
    const result = html(CaseFinalMailStatus, { messages: [{ tipo: 'final', status, sent_at: null }], onRetry() {} })
    assert.ok(result.includes(expected))
    assert.doesNotMatch(result, /9:44|9:40/)
  }
  const result = html(CaseFinalMailStatus, { messages: [{ tipo: 'recibido', status: 'sent', sent_at: close }, { tipo: 'final', status: 'sent', sent_at: sent }], onRetry() {} })
  assert.match(result, /Enviado/)
  assert.match(result, /9:44/)
  assert.doesNotMatch(result, /9:40|leído|bandeja/)
})

test('un error o ausencia de correo final no se presentan como un envío exitoso', () => {
  const empty = html(CaseFinalMailStatus, { messages: [{ tipo: 'recibido', status: 'sent', sent_at: sent }], onRetry() {} })
  assert.match(empty, /Sin correo final registrado/)
  const failure = html(CaseFinalMailStatus, { messages: [], error: true, onRetry() {} })
  assert.match(failure, /role="alert"/)
  assert.match(failure, /Actualizar estado/)
})

test('la consulta observa el ACK solo mientras el envío final esté pendiente y la vista esté activa', () => {
  const queries = loadModule('lib/queries/useQuejaSeguimiento.ts', { '@/lib/supabase': { supabase: {} }, '@tanstack/react-query': { useQuery: options => options } })
  const options = queries.useQuejaCorreos('case', true)
  for (const status of ['pending', 'leased', 'retry']) assert.equal(options.refetchInterval({ state: { data: [{ tipo: 'final', status }] } }), 30000)
  for (const status of ['sent', 'uncertain', 'failed', 'skipped']) assert.equal(options.refetchInterval({ state: { data: [{ tipo: 'final', status }] } }), false)
  assert.equal(options.refetchInterval({ state: { data: [{ tipo: 'interno_asignacion', status: 'pending' }] } }), false)
  assert.equal(options.refetchInterval({ state: {} }), false)
  assert.equal(options.refetchIntervalInBackground, false)
  assert.equal(queries.useQuejaCorreos('case', false).enabled, false)
})
test('el diagnóstico seguro y el botón de envío aparecen solo si el evento se puede reprogramar', () => {
  const base = { id: 'event-synthetic', tipo: 'final', sent_at: null }
  const safe = html(CaseFinalMailStatus, { messages: [{ ...base, status: 'retry', safe_error: 'authorization_permission_denied' }], onRetry() {}, onRetrySend() {} })
  assert.match(safe, /Supabase rechazó el permiso del emisor/)
  assert.match(safe, /Reintentar envío/)
  const uncertain = html(CaseFinalMailStatus, { messages: [{ ...base, status: 'uncertain', safe_error: 'delivery_uncertain' }], onRetry() {}, onRetrySend() {} })
  assert.match(uncertain, /Envío por comprobar/)
  assert.doesNotMatch(uncertain, /Reintentar envío/)
})


test('las incidencias compactan únicamente el resumen de cierre y conservan estado, fecha y acciones', () => {
  for (const estado of ['Finalizado', 'No Procede']) {
    const props = { queja: { ...queja, estado }, runs: [], presentation: 'reference', responsable: 'Persona responsable', children: 'Acciones conservadas' }
    const normal = html(CaseAction, props)
    const compact = html(CaseAction, { ...props, hideSummary: true })
    assert.match(normal, /Persona responsable/)
    assert.match(compact, estado === 'No Procede' ? /Cerrada el/ : /Finalizada el/)
    assert.match(compact, /Acciones conservadas/)
    assert.doesNotMatch(compact, /Persona responsable|Expediente finalizado|No procedencia registrada|conserva sus evidencias|Se conserva la justificación/)
  }
})

test('el contador y la compactación reconocen los mismos errores de correo', () => {
  const base = { id: 'event-synthetic', tipo: 'final', sent_at: null }
  for (const status of ['failed', 'retry', 'uncertain', 'sent', 'pending', 'leased', 'skipped']) {
    const messages = [{ ...base, status }]
    const expected = ['failed', 'retry', 'uncertain'].includes(status)
    assert.equal(hasCaseMailIncidents(messages, true), expected)
    assert.equal(hasCaseMailIncidents(messages, false), false)
    assert.equal(hasCaseMailIncidents([{ ...messages[0], tipo: 'interno_asignacion' }], false), expected)
    const result = html(CaseFinalMailStatus, { messages, compact: true, onRetry() {} })
    assert.equal(/1 incidencia/.test(result), expected)
  }
})

test('los motivos y correos adicionales del cierre se despliegan sin scroll anidado', () => {
  const messages = [
    { id: 'final', tipo: 'final', status: 'sent', sent_at: sent },
    ...['a', 'b', 'c'].map(id => ({ id, tipo: 'interno_asignacion', status: 'uncertain', safe_error: 'delivery_uncertain' })),
  ]
  const props = { messages, compact: true, onRetry() {} }
  const result = html(CaseFinalMailStatus, { ...props, singleScroll: true })
  assert.match(result, /3 incidencias/)
  assert.match(result, /Ver 2 correos más/)
  assert.match(result, /Ver motivo/)
  assert.doesNotMatch(result, /overflow-y-auto|max-h-28|max-h-56/)
  assert.match(html(CaseFinalMailStatus, props), /overflow-y-auto/)
})

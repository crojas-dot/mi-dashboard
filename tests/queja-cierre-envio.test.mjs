import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { CaseCompletionDate, CaseFinalMailStatus, CaseAction } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
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

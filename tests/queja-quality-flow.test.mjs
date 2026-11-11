import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const file = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', queja_id: id, usuario_id: 'quality',
  nombre: 'Oficio.pdf', storage_path: 'synthetic_official_file', tamano: 100, tipo_mime: 'application/pdf' }
const snapshot = { id, revision: 17 }
const input = { respuesta: ' Respuesta pública ', numeroOficio: ' ECA-001 ', adjuntoId: file.id }
function serviceFixture(error = null) {
  const calls = []
  const service = loadModule('lib/services/quejaWorkflowService.ts', { '@/lib/supabase': { supabase: {
    rpc: async (name, args) => { calls.push({ name, args }); return { data: {}, error } },
  } } })
  return { service, calls }
}
const plain = value => JSON.parse(JSON.stringify(value))

test('revisión GC envía solo decisión, motivo si devuelve y revisión capturada', async () => {
  const { service, calls } = serviceFixture()
  for (const reason of ['', ' ', 'x'.repeat(10001)]) assert.throws(() => service.revisarResolucionQueja(snapshot, 'returned', reason))
  assert.throws(() => service.revisarResolucionQueja(snapshot, 'invalid'))
  assert.equal(calls.length, 0)
  await service.revisarResolucionQueja(snapshot, 'approved', 'No se debe publicar')
  assert.deepEqual(plain(calls[0]), { name: 'qms_review_resolution', args: { p_id: id, p_expected: 17, p_decision: 'approved', p_motivo: null } })
  await service.revisarResolucionQueja(snapshot, 'returned', ' Corregir hallazgos ')
  assert.equal(calls[1].args.p_motivo, 'Corregir hallazgos')
  assert.equal(calls[1].args.p_decision, 'returned')
})

test('borrador permite campos incompletos y usa versión independiente sin transición', async () => {
  const { service, calls } = serviceFixture()
  await service.guardarRespuestaClienteBorrador(snapshot, 0, { respuesta: '', numeroOficio: '', adjuntoId: null })
  assert.deepEqual(plain(calls[0]), { name: 'qms_save_response_draft', args: { p_id: id, p_expected: 17, p_version: 0, p_response: '', p_office: '', p_file: null } })
  for (const version of [-1, 1.5, NaN, undefined]) assert.throws(() => service.guardarRespuestaClienteBorrador(snapshot, version, input))
  for (const patch of [{ respuesta: 'x'.repeat(10001) }, { numeroOficio: 'x'.repeat(121) }, { numeroOficio: 'ECA\n001' }]) {
    assert.throws(() => service.guardarRespuestaClienteBorrador(snapshot, 1, { ...input, ...patch }))
  }
  assert.equal(calls.length, 1)
})

test('No Procede guarda motivo/formato y publica con la misma revisión sin cerrar antes', async () => {
  const { service, calls } = serviceFixture()
  const values = { ...input, correo: { asunto: 'Respuesta - Folio 2026-001', cuerpo: 'Estimada Ana: consulte su informe adjunto. gc@eca.or.cr' }, noProcede: { justificacion: '**No corresponde al ámbito de ECA.**', formato: 'markdown' } }
  await service.guardarRespuestaClienteBorrador(snapshot, 3, values)
  assert.equal(calls[0].name, 'qms_save_rejected_response_draft')
  assert.equal(calls[0].args.p_reason, values.noProcede.justificacion)
  assert.equal(calls[0].args.p_reason_format, 'markdown')
  await service.publicarRespuestaAprobada(snapshot, 3, values, file)
  assert.equal(calls[1].name, 'qms_publish_rejected_response')
  assert.equal(calls[1].args.p_expected, 17)
  assert.equal(calls[1].args.p_version, 3)
  assert.equal(calls[1].args.p_file, file.id)
  assert.equal(calls[1].args.p_email_body, values.correo.cuerpo)
  assert.equal(calls.length, 2)
  assert.throws(() => service.publicarRespuestaAprobada(snapshot, 3, { ...values, noProcede: { justificacion: '', formato: 'plain' } }, file), /justificación/)
  assert.equal(calls.length, 2)
})

test('publicación aprobada valida oficio propio y solo proyecta respuesta explícita', async () => {
  const { service, calls } = serviceFixture()
  for (const [patch, attachment] of [[{ respuesta: '' }, file], [{ numeroOficio: '' }, file], [{}, null],
    [{ adjuntoId: 'otro' }, file], [{}, { ...file, queja_id: 'otro' }], [{}, { ...file, usuario_id: null }]]) {
    assert.throws(() => service.publicarRespuestaAprobada(snapshot, 2, { ...input, ...patch }, attachment))
  }
  assert.equal(calls.length, 0)
  await service.publicarRespuestaAprobada({ ...snapshot, resolucion: 'PRIVADO', notas: 'SECRETO' }, 2, input, file)
  assert.deepEqual(plain(calls[0]), { name: 'qms_publish_approved_response', args: {
    p_id: id, p_expected: 17, p_version: 2, p_response: 'Respuesta pública', p_office: 'ECA-001', p_file: file.id,
  } })
})

test('conflictos de borrador/publicación/revisión se conservan sin rebase ni reintento', async () => {
  const conflict = { code: '40001', message: 'Conflicto sintético' }
  for (const method of ['review', 'save', 'publish']) {
    const { service, calls } = serviceFixture(conflict)
    const operation = method === 'review' ? service.revisarResolucionQueja(snapshot, 'approved')
      : method === 'save' ? service.guardarRespuestaClienteBorrador(snapshot, 2, input)
        : service.publicarRespuestaAprobada(snapshot, 2, input, file)
    await assert.rejects(operation, error => error === conflict)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].args.p_expected, 17)
  }
})

test('correo editable usa RPC versionado sin sustituir respuesta pública, destinatario ni revisión', async () => {
  const { service, calls } = serviceFixture()
  const correo = { asunto: ' Respuesta personal ', cuerpo: ' Estimada Ana:\n\nConsulte el informe adjunto. ' }
  await service.guardarRespuestaClienteBorrador(snapshot, 2, { ...input, correo })
  await service.publicarRespuestaAprobada({ ...snapshot, resolucion: 'INFORME INTERNO' }, 2, { ...input, correo }, file)
  assert.equal(calls[0].name, 'qms_save_response_draft_v2')
  assert.equal(calls[1].name, 'qms_publish_approved_response_v2')
  for (const call of calls) {
    assert.equal(call.args.p_expected, 17)
    assert.equal(call.args.p_version, 2)
    assert.equal(call.args.p_response, 'Respuesta pública')
    assert.equal(call.args.p_email_subject, 'Respuesta personal')
    assert.equal(call.args.p_email_body, correo.cuerpo.trim())
    assert.equal(call.args.p_file, file.id)
    assert.equal(JSON.stringify(call.args).includes('INFORME INTERNO'), false)
    assert.equal(Object.hasOwn(call.args, 'destinatario'), false)
  }
  for (const invalid of [{ asunto: 'Bcc:\notro', cuerpo: 'Texto' }, { asunto: '', cuerpo: '' }, { asunto: 'Hola', cuerpo: 'x'.repeat(3501) }]) assert.throws(() => service.publicarRespuestaAprobada(snapshot, 2, { ...input, correo: invalid }, file))
  assert.equal(calls.length, 2)
})

test('contexto obtiene borrador/aprobación/publicación por expediente, con cancelación y errores cerrados', async () => {
  const calls = [], failure = { message: 'offline' }; let failTable
  const api = loadModule('lib/queries/useQuejaRespuestaCliente.ts', {
    '@tanstack/react-query': { useQuery: options => options },
    '@/lib/supabase': { supabase: { from(table) {
      const entry = { table, steps: [] }; calls.push(entry)
      const query = Object.fromEntries(['select', 'eq', 'order', 'limit', 'abortSignal'].map(method => [method, (...args) => { entry.steps.push([method, ...args]); return query }]))
      query.maybeSingle = async () => ({ data: { table }, error: failTable === table ? failure : null })
      return query
    } } },
  })
  const signal = new AbortController().signal
  const result = await api.fetchRespuestaCliente(id, signal)
  assert.equal(result.borrador.table, 'queja_response_drafts')
  assert.equal(result.aprobacion.table, 'queja_gc_revisiones')
  assert.equal(result.publicada.table, 'queja_public_resolutions')
  for (const call of calls) {
    assert.ok(call.steps.some(([method, value]) => method === 'abortSignal' && value === signal))
    assert.ok(call.steps.some(([method, key, value]) => method === 'eq' && key === 'queja_id' && value === id))
    assert.notEqual(call.steps.find(([method]) => method === 'select')[1], '*')
  }
  assert.ok(calls[1].steps.some(([method, key, options]) => method === 'order' && key === 'source_revision' && options.ascending === false))
  for (const table of ['queja_response_drafts', 'queja_gc_revisiones', 'queja_public_resolutions']) {
    failTable = table; await assert.rejects(api.fetchRespuestaCliente(id), error => error === failure)
  }
  assert.deepEqual(Array.from(api.useRespuestaCliente(id).queryKey), ['quejas', 'respuesta-cliente', id])
  assert.equal(api.useRespuestaCliente('').enabled, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const { dispatchQuejaMail } = loadModule('lib/server/quejaMailWorker.ts')

test('transporte legacy rechaza avisos internos antes de contactar Apps Script', async () => {
  const kinds = ['interno_recibido', 'interno_evaluacion_1', 'interno_asignacion',
    'interno_investigacion_5', 'interno_investigacion_3', 'interno_evaluacion_vencida', 'interno_investigacion_vencida']
  for (const tipo of kinds) {
    const calls = []
    const row = { id: randomUUID(), claim_token: randomUUID(), tipo, destinatario: 'staff@example.test',
      folio: '2026-001', estado: 'En Investigación', numero_oficio: null }
    const admin = { rpc: async (name, args) => {
      calls.push({ name, args })
      return { data: name === 'qms_mail_claim_batch' ? [row] : true, error: null }
    } }
    const result = await dispatchQuejaMail(admin, { secret: 'synthetic-mail-key-for-tests-only',
      webAppUrl: 'https://script.google.com/macros/s/fixture/exec' },
    { limit: 1, nonce: randomUUID(), issuedAt: 0 }, { fetcher: async () => assert.fail('No debe enviar') })
    assert.equal(result.failed, 1)
    assert.equal(calls[1].args.p_safe_error, 'invalid_mail_snapshot')
    assert.equal(calls[1].args.p_outcome, 'failed')
  }
})

test('transporte legacy no envía el correo ciudadano de investigación retirado', async () => {
  const calls = []
  const row = { id: randomUUID(), claim_token: randomUUID(), tipo: 'investigacion', destinatario: 'person@example.test',
    folio: '2026-001', estado: 'En Investigación', numero_oficio: null }
  const admin = { rpc: async (name, args) => {
    calls.push({ name, args })
    return { data: name === 'qms_mail_claim_batch' ? [row] : true, error: null }
  } }
  const result = await dispatchQuejaMail(admin, { secret: 'synthetic-mail-key-for-tests-only',
    webAppUrl: 'https://script.google.com/macros/s/fixture/exec' },
  { limit: 1, nonce: randomUUID(), issuedAt: 0 }, { fetcher: async () => assert.fail('No debe enviar') })
  assert.equal(result.failed, 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].args.p_safe_error, 'invalid_mail_snapshot')
  assert.equal(calls[1].args.p_outcome, 'failed')
})

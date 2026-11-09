import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const protocol = loadModule('lib/server/quejaMailProtocol.ts')
const environment = { QUEJAS_MAIL_WAKE_ENABLED: 'true', QUEJAS_MAIL_WAKE_SECRET: 'synthetic-wake-only-'.repeat(3),
  QUEJAS_MAIL_WAKE_URL: 'https://script.google.com/macros/s/synthetic/exec' }
const { wakeQuejaMail, quejaMailWakeConfig } = loadModule('lib/server/quejaMailWake.ts', {
  '@/lib/utils/logger': { logger: { warn() {} } },
}, { process: { env: {} } })

test('wake apagado o mal configurado no contacta el emisor', async () => {
  for (const change of [{ QUEJAS_MAIL_WAKE_ENABLED: 'false' }, { QUEJAS_MAIL_WAKE_SECRET: 'short' },
    { QUEJAS_MAIL_WAKE_URL: 'https://example.test/exec' }, { QUEJAS_MAIL_WAKE_URL: environment.QUEJAS_MAIL_WAKE_URL + '?redirect=1' }]) {
    const env = { ...environment, ...change }
    assert.equal(quejaMailWakeConfig(env), null)
    assert.equal(await wakeQuejaMail({ environment: env, fetcher: () => assert.fail('No network') }), false)
  }
})

test('solo envía un despertador vacío y acepta recibo firmado correlacionado', async () => {
  let calls = 0
  const result = await wakeQuejaMail({ environment, fetcher: async (url, options) => {
    calls++
    assert.equal(url, environment.QUEJAS_MAIL_WAKE_URL)
    assert.equal(options.redirect, 'manual')
    const request = JSON.parse(options.body)
    const { payload } = protocol.verifyMailEnvelope(request, 'queue_wake_request', environment.QUEJAS_MAIL_WAKE_SECRET)
    assert.deepEqual(Object.keys(payload), [])
    return Response.json(protocol.signMailEnvelope('queue_wake_receipt', { requestNonce: request.nonce, status: 'accepted' }, environment.QUEJAS_MAIL_WAKE_SECRET))
  } })
  assert.equal(result, true); assert.equal(calls, 1)
})

test('rechaza firma, correlación y redirección ajenas; una respuesta perdida no se repite', async () => {
  for (const mode of ['signature', 'nonce', 'redirect', 'timeout']) {
    let calls = 0
    const result = await wakeQuejaMail({ environment, fetcher: async (_url, options) => {
      calls++
      if (mode === 'timeout') throw new Error('synthetic timeout')
      if (mode === 'redirect') return new Response(null, { status: 302, headers: { location: 'https://example.test/collect' } })
      const request = JSON.parse(options.body)
      return Response.json(protocol.signMailEnvelope('queue_wake_receipt', { requestNonce: mode === 'nonce' ? 'other' : request.nonce, status: 'accepted' }, mode === 'signature' ? 'wrong-synthetic-key' : environment.QUEJAS_MAIL_WAKE_SECRET))
    } })
    assert.equal(result, false); assert.equal(calls, 1)
  }
})

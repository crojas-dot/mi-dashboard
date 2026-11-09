import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID, webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const shared = loadModule('supabase/functions/_shared/publicTrackingCapability.ts', {}, {
  crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob,
})
const secret = 'synthetic-tracking-signing-key-only-for-tests'
const claims = () => ({ quejaId: randomUUID(), nonce: randomUUID() })
const options = { crypto: webcrypto }
const canonical = value => JSON.parse(JSON.stringify(value))
function signedWire(wire, domain = 'qms-public-tracking-v2') {
  const payload = Buffer.from(typeof wire === 'string' ? wire : JSON.stringify(wire)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(`${domain}\0${payload}`).digest('base64url')}`
}

test('capacidad Web Crypto interoperable y determinista sin datos personales ni folio', async () => {
  const value = claims()
  const token = await shared.mintPublicTrackingCapability(value, secret, options)
  assert.equal(token, await shared.mintPublicTrackingCapability(value, secret, options))
  assert.deepEqual(canonical(await shared.verifyPublicTrackingCapability(token, secret, options)), value)
  const [payload, signature] = token.split('.')
  assert.equal(signature, createHmac('sha256', secret).update(`qms-public-tracking-v2\0${payload}`).digest('base64url'))
  const wire = JSON.parse(Buffer.from(payload, 'base64url').toString())
  assert.deepEqual(wire, { purpose: 'qms-public-tracking-v2', queja_id: value.quejaId, nonce: value.nonce })
  assert.ok(token.length < 1024)
})

test('firma alterada, otra clave, otros propósitos y codificación no canónica se rechazan', async () => {
  const value = claims(), token = await shared.mintPublicTrackingCapability(value, secret, options)
  const [payload, signature] = token.split('.')
  for (const candidate of [undefined, '', `${payload}.${signature.slice(0, -2)}AA`, `${payload}=.${signature}`,
    `${payload}.${signature}=`, `${token}.extra`, 'x'.repeat(1025), `${payload}.AA`,
    signedWire({ purpose: 'qms-public-upload-v1', queja_id: value.quejaId, nonce: value.nonce }),
    signedWire({ purpose: 'qms-public-tracking-v2', queja_id: value.quejaId, nonce: value.nonce }, 'qms-public-upload-v1')]) {
    await assert.rejects(shared.verifyPublicTrackingCapability(candidate, secret, options), /invalid_public_tracking_capability/)
  }
  await assert.rejects(shared.verifyPublicTrackingCapability(token, `${secret}-other`, options), /invalid_public_tracking_capability/)
})

test('claims v2 exactos rechazan timestamps, v1 y representaciones ambiguas', async () => {
  const value = claims()
  for (const patch of [{ expiresAt: null }, { expiresAt: 1791820801 }, { quejaId: '2026-001' },
    { nonce: 'not-a-uuid' }, { nonce: value.nonce.toUpperCase() }, { extra: true }]) {
    await assert.rejects(shared.mintPublicTrackingCapability({ ...value, ...patch }, secret, options))
  }
  const wire = { purpose: 'qms-public-tracking-v2', queja_id: value.quejaId, nonce: value.nonce }
  for (const candidate of [{ ...wire, extra: true }, { ...wire, expires_at: null }, { ...wire, expires_at: 1791820801 },
    { ...wire, purpose: 'qms-public-tracking-v1' },
    JSON.stringify(wire).replace('"purpose":', '"purpose":"ignored","purpose":'),
    JSON.stringify(wire, null, 2), { nonce: value.nonce, ...wire }]) {
    await assert.rejects(shared.verifyPublicTrackingCapability(signedWire(candidate), secret, options))
  }
  const legacy = { purpose: 'qms-public-tracking-v1', queja_id: value.quejaId, nonce: value.nonce, expires_at: 1791820801 }
  await assert.rejects(shared.verifyPublicTrackingCapability(signedWire(legacy, 'qms-public-tracking-v1'), secret, options))
})

test('firmar y autenticar no dependen del reloj: la DB decide caducidad y revocación', async () => {
  const value = claims()
  const clock = { now: () => { throw new Error('signing_must_not_read_the_clock') } }
  const timeless = loadModule('supabase/functions/_shared/publicTrackingCapability.ts', {}, {
    crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, Date: clock,
  })
  const token = await timeless.mintPublicTrackingCapability(value, secret, options)
  assert.equal(token, await shared.mintPublicTrackingCapability(value, secret, options))
  assert.deepEqual(canonical(await timeless.verifyPublicTrackingCapability(token, secret, options)), value)
})

test('secreto dedicado sin espacios ni controles y mínimo real UTF8', async () => {
  for (const key of [undefined, '', 'short', ` ${secret}`, `${secret}\n`, `${secret}\0`, 'x'.repeat(4097)]) {
    assert.throws(() => shared.validatePublicTrackingSecret(key))
    await assert.rejects(shared.mintPublicTrackingCapability(claims(), key, options))
  }
  assert.equal(shared.validatePublicTrackingSecret('é'.repeat(16)), 'é'.repeat(16))
})

test('URL solo origen canónico HTTPS sin credentials/query; fragmento mantiene clave fuera del request', async () => {
  const token = await shared.mintPublicTrackingCapability(claims(), secret, options)
  const link = shared.buildPublicTrackingUrl('https://example.test', token)
  const url = new URL(link)
  assert.equal(url.pathname, '/q/seguimiento')
  assert.equal(url.search, '')
  assert.equal(url.hash, `#clave=${token}`)
  for (const origin of ['https://example.test/', 'https://EXAMPLE.test', 'http://example.test',
    'https://user:pass@example.test', 'https://example.test:444', 'https://example.test?leak=1',
    'https://example.test#other', 'https://example.test/other', 'javascript:alert(1)', '//example.test',
    'http://localhost:3000', 'http://127.0.0.1:3000']) assert.throws(() => shared.buildPublicTrackingUrl(origin, token))
  assert.equal(shared.buildPublicTrackingUrl('http://localhost:3000', token, { allowLocalHttp: true }),
    `http://localhost:3000/q/seguimiento#clave=${token}`)
  assert.throws(() => shared.buildPublicTrackingUrl('http://example.test', token, { allowLocalHttp: true }))
  for (const invalid of ['bad', 'a.b.c', 'a.b"onclick="x', 'a.b&x=1']) assert.throws(() => shared.buildPublicTrackingUrl('https://example.test', invalid))
})

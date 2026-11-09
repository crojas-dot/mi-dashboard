import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

function fixture(fetcher) {
  const state = { user: { id: 'fixture-user' }, signingOut: false }, calls = []
  const { fetchDriveBlob } = loadModule('lib/services/driveClient.ts', {
    '@/lib/store/auth-store': { useAuthStore: { getState: () => state } },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-access-token' } } }) } } },
  }, { fetch: async (url, options) => { calls.push({ url, options }); return fetcher(state) } })
  return { read: fetchDriveBlob, state, calls }
}

test('Drive blob usa API autenticada, no-store, ID codificado y signal de la visita', async () => {
  const f = fixture(() => new Response('synthetic-file', { headers: { 'Content-Type': 'application/pdf' } }))
  const controller = new AbortController(), blob = await f.read('file/id?fake', controller.signal)
  assert.equal(await blob.text(), 'synthetic-file')
  assert.equal(f.calls[0].url, '/api/drive/download?id=file%2Fid%3Ffake')
  assert.equal(f.calls[0].options.headers.Authorization, 'Bearer synthetic-access-token')
  assert.equal(f.calls[0].options.cache, 'no-store'); assert.equal(f.calls[0].options.signal, controller.signal)
})

test('Drive blob descarta resultados si cambió la identidad o comenzó logout', async () => {
  for (const change of [state => { state.user = { id: 'another-fixture-user' } }, state => { state.signingOut = true }]) {
    let bodyRead = false
    const f = fixture(state => { change(state); return { ok: true, blob: async () => { bodyRead = true; return new Blob(['private fixture']) } } })
    await assert.rejects(f.read('fixture-id'), error => error.name === 'AbortError')
    assert.equal(bodyRead, false)
  }
  const f = fixture(() => { throw Error('Must not fetch') }); f.state.user = null
  await assert.rejects(f.read('fixture-id'), error => error.name === 'AbortError'); assert.equal(f.calls.length, 0)
})

test('Drive blob conserva status seguro y no refleja el diagnóstico externo', async () => {
  const f = fixture(() => new Response('private Google fixture', { status: 403 }))
  await assert.rejects(f.read('fixture-id'), error => error.status === 403 && !error.message.includes('Google'))
})

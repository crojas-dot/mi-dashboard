import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { loadModule } from './load-module.mjs'

const actor = { id: '11111111-1111-4111-8111-111111111111', auth_id: 'auth-fixture', rol: 'colaborador' }
const other = '22222222-2222-4222-8222-222222222222'
const old = `${actor.id}/11111111-1111-4111-8111-111111111111.webp`
const stranger = `${other}/22222222-2222-4222-8222-222222222222.webp`
const photo = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#024796' } }).png().toBuffer()

function fixture({ current = actor, previous = old, race = false } = {}) {
  const calls = [], objects = new Map([[old, photo], [stranger, photo]])
  let pointer = previous
  const admin = {
    from(table) {
      assert.equal(table, 'usuarios')
      let value, expected
      const filters = {}
      const query = {
        select() { return query }, update(data) { value = data.avatar_url; return query },
        eq(column, input) { filters[column] = input; if (column === 'avatar_url') expected = input; return query },
        is(column, input) { return query.eq(column, input) },
        async maybeSingle() {
          assert.equal(filters.id, actor.id)
          assert.equal(filters.auth_id, actor.auth_id)
          assert.equal(filters.estado, 'activo')
          if (value === undefined) return { data: { avatar_url: pointer }, error: null }
          if (race || expected !== pointer) return { data: null, error: null }
          pointer = value
          return { data: { id: actor.id }, error: null }
        },
      }
      return query
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'qms-avatars')
      return {
        async download(path) {
          calls.push(['read', path])
          return { data: objects.has(path) ? new Blob([objects.get(path)]) : null, error: null }
        },
        async upload(path, bytes, options) {
          calls.push(['put', path, options]); objects.set(path, bytes); return { error: null }
        },
        async remove(paths) {
          for (const path of paths) { calls.push(['remove', path]); objects.delete(path) }
          return { error: null }
        },
      }
    } },
  }
  const api = loadModule('app/api/perfil/avatar/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/server/auth': { getCurrentUser: async () => current },
    '@/lib/server/supabase-admin': { createServiceClient: () => { calls.push(['service']); return admin } },
    '@/lib/server/rateLimit': { rateLimit: () => true },
    sharp: { default: sharp },
  })
  return { api, calls, objects, pointer: () => pointer }
}

const request = (method = 'GET', buffer, mime = 'image/png', query = '') => new Request('https://qms.test/api/perfil/avatar' + query, {
  method, ...(buffer ? { body: buffer, headers: { 'Content-Type': mime } } : {}),
})

test('leer, subir y eliminar foto rechazan sesión ausente antes de tocar Storage', async () => {
  const f = fixture({ current: null })
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await f.api[method](request(method))).status, 401)
  assert.equal(f.calls.length, 0)
})

test('la foto se reduce a WebP, reemplaza solo la versión propia y no se comparte públicamente', async () => {
  const f = fixture()
  const response = await f.api.PUT(request('PUT', photo))
  assert.equal(response.status, 200)
  const { avatarUrl } = await response.json()
  assert.ok(avatarUrl.startsWith(actor.id + '/'))
  assert.equal(f.pointer(), avatarUrl)
  const transformed = await sharp(f.objects.get(avatarUrl)).metadata()
  assert.equal(transformed.format, 'webp')
  assert.equal(transformed.width, 320)
  assert.equal(transformed.height, 320)
  assert.equal(f.objects.has(old), false)
  assert.equal(f.objects.has(stranger), true)
  const read = await f.api.GET(request('GET', null, undefined, `?id=${other}`))
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('Content-Type'), 'image/webp')
  assert.equal(read.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(f.calls.at(-1), ['read', avatarUrl])
  assert.equal((await f.api.DELETE(request('DELETE'))).status, 200)
  assert.equal(f.pointer(), null)
  assert.equal(f.objects.has(avatarUrl), false)
})

test('mimetype falso o foto mayor de 2 MiB se rechaza antes del procesamiento de Storage', async () => {
  const f = fixture()
  assert.equal((await f.api.PUT(request('PUT', photo, 'image/svg+xml'))).status, 415)
  assert.equal((await f.api.PUT(request('PUT', photo, 'image/jpeg'))).status, 415)
  assert.equal((await f.api.PUT(request('PUT', Buffer.alloc(2 * 1024 * 1024 + 1)))).status, 413)
  assert.ok(f.calls.every(call => call[0] === 'service'))
  assert.equal(f.pointer(), old)
})

test('un reemplazo concurrente no borra la foto vigente y una referencia ajena nunca se lee', async () => {
  const f = fixture({ race: true })
  assert.equal((await f.api.PUT(request('PUT', photo))).status, 409)
  assert.equal(f.pointer(), old)
  assert.equal(f.objects.size, 2)
  const bad = fixture({ previous: stranger })
  assert.equal((await bad.api.GET(request())).status, 404)
  assert.equal(bad.calls.some(call => call[0] === 'read'), false)
  assert.equal((await bad.api.DELETE(request('DELETE'))).status, 200)
  assert.equal(bad.objects.has(stranger), true)
})

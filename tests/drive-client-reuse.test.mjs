import test from 'node:test'
import assert from 'node:assert/strict'
import { JWT } from 'google-auth-library'
import { loadModule } from './load-module.mjs'

// El SDK OAuth real renueva tokens; solo su intercambio y Drive son dobles.
// Las credenciales y respuestas son sintéticas y nunca se llama una API externa.
function fixture(env = { GOOGLE_CLIENT_EMAIL: 'fixture@example.test', GOOGLE_PRIVATE_KEY: 'synthetic\\nkey' }) {
  const auths = [], clients = [], requests = []
  let refreshes = 0, resolveRefresh, rejectRefresh
  class SyntheticJWT extends JWT {
    constructor(options) { super(options); auths.push(this) }
    async refreshTokenNoCache() {
      refreshes++
      return new Promise((resolve, reject) => { resolveRefresh = resolve; rejectRefresh = reject })
    }
  }
  const google = {
    auth: { JWT: SyntheticJWT },
    drive: options => {
      const client = { options, auth: options.auth }
      clients.push(client)
      return client
    },
  }
  const helpers = loadModule('lib/server/drive.ts', { googleapis: { google } }, {
    process: { env },
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json({ id: 'synthetic-upload-file' }) },
  })
  return { env, auths, clients, requests, helpers,
    get refreshes() { return refreshes },
    complete() { resolveRefresh({ tokens: { access_token: 'synthetic-access', expiry_date: Date.now() + 3_600_000 }, res: null }) },
    fail() { rejectRefresh(new Error('SYNTHETIC_REFRESH_FAILURE')) },
  }
}

test('una configuración ausente no devuelve una sesión Google anterior', () => {
  const f = fixture()
  const first = f.helpers.getDriveClient()
  delete f.env.GOOGLE_PRIVATE_KEY
  assert.equal(f.helpers.getDriveClient(), null)
  f.env.GOOGLE_PRIVATE_KEY = 'synthetic\\nkey'
  assert.notEqual(f.helpers.getDriveClient(), first)
  delete f.env.GOOGLE_CLIENT_EMAIL
  assert.equal(f.helpers.getDriveClient(), null)
  assert.equal(f.auths.length, 2)
})

test('las llamadas conservan un cliente y JWT con configuración normalizada igual', () => {
  const f = fixture(), first = f.helpers.getDriveClient()
  for (let index = 0; index < 25; index++) assert.equal(f.helpers.getDriveClient(), first)
  f.env.GOOGLE_PRIVATE_KEY = 'synthetic\nkey'
  assert.equal(f.helpers.getDriveClient(), first)
  assert.equal(f.auths.length, 1)
  assert.equal(f.clients.length, 1)
  assert.equal(first.options.timeout, 55_000)
  assert.equal(first.auth.key, 'synthetic\nkey')
  assert.deepEqual(Array.from(first.auth.scopes), ['https://www.googleapis.com/auth/drive'])
})

test('rotar la cuenta o su clave retira la instancia anterior', () => {
  const f = fixture(), first = f.helpers.getDriveClient()
  f.env.GOOGLE_CLIENT_EMAIL = 'rotated@example.test'
  const second = f.helpers.getDriveClient()
  assert.notEqual(second, first)
  f.env.GOOGLE_PRIVATE_KEY = 'synthetic-rotated-key'
  const third = f.helpers.getDriveClient()
  assert.notEqual(third, second)
  assert.equal(third.auth.email, 'rotated@example.test')
  assert.equal(third.auth.key, 'synthetic-rotated-key')
  assert.equal(f.auths.length, 3)
})

test('el SDK agrupa 25 solicitudes concurrentes y reutiliza el token vigente', async () => {
  const f = fixture()
  const requests = Array.from({ length: 25 }, () => f.helpers.getDriveClient().auth.getAccessToken())
  assert.equal(f.refreshes, 1)
  f.complete()
  const tokens = await Promise.all(requests)
  assert.equal(tokens.every(result => result.token === 'synthetic-access'), true)
  await f.helpers.getDriveClient().auth.getAccessToken()
  assert.equal(f.refreshes, 1)
  f.auths[0].credentials.expiry_date = Date.now() - 1
  const expired = Array.from({ length: 25 }, () => f.helpers.getDriveClient().auth.getAccessToken())
  assert.equal(f.refreshes, 2)
  f.complete()
  await Promise.all(expired)
  assert.equal(f.auths.length, 1)
})

test('una renovación fallida no fija la promesa rechazada ni autoriza solicitudes', async () => {
  const f = fixture()
  const failed = f.helpers.getDriveClient().auth.getAccessToken()
  f.fail()
  await assert.rejects(failed, /SYNTHETIC_REFRESH_FAILURE/)
  const retry = f.helpers.getDriveClient().auth.getAccessToken()
  assert.equal(f.refreshes, 2)
  f.complete()
  assert.equal((await retry).token, 'synthetic-access')
})

test('el upload usa el mismo JWT del cliente y espera su renovación concurrente', async () => {
  const f = fixture(), client = f.helpers.getDriveClient()
  const downloading = client.auth.getAccessToken()
  const upload = f.helpers.subirArchivoASubcarpeta('synthetic-folder', { nombre: 'archivo.txt', tipoMime: 'text/plain', buffer: Buffer.from('fixture') })
  assert.equal(f.refreshes, 1)
  assert.equal(f.requests.length, 0)
  f.complete()
  await downloading
  assert.equal((await upload).id, 'synthetic-upload-file')
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].options.headers.Authorization, 'Bearer synthetic-access')
  assert.equal(f.auths.length, 1)
})

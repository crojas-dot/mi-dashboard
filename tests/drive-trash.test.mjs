import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const FILE = 'synthetic-owned-drive-file'
const PRIVATE = 'SYNTHETIC_PRIVATE_GOOGLE_DIAGNOSTIC'

function fixture(options = {}) {
  const calls = [], logs = []
  const drive = { files: {
    get: async input => {
      calls.push(['get', input])
      if (options.getError) throw options.getError
      return { data: options.metadata ?? { id: FILE, trashed: false, capabilities: { canDelete: false, canTrash: true } } }
    },
    update: async input => {
      calls.push(['update', input])
      if (options.updateError) throw options.updateError
      return { data: options.updated ?? { id: FILE, trashed: true } }
    },
    delete: async () => { calls.push(['delete']); throw new Error('Permanent delete must not run') },
  } }
  const helpers = loadModule('lib/server/drive.ts', {
    googleapis: { google: { auth: { JWT: class {} }, drive: () => drive } },
    '@/lib/utils/logger': { logger: { error: (...args) => logs.push(args) } },
  }, { process: { env: { GOOGLE_CLIENT_EMAIL: 'synthetic@example.test', GOOGLE_PRIVATE_KEY: 'synthetic-key' } } })
  return { calls, logs, remove: helpers.eliminarArchivoDrive }
}

test('un archivo propio sin permiso delete se retira con papelera confirmada', async () => {
  const f = fixture()
  assert.equal(await f.remove(FILE), true)
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [
    ['get', { fileId: FILE, fields: 'id,trashed,capabilities(canTrash)', supportsAllDrives: true }],
    ['update', { fileId: FILE, requestBody: { trashed: true }, fields: 'id,trashed', supportsAllDrives: true }],
  ])
})

test('un reintento confirma el mismo archivo ya en papelera sin otra escritura', async () => {
  const f = fixture({ metadata: { id: FILE, trashed: true } })
  assert.equal(await f.remove(FILE), true)
  assert.equal(f.calls.length, 1)
})

test('una lectura incompleta, otro ID o falta de autoridad no permite retirar metadatos', async () => {
  for (const metadata of [{}, { id: 'foreign', trashed: true }, { id: FILE }, { id: FILE, trashed: false, capabilities: { canTrash: false } }]) {
    const f = fixture({ metadata })
    assert.equal(await f.remove(FILE), false)
    assert.equal(f.calls.length, 1)
  }
})

test('un 404 ambiguo se conserva como fallo y no demuestra archivo ausente', async () => {
  const f = fixture({ getError: Object.assign(new Error(PRIVATE), { code: 404 }) })
  assert.equal(await f.remove(FILE), false)
  assert.equal(f.calls.length, 1)
  assert.equal(f.logs[0][1].status, 404)
  assert.equal(JSON.stringify(f.logs).includes(PRIVATE), false)
})

test('una respuesta de papelera incompleta o para otro ID no confirma eliminación', async () => {
  for (const updated of [{}, { id: FILE }, { id: FILE, trashed: false }, { id: 'foreign', trashed: true }]) {
    const f = fixture({ updated })
    assert.equal(await f.remove(FILE), false)
    assert.equal(f.calls.length, 2)
  }
})

test('respuesta perdida o rechazo de update conserva metadatos y no filtra errores Google', async () => {
  for (const status of [403, 404, 503]) {
    const f = fixture({ updateError: Object.assign(new Error(PRIVATE), { response: { status } }) })
    assert.equal(await f.remove(FILE), false)
    assert.equal(f.calls.length, 2)
    assert.equal(f.logs[0][1].status, status)
    assert.equal(JSON.stringify(f.logs).includes(PRIVATE), false)
  }
})

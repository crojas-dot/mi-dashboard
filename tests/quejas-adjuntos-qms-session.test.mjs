import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadModule } from './load-module.mjs'

const visor = fs.readFileSync('components/quejas/AdjuntoPreviewModal.tsx', 'utf8')
const listado = fs.readFileSync('components/quejas/ListaAdjuntos.tsx', 'utf8')
const flujo = fs.readFileSync('lib/services/quejaWorkflowService.ts', 'utf8')

test('el visor no envía al navegador a la cuenta Google ni crea enlaces externos', () => {
  assert.doesNotMatch(visor, /drive\.google\.com|\/preview'|Abrir en Google Drive|createSignedUrl/)
  assert.doesNotMatch(listado, /drive\.google\.com|preconnect/)
  assert.doesNotMatch(flujo.slice(flujo.indexOf('export async function descargarAdjuntoQueja')), /window\.open|createSignedUrl/)
  assert.match(visor, /fetchDriveBlob\(storagePath, controller\.signal\)/)
  assert.match(visor, /URL\.revokeObjectURL/)
  assert.match(visor, /useAuthStore\.subscribe/)
})

function makeVisit({ drive = true, user = true } = {}) {
  const effects = [], state = [], changes = [], calls = [], revocations = [], listeners = []
  let slot = 0
  const actor = user ? { id: 'qms-synthetic-user' } : null
  let store = { user: actor, signingOut: false }
  const useAuthStore = {
    getState: () => store,
    subscribe: listener => { listeners.push(listener); return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1) } },
  }
  const mocks = {
    react: {
      useId: () => 'viewer-title',
      useRef: current => ({ current }),
      useState: initial => {
        const index = slot++
        state[index] = initial
        return [initial, next => { state[index] = typeof next === 'function' ? next(state[index]) : next; changes.push([index,state[index]]) }],
      },
      useEffect: fn => { effects.push(fn) },
    },
    '@/lib/supabase': { supabase: { storage: { from: bucket => ({
      download: async path => {
        calls.push(['storage', bucket, path])
        return { data: new Blob(['synthetic bytes'], { type: 'application/pdf' }), error: null }
      },
    }) } } },
    '@/lib/services/driveClient': { fetchDriveBlob: async (file, signal) => {
      calls.push(['drive', file, signal])
      return new Blob(['synthetic bytes'], { type: 'application/pdf' })
    } },
    '@/lib/store/auth-store': { useAuthStore },
    '@/lib/services/quejaWorkflowService': { descargarAdjuntoQueja: async () => {} },
    '@/lib/services/errorToast': { showError: () => {} },
    '@/lib/utils/format': { formatBytes: () => '15 B' },
    '@/components/ui/OperationLoading': { default: 'OperationLoading' },
    '@/components/ui/Spinner': { default: 'Spinner' },
  }
  const url = {
    createObjectURL: () => { calls.push(['object-url']); return 'blob:qms-synthetic' },
    revokeObjectURL: value => revocations.push(value),
  }
  const { default: AdjuntoPreviewModal } = loadModule('components/quejas/AdjuntoPreviewModal.tsx', mocks, { URL: url })
  const adjunto = { id: 'adjunto-qms', storage_path: drive ? 'syntheticdrivefileid' : 'legacy/path.pdf',
    nombre: 'archivo.pdf', tipo_mime: 'application/pdf', tamano: 15 }
  const root = AdjuntoPreviewModal({ adjunto, onClose() {} })
  assert.ok(root?.type && typeof root.type === 'function')
  root.type(root.props)
  assert.equal(effects.length, 2)
  const cleanup = effects[1]()
  const flush = () => new Promise(setImmediate)
  return { state, changes, calls, revocations, cleanup, flush,
    changeSession(next) { store = next; for (const listener of [...listeners]) listener(store) } }
}

test('el visor Drive usa la API QMS, prepara blob y revoca al cerrar', async () => {
  const visit = makeVisit()
  await visit.flush()
  assert.equal(visit.calls[0][0], 'drive')
  assert.equal(visit.calls[0][1], 'syntheticdrivefileid')
  assert.equal(visit.calls[0][2].aborted, false)
  assert.equal(visit.state[0].url, 'blob:qms-synthetic')
  visit.cleanup()
  assert.deepEqual(visit.revocations, ['blob:qms-synthetic'])
})

test('cambiar de usuario interno invalida inmediatamente la vista, no el login Google', async () => {
  const visit = makeVisit()
  await visit.flush()
  visit.changeSession({ user: { id: 'otro-usuario' }, signingOut: false })
  assert.equal(visit.state[0].error, true)
  assert.deepEqual(visit.revocations, ['blob:qms-synthetic'])
  visit.cleanup()
  assert.equal(visit.revocations.length, 1)
})

test('los archivos Storage históricos se leen con la sesión QMS', async () => {
  const visit = makeVisit({ drive: false })
  await visit.flush()
  assert.deepEqual(visit.calls[0], ['storage', 'quejas-adjuntos', 'legacy/path.pdf'])
  visit.cleanup()
})

test('sin usuario QMS no inicia lectura de archivos', async () => {
  const visit = makeVisit({ user: false })
  await visit.flush()
  assert.equal(visit.state[0].error, true)
  assert.equal(visit.calls.length, 0)
  visit.cleanup()
})

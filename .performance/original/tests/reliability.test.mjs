import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

test('dashboard excluye estados terminales y devuelve los ocho vencimientos más urgentes', async () => {
  const quejas = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, estado: 'En Investigación', fecha_sla: `2026-09-${String(20 - i).padStart(2, '0')}` }))
  quejas.push(...['Finalizado', 'No Procede', 'Cerrada'].map((estado) => ({ id: estado, estado, fecha_sla: '2020-01-01' })))
  const db = fakeDatabase({ quejas, acciones: [], documentos: [], riesgos: [] })
  const { fetchDashboard } = loadModule('lib/queries/useDashboard.ts', { '@/lib/supabase': db, '@tanstack/react-query': {} })
  const result = await fetchDashboard()
  assert.equal(result.indicadores[0].valor, 12)
  assert.deepEqual(Array.from(result.tareas, (row) => row.id), ['q11', 'q10', 'q9', 'q8', 'q7', 'q6', 'q5', 'q4'])
})

test('dashboard propaga errores de BD en lugar de inventar indicadores en cero', async () => {
  const failure = new Error('BD no disponible')
  const db = fakeDatabase({}, { riesgos: failure })
  const { fetchDashboard } = loadModule('lib/queries/useDashboard.ts', { '@/lib/supabase': db, '@tanstack/react-query': {} })
  await assert.rejects(fetchDashboard(), /BD no disponible/)
})

test('paginación filtra antes de limitar y conserva el total del filtro', async () => {
  const docs = Array.from({ length: 90 }, (_, i) => ({ id: String(i).padStart(3, '0'), estado: i % 3 === 0 ? 'Borrador' : 'Publicado', created_at: '2026-01-01' }))
  const db = fakeDatabase({ documentos: docs })
  const { fetchPagina } = loadModule('lib/queries/pagination.ts', { '@/lib/supabase': db })
  const result = await fetchPagina('documentos', 'created_at', 1, 'Publicado')
  assert.equal(result.count, 60)
  assert.equal(result.data.length, 25)
  assert.equal(result.data[0].id, '038')
  assert.equal(db.calls[0].start, 25)
  assert.equal(db.calls[0].end, 49)
})

test('adjuntos valida vacío, límite exacto y exceso antes de hacer peticiones', () => {
  const { validarTamanoAdjunto, MAX_FILE_BYTES } = loadModule('lib/constants/adjuntos.ts')
  assert.throws(() => validarTamanoAdjunto({ size: 0 }), /vacío/)
  assert.doesNotThrow(() => validarTamanoAdjunto({ size: MAX_FILE_BYTES }))
  assert.throws(() => validarTamanoAdjunto({ size: MAX_FILE_BYTES + 1 }), /4 MB/)
})

test('lector multipart rechaza cuerpos grandes incluso sin Content-Length', async () => {
  const { readUploadForm } = loadModule('lib/server/uploadHelpers.ts')
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4_400_000)); controller.close() } })
  const request = new Request('http://localhost/upload', { method: 'POST', body, duplex: 'half' })
  await assert.rejects(readUploadForm(request), /máximo/)
})

test('lector multipart acepta un archivo permitido y conserva su contenido', async () => {
  const { readUploadForm } = loadModule('lib/server/uploadHelpers.ts')
  const form = new FormData()
  form.set('file', new File(['evidencia'], 'nota.txt', { type: 'text/plain' }))
  const result = await readUploadForm(new Request('http://localhost/upload', { method: 'POST', body: form }))
  assert.equal(await result.get('file').text(), 'evidencia')
})

test('un respaldo solo recibe el tiempo restante y no arranca al agotarse', () => {
  class Clock extends Date { static now() { return 49_000 } }
  const { tiempoDisponible } = loadModule('lib/server/deadline.ts', {}, { Date: Clock })
  assert.equal(tiempoDisponible(50_000, 30_000), 1_000)
  assert.throws(() => tiempoDisponible(49_000, 30_000), /agotado/)
})

test('la espera aborta aunque un proveedor no resuelva su promesa', async () => {
  const { esperarConSignal } = loadModule('lib/server/deadline.ts')
  const controller = new AbortController()
  const waiting = esperarConSignal(new Promise(() => {}), controller.signal)
  controller.abort(new Error('tiempo agotado'))
  await assert.rejects(waiting, /tiempo agotado/)
})

function deleteEndpoint(drive, dbError = null) {
  const events = []
  const admin = { from(table) {
    let deleting = false
    const query = {
      select() { return query }, eq() { return query },
      delete() { deleting = true; events.push('delete-db'); return query },
      maybeSingle: async () => ({ data: table === 'queja_adjuntos' ? { id: 'a', queja_id: 'q', usuario_id: null, storage_path: 'driveId' } : table === 'usuarios' ? { id: 'u' } : { responsable_id: 'u' } }),
      then(resolve, reject) { return Promise.resolve({ error: deleting ? dbError : null }).then(resolve, reject) },
    }
    return query
  } }
  const endpoint = loadModule('app/api/drive/delete/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/server/auth': { getCurrentUser: async () => ({ auth_id: 'auth', rol: 'admin' }) },
    '@/lib/server/supabase-admin': { createServiceClient: () => admin },
    '@/lib/server/drive': { eliminarArchivoDrive: async () => { events.push('drive'); return drive() } },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'test' },
  })
  return { events, run: () => endpoint.DELETE(new Request('http://localhost/delete', { method: 'DELETE', body: JSON.stringify({ adjuntoId: 'a' }) })) }
}

test('si Drive falla, no se borra el registro y se puede reintentar', async () => {
  const endpoint = deleteEndpoint(async () => false)
  assert.equal((await endpoint.run()).status, 502)
  assert.deepEqual(endpoint.events, ['drive'])
})

test('solo confirma eliminación después de Drive y de la base de datos', async () => {
  const endpoint = deleteEndpoint(async () => true)
  assert.equal((await endpoint.run()).status, 200)
  assert.deepEqual(endpoint.events, ['drive', 'delete-db'])
  const failed = deleteEndpoint(async () => true, new Error('BD caída'))
  assert.equal((await failed.run()).status, 500)
})

test('rate limit aísla rutas y renueva la ventana en su límite exacto', () => {
  let now = 0
  class Clock extends Date { static now() { return now } }
  const { rateLimit } = loadModule('lib/server/rateLimit.ts', {}, { Date: Clock })
  assert.equal(rateLimit('ip', 1, 1000, 'ia'), true)
  assert.equal(rateLimit('ip', 1, 1000, 'ia'), false)
  assert.equal(rateLimit('ip', 1, 1000, 'upload'), true)
  now = 1000
  assert.equal(rateLimit('ip', 1, 1000, 'ia'), true)
})

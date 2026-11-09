import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { loadModule } from './load-module.mjs'

const QID = '11111111-1111-4111-8111-111111111111'
const ACTOR = '22222222-2222-4222-8222-222222222222'
const ADJUNTO = '33333333-3333-4333-8333-333333333333'
const ROOT = 'synthetic-root-folder', CASE = 'synthetic-case-folder', ANALYSIS = 'synthetic-analysis-folder', FILE = 'synthetic-evidence-file'
const FOLIO = 'Q-SYNTHETIC-001', FOLDER_MIME = 'application/vnd.google-apps.folder', PRIVATE = 'SYNTHETIC_PRIVATE_DIAGNOSTIC'
const helpers = loadModule('lib/server/drive.ts')
const current = { id: ACTOR, auth_id: 'synthetic-auth', rol: 'colaborador' }
const attachment = { id: ADJUNTO, queja_id: QID, nombre: 'nota.txt', tipo_mime: 'text/plain', storage_path: FILE, usuario_id: ACTOR, tamano: 9, created_at: '2026-10-08T12:00:00Z' }

function fixture(options = {}) {
  const calls = [], logs = []
  const meta = {
    [ROOT]: { id: ROOT, mimeType: FOLDER_MIME, name: 'Raíz' },
    [CASE]: { id: CASE, mimeType: FOLDER_MIME, name: FOLIO, parents: [ROOT] },
    [ANALYSIS]: { id: ANALYSIS, mimeType: FOLDER_MIME, name: 'Analisis', parents: [CASE] },
    [FILE]: { id: FILE, mimeType: 'text/plain', name: 'nota.txt', parents: [ANALYSIS] },
    ...options.metadata,
  }
  let saved = false
  const drive = {
    permissions: { list: async ({ fileId, pageToken }) => {
      calls.push(['acl', fileId, pageToken])
      return { data: options.permissionPages?.[fileId]?.[pageToken ?? 'first'] ?? { permissions: options.publicFile === fileId ? [{ type: 'anyone' }] : [{ type: 'user' }] } }
    } },
    files: { get: async ({ fileId, alt }) => {
      calls.push([alt === 'media' ? 'media' : 'metadata', fileId])
      if (options.driveError) throw new Error(PRIVATE)
      if (alt === 'media') return { data: Readable.from([Buffer.from('evidencia')]), headers: options.mediaHeaders ?? {} }
      if (!meta[fileId]) throw Object.assign(new Error(PRIVATE), { code: 404 })
      return { data: meta[fileId] }
    } },
  }
  const admin = {
    from(table) {
      let deletion = false
      const query = { select() { return query }, eq() { return query }, limit() { return query }, delete() { deletion = true; calls.push(['delete-db']); return query },
        maybeSingle: async () => ({ data: table === 'queja_adjuntos' ? options.lookupError ? null : saved || !options.upload ? { ...attachment, ...options.attachment } : null : table === 'quejas' ? { folio: FOLIO, responsable_id: options.responsible ?? ACTOR } : { valor: ROOT }, error: table === 'queja_adjuntos' && options.lookupError ? new Error(PRIVATE) : null }),
        then(resolve, reject) { return Promise.resolve({ error: deletion && options.dbDeleteError ? new Error(PRIVATE) : null }).then(resolve, reject) },
      }
      return query
    },
    rpc: async (name, args) => {
      calls.push(['rpc', name, args])
      if (options.commitLost) saved = true
      if (options.rpcError || options.commitLost) return { data: null, error: options.rpcError ?? new Error(PRIVATE) }
      saved = true
      return { data: attachment, error: null }
    },
  }
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/server/auth': { getCurrentUser: async () => options.user === null ? null : options.user ?? current },
    '@/lib/server/supabase-admin': { createServiceClient: () => { calls.push(['backend']); return admin } },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'synthetic-ip' },
    '@/lib/server/drive': {
      getDriveClient: () => { calls.push(['drive']); return drive },
      assertPrivateDriveFolder: helpers.assertPrivateDriveFolder, assertDriveCaseFile: helpers.assertDriveCaseFile,
      buscarOCrearSubcarpeta: async (_drive, parent, name) => { calls.push(['folder', parent, name]); return name === 'Analisis' ? ANALYSIS : CASE },
      subirArchivoASubcarpeta: async (_folder, file) => { calls.push(['upload', file]); return { id: FILE } },
      eliminarArchivoDrive: async id => { calls.push(['delete-drive', id]); return !options.deleteFailure },
    },
    '@/lib/server/driveContext': { programarContextoDrive: id => calls.push(['context', id]) },
  }
  const globals = { Headers, process: { env: { NODE_ENV: 'test', ...options.env } }, console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) } }
  return {
    calls, logs, drive,
    download: loadModule('app/api/drive/download/route.ts', mocks, globals).GET,
    delete: loadModule('app/api/drive/delete/route.ts', mocks, globals).DELETE,
    upload: loadModule('app/api/drive/upload/route.ts', mocks, globals).POST,
  }
}
function downloadRequest() { const request = new Request('https://synthetic.test/api/drive/download?id=' + FILE); request.nextUrl = new URL(request.url); return request }
const deleteRequest = input => new Request('https://synthetic.test/api/drive/delete', { method: 'DELETE', body: JSON.stringify(input ?? { adjuntoId: ADJUNTO }) })
function uploadRequest(extra = {}) {
  const form = new FormData(); form.set('file', new File(['evidencia'], 'nota.txt', { type: 'text/plain' })); form.set('queja_id', QID)
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  return new Request('https://synthetic.test/api/drive/upload', { method: 'POST', body: form })
}

test('oficio publicado o reserva fallida bloquea el borrado antes de Drive y metadatos', async () => {
  for (const [rpcError, expected] of [[{ code: '55000' }, 409], [{ code: 'XX000' }, 503]]) {
    const f = fixture({ rpcError })
    assert.equal((await f.delete(deleteRequest())).status, expected)
    assert.ok(f.calls.some(call => call[0] === 'rpc' && call[1] === 'qms_claim_attachment_delete'))
    assert.ok(!f.calls.some(call => ['delete-drive', 'delete-db'].includes(call[0])))
  }
})

test('subida interna admite los mismos nombres institucionales de hasta 255 caracteres que la publicación', async () => {
  const name = 'a'.repeat(196) + '.txt'
  const f = fixture({ upload: true })
  const response = await f.upload(uploadRequest({ file: new File(['evidencia'], name, { type: 'text/plain' }) }))
  assert.equal(response.status, 200)
  assert.equal(f.calls.find(call => call[0] === 'rpc' && call[1] === 'registrar_adjunto_queja_servidor')[2].p_nombre, name)
})

test('solo un RPC ausente permite compatibilidad antes del despliegue; activado falla cerrado', async () => {
  const legacy = fixture({ rpcError: { code: 'PGRST202' } })
  assert.equal((await legacy.delete(deleteRequest())).status, 200)
  const active = fixture({ rpcError: { code: 'PGRST202' }, env: { PUBLIC_TRACKING_ENABLED: 'true' } })
  assert.equal((await active.delete(deleteRequest())).status, 503)
  assert.ok(!active.calls.some(call => ['delete-drive', 'delete-db'].includes(call[0])))
})

// Solo módulos reales + dobles sintéticos: no Drive/DB/red ni credenciales reales.
test('las tres rutas Drive privadas rechazan una sesión inválida antes del backend', async () => {
  for (const [method, request] of [['download', downloadRequest], ['delete', deleteRequest], ['upload', uploadRequest]]) {
    const f = fixture({ user: null }); assert.equal((await f[method](request())).status, 401); assert.equal(f.calls.length, 0)
  }
})
test('otro responsable no puede subir, descargar ni borrar aunque conozca el ID', async () => {
  for (const [method, request] of [['download', downloadRequest], ['delete', deleteRequest], ['upload', uploadRequest]]) {
    const f = fixture({ responsible: 'otro-usuario' }); assert.equal((await f[method](request())).status, 403)
    assert.equal(f.calls.some(call => ['drive','upload','media','delete-drive'].includes(call[0])), false)
  }
})
test('los adjuntos de cliente solo pueden eliminarlos administradores', async () => {
  for (const rol of ['colaborador', 'calidad']) {
    const f = fixture({ user: { ...current, rol }, attachment: { usuario_id: null } })
    assert.equal((await f.delete(deleteRequest())).status, 403); assert.equal(f.calls.some(call => call[0] === 'drive'), false)
  }
})
test('un rol distinto de colaborador no gana acceso por estar asignado como responsable', async () => {
  for (const [method, request] of [['download', downloadRequest], ['delete', deleteRequest], ['upload', uploadRequest]]) {
    const f = fixture({ user: { ...current, rol: 'auditor' } })
    assert.equal((await f[method](request())).status, 403)
    assert.equal(f.calls.some(call => ['drive','upload','media','delete-drive'].includes(call[0])), false)
  }
})
test('el origen físico público exige admin aunque la fila falsee usuario_id como interno', async () => {
  for (const rol of ['colaborador', 'calidad', 'admin']) {
    const f = fixture({ user: { ...current, rol }, metadata: { [FILE]: { id: FILE, mimeType: 'text/plain', parents: [CASE] } }, attachment: { usuario_id: ACTOR } })
    assert.equal((await f.delete(deleteRequest())).status, rol === 'admin' ? 200 : 403)
    assert.equal(f.calls.some(call => call[0] === 'delete-drive'), rol === 'admin')
    assert.equal(f.calls.some(call => call[0] === 'delete-db'), rol === 'admin')
  }
})
test('la pertenencia admite archivo cliente directo y archivo de análisis sin crear carpetas', async () => {
  for (const parents of [[CASE], [ANALYSIS]]) {
    const f = fixture({ metadata: { [FILE]: { id: FILE, mimeType: 'text/plain', parents } } })
    assert.equal(await helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO), parents[0] === CASE ? 'public' : 'internal')
    assert.equal(f.calls.some(call => call[0] === 'folder'), false)
  }
})
test('una fila forjada no autoriza descargar ni borrar un archivo de otra queja', async () => {
  const foreign = { id: CASE, mimeType: FOLDER_MIME, name: 'Q-OTHER', parents: [ROOT] }
  for (const method of ['download', 'delete']) {
    const f = fixture({ metadata: { [CASE]: foreign } })
    assert.equal((await f[method](method === 'download' ? downloadRequest() : deleteRequest())).status, 403)
    assert.equal(f.calls.some(call => ['media','delete-drive','delete-db'].includes(call[0])), false)
  }
})
test('carpetas falsas, raíces distintas, recursos trashed y archivos con varios padres fallan cerrados', async () => {
  for (const metadata of [
    { [CASE]: { id: CASE, mimeType: 'text/plain', name: FOLIO, parents: [ROOT] } },
    { [CASE]: { id: CASE, mimeType: FOLDER_MIME, name: FOLIO, parents: ['other-root'] } },
    { [FILE]: { id: FILE, mimeType: 'text/plain', parents: [CASE], trashed: true } },
    { [FILE]: { id: FILE, mimeType: 'text/plain', parents: [CASE, 'other'] } },
  ]) {
    const f = fixture({ metadata }); await assert.rejects(helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO), error => error.code === 'DRIVE_EVIDENCE_SCOPE')
  }
})
test('permiso público en cualquiera de los recursos o en otra página bloquea lectura y escritura', async () => {
  for (const publicFile of [ROOT, CASE, ANALYSIS, FILE]) {
    const f = fixture({ publicFile, upload: true }); assert.equal((await f.upload(uploadRequest())).status, 502)
    assert.equal(f.calls.some(call => call[0] === 'rpc'), false)
  }
  const f = fixture({ permissionPages: { [FILE]: { first: { permissions: [{ type: 'user' }], nextPageToken: 'second' }, second: { permissions: [{ type: 'anyone' }] } } } })
  await assert.rejects(helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO), /acceso restringido/)
})
test('una respuesta ACL incompleta no se interpreta como carpeta privada', async () => {
  const f = fixture({ permissionPages: { [ROOT]: { first: {} } }, upload: true })
  assert.equal((await f.upload(uploadRequest())).status, 502)
  assert.equal(f.calls.some(call => ['upload','rpc'].includes(call[0])), false)
})
test('errores Google no aparecen en respuestas ni logs de las rutas privadas', async () => {
  for (const method of ['download','delete','upload']) {
    const f = fixture({ driveError: true, upload: method === 'upload' })
    const response = await f[method](method === 'download' ? downloadRequest() : method === 'delete' ? deleteRequest() : uploadRequest())
    assert.equal(response.status, 502)
    assert.equal((await response.text()).includes(PRIVATE), false); assert.equal(JSON.stringify(f.logs).includes(PRIVATE), false)
  }
})
test('upload privado registra el actor autenticado y el ID recién creado solo en servidor', async () => {
  const f = fixture({ upload: true }); const response = await f.upload(uploadRequest())
  assert.equal(response.status, 200); assert.equal((await response.json()).adjunto.id, ADJUNTO)
  const call = f.calls.find(call => call[0] === 'rpc'); assert.equal(call[1], 'registrar_adjunto_queja_servidor')
  assert.equal(call[2].p_actor_id, ACTOR); assert.equal(call[2].p_queja_id, QID); assert.equal(call[2].p_storage_path, FILE)
  const forged = fixture({ upload: true }); assert.equal((await forged.upload(uploadRequest({ drive_file_id: 'foreign-id', usuario_id: 'other' }))).status, 400)
  assert.equal(forged.calls.some(call => call[0] === 'drive'), false)
})
test('un commit privado con respuesta perdida se recupera sin borrar el archivo confirmado', async () => {
  const f = fixture({ upload: true, commitLost: true }); assert.equal((await f.upload(uploadRequest())).status, 200)
  assert.equal(f.calls.some(call => call[0] === 'delete-drive'), false)
})
test('rechazo confirmado de cuota compensa solo el archivo propio; consulta ambigua lo conserva', async () => {
  const f = fixture({ upload: true, rpcError: { code: '54000', message: PRIVATE } }); const response = await f.upload(uploadRequest())
  assert.equal(response.status, 409); assert.deepEqual(f.calls.filter(call => call[0] === 'delete-drive'), [['delete-drive', FILE]])
  const unknown = fixture({ upload: true, rpcError: new Error(PRIVATE), lookupError: true }); assert.equal((await unknown.upload(uploadRequest())).status, 502)
  assert.equal(unknown.calls.some(call => call[0] === 'delete-drive'), false)
})
test('solo un archivo ausente permite reintentar limpiar metadatos; un 404 de raíz no autoriza borrar', async () => {
  const absent = fixture({ metadata: { [FILE]: undefined } }); assert.equal((await absent.delete(deleteRequest())).status, 200)
  assert.equal(absent.calls.some(call => call[0] === 'delete-drive'), false)
  const wrongRoot = fixture({ metadata: { [ROOT]: undefined } }); assert.equal((await wrongRoot.delete(deleteRequest())).status, 502)
  assert.equal(wrongRoot.calls.some(call => ['delete-drive','delete-db'].includes(call[0])), false)
})
test('el cliente privado no registra Drive IDs mediante RPC después de subir', async () => {
  const calls = []
  const service = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } } }) }, rpc: () => { throw new Error('Browser RPC must not register Drive IDs') } } },
    '@/lib/services/driveClient': { fetchDriveBlob: async () => new Blob() },
  }, { fetch: async (url, options) => { calls.push([url, options]); return Response.json({ adjunto: attachment }) } })
  const result = await service.subirAdjuntoQueja(QID, new File(['evidencia'], 'nota.txt', { type: 'text/plain' }))
  assert.equal(result.id, ADJUNTO); assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/drive/upload')
})


function deferredDrive(origin = 'internal') {
  const pending = new Map(), calls = []
  const metadata = {
    [ROOT]: { id: ROOT, mimeType: FOLDER_MIME, name: 'Raíz' },
    [CASE]: { id: CASE, mimeType: FOLDER_MIME, name: FOLIO, parents: [ROOT] },
    [ANALYSIS]: { id: ANALYSIS, mimeType: FOLDER_MIME, name: 'Analisis', parents: [CASE] },
    [FILE]: { id: FILE, mimeType: 'text/plain', parents: [origin === 'internal' ? ANALYSIS : CASE] },
  }
  const hold = (kind, id) => {
    const key = kind + ':' + id
    calls.push(key)
    return new Promise((resolve, reject) => pending.set(key, { resolve, reject }))
  }
  return {
    calls,
    drive: { files: { get: ({ fileId }) => hold('metadata', fileId) }, permissions: { list: ({ fileId }) => hold('acl', fileId) } },
    finish(kind, id, data) {
      const key = kind + ':' + id
      assert.ok(pending.has(key), 'La lectura debe haber empezado: ' + key)
      pending.get(key).resolve({ data: data ?? (kind === 'metadata' ? metadata[id] : { permissions: [{ type: 'user' }] }) })
      pending.delete(key)
    },
    missing(id) { pending.get('metadata:' + id).reject(Object.assign(new Error(PRIVATE), { code: 404 })); pending.delete('metadata:' + id) },
  }
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve))

test('las lecturas de privacidad y metadata se solapan sin adelantar los parents: dos fases públicas y tres internas', async () => {
  for (const origin of ['public', 'internal']) {
    const f = deferredDrive(origin)
    let settled = false
    const checking = helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO).finally(() => { settled = true })
    assert.deepEqual(new Set(f.calls), new Set(['metadata:' + ROOT, 'acl:' + ROOT, 'metadata:' + FILE, 'acl:' + FILE]))
    // El archivo puede responder primero, pero no concede acceso antes de la raíz.
    f.finish('metadata', FILE); f.finish('acl', FILE)
    await nextTurn()
    assert.equal(settled, false); assert.equal(f.calls.length, 4)
    f.finish('metadata', ROOT); f.finish('acl', ROOT)
    await nextTurn()
    const parent = origin === 'internal' ? ANALYSIS : CASE
    assert.deepEqual(new Set(f.calls.slice(4)), new Set(['metadata:' + parent, 'acl:' + parent]))
    f.finish('metadata', parent)
    await nextTurn()
    assert.equal(settled, false); assert.equal(f.calls.length, 6)
    f.finish('acl', parent)
    await nextTurn()
    if (origin === 'internal') {
      assert.deepEqual(new Set(f.calls.slice(6)), new Set(['metadata:' + CASE, 'acl:' + CASE]))
      f.finish('metadata', CASE); f.finish('acl', CASE)
    }
    assert.equal(await checking, origin)
    assert.equal(f.calls.length, origin === 'internal' ? 8 : 6)
  }
})

test('un 404 rápido del archivo conserva el fallo de privacidad de la raíz sin autorizar limpieza', async () => {
  const f = deferredDrive()
  const outcome = helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO).then(value => ({ value }), error => ({ error }))
  f.missing(FILE); f.finish('acl', FILE); f.finish('metadata', ROOT)
  await nextTurn()
  assert.equal(f.calls.length, 4)
  f.finish('acl', ROOT, { permissions: [{ type: 'anyone' }] })
  const { error } = await outcome
  assert.match(error.message, /acceso restringido/); assert.notEqual(error.code, 'DRIVE_FILE_MISSING')
})

test('archivo ausente no permite borrar DB cuando la raíz también falta o es inválida', async () => {
  for (const root of [undefined, { id: ROOT, mimeType: 'text/plain' }, { id: ROOT, mimeType: FOLDER_MIME, trashed: true }]) {
    const f = fixture({ metadata: { [ROOT]: root, [FILE]: undefined } })
    const response = await f.delete(deleteRequest())
    assert.equal(response.status, root === undefined ? 502 : 403)
    assert.equal(f.calls.some(call => ['delete-drive', 'delete-db'].includes(call[0])), false)
  }
})

test('cada visita vuelve a verificar ACL; un permiso revocado entre visitas bloquea la siguiente', async () => {
  const options = {}, f = fixture(options)
  assert.equal(await helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO), 'internal')
  options.publicFile = ANALYSIS
  await assert.rejects(helpers.assertDriveCaseFile(f.drive, ROOT, FILE, FOLIO), /acceso restringido/)
  assert.equal(f.calls.filter(call => call[0] === 'acl' && call[1] === ANALYSIS).length, 2)
})

test('pagination ACL sin final verificable falla cerrado y mantiene un trabajo acotado', async () => {
  let pages = 0
  const drive = { permissions: { list: async () => { pages++; return { data: { permissions: [{ type: 'user' }], nextPageToken: 'still-pending' } } } } }
  await assert.rejects(helpers.assertPrivateDriveFolder(drive, ROOT), /No se pudo verificar/)
  assert.equal(pages, 20)
})

test('descarga usa MIME real de Drive y Headers actual sin perder Content-Length', async () => {
  for (const mediaHeaders of [new Headers({ 'content-type': 'application/pdf; charset=binary', 'content-length': '9' }), { 'content-type': 'application/pdf', 'content-length': '9' }]) {
    const f = fixture({ attachment: { tipo_mime: 'application/octet-stream' }, mediaHeaders })
    const response = await f.download(downloadRequest())
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf')
    assert.equal(response.headers.get('content-length'), '9')
    assert.match(response.headers.get('content-disposition'), /^attachment;/)
  }
})

test('reintento tras papelera conserva autorización y origen; nunca habilita descarga', async () => {
  const internal = fixture({ metadata: { [FILE]: { id: FILE, mimeType: 'text/plain', parents: [ANALYSIS], trashed: true } } })
  assert.equal((await internal.download(downloadRequest())).status, 403)
  assert.equal((await internal.delete(deleteRequest())).status, 200)
  const publicFile = { id: FILE, mimeType: 'text/plain', parents: [CASE], trashed: true }
  const quality = fixture({ user: { ...current, rol: 'calidad' }, metadata: { [FILE]: publicFile } })
  assert.equal((await quality.delete(deleteRequest())).status, 403)
  assert.equal(quality.calls.some(call => call[0] === 'delete-db'), false)
  const admin = fixture({ user: { ...current, rol: 'admin' }, metadata: { [FILE]: publicFile } })
  assert.equal((await admin.delete(deleteRequest())).status, 200)
})

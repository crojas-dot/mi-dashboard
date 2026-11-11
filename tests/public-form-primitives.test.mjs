import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { jsPDF } from 'jspdf'
import { loadModule } from './load-module.mjs'

const validation = loadModule('lib/server/publicForms/validation.ts')
const bodies = loadModule('lib/server/publicForms/bodies.ts')
const capabilities = loadModule('lib/server/publicForms/uploadCapability.ts')
const files = loadModule('lib/server/publicForms/files.ts')
const config = loadModule('lib/server/publicForms/config.ts')
const limits = loadModule('lib/constants/publicForms.ts')
const SECRET = 'synthetic-public-form-test-secret-0000000000'
const OTHER_SECRET = 'synthetic-other-public-secret-0000000000000'
const NOW = 1791489600000
const FORM = '12345678-1234-4234-8234-123456789abc'
const SUBMISSION = '22345678-1234-4234-8234-123456789abc'
const QUEJA = '32345678-1234-4234-8234-123456789abc'
const OTHER = '42345678-1234-4234-8234-123456789abc'
const draft = {
  formToken: '12345678123442348234123456789abc', submissionId: SUBMISSION, honeypot: '',
  nombre: ' Nombre sintético ', email: ' Persona@Example.TEST ', telefono: ' 12345678 ',
  categoria: 'Queja', descripcion: ' Una descripción sintética. ',
}
const status = expected => error => error?.status === expected
const request = (body, headers = {}) => new Request('https://example.test/api/public/quejas', {
  method: 'POST', body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  headers: { 'Content-Type': 'application/json', ...headers },
})
function signClaims(claims, header = { alg: 'HS256', typ: 'QMS-UPLOAD', v: 1 }) {
  const data = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url')
  return data + '.' + createHmac('sha256', SECRET).update('qms-public-upload-v1\0').update(data).digest('base64url')
}
const originalClaims = { purpose: 'upload', formId: FORM, submissionId: SUBMISSION, quejaId: QUEJA, iat: Math.floor(NOW / 1000), exp: Math.floor(NOW / 1000) + 1800 }

test('normaliza solamente los campos ciudadanos y conserva los tipos vigentes del formulario', () => {
  const normalized = validation.validatePublicSubmission(draft)
  assert.equal(normalized.nombre, 'Nombre sintético')
  assert.equal(normalized.email, 'persona@example.test')
  assert.equal(normalized.telefono, '12345678')
  assert.equal(normalized.descripcion, 'Una descripción sintética.')
  assert.deepEqual([...limits.CATEGORIAS_PUBLICAS], ['Queja', 'Observación', 'Sugerencia', 'Reclamo', 'Felicitación'])
  for (const categoria of limits.CATEGORIAS_PUBLICAS) assert.equal(validation.validatePublicSubmission({ ...draft, categoria }).categoria, categoria)
  assert.throws(() => validation.validatePublicSubmission({ ...draft, categoria: 'Denuncia' }), status(400))
})

test('rechaza todos los campos administrativos extra y tipos ajenos al contrato', () => {
  for (const field of ['id', 'quejaId', 'formId', 'estado', 'responsable_id', 'prioridad', 'folio', 'workflow_revision', 'creado_por', '__proto__']) {
    const payload = JSON.parse(JSON.stringify({ ...draft, [field]: 'dato sintético' }))
    assert.throws(() => validation.validatePublicSubmission(payload), status(400), field)
  }
  for (const value of [null, [], 'texto', 1]) assert.throws(() => validation.validatePublicSubmission(value), status(400))
  for (const field of ['nombre', 'email', 'telefono', 'categoria', 'descripcion']) {
    assert.throws(() => validation.validatePublicSubmission({ ...draft, [field]: null }), status(400), field)
  }
})

test('exige correo, admite teléfono opcional y aplica límites exactos después de normalizar', () => {
  const normalized = validation.validatePublicSubmission({ ...draft, telefono: undefined })
  assert.equal(normalized.email, 'persona@example.test')
  assert.equal(normalized.telefono, '')
  for (const email of [undefined, null, '', '   ', 'sin correo']) {
    assert.throws(() => validation.validatePublicSubmission({ ...draft, email }), status(400))
  }
  for (const [field, maximum] of [['nombre', 50], ['telefono', 25], ['descripcion', 10000]]) {
    assert.equal(validation.validatePublicSubmission({ ...draft, [field]: (field === 'telefono' ? '1' : 'a').repeat(maximum) })[field].length, maximum)
    assert.throws(() => validation.validatePublicSubmission({ ...draft, [field]: (field === 'telefono' ? '1' : 'a').repeat(maximum + 1) }), status(400))
  }
  assert.throws(() => validation.validatePublicSubmission({ ...draft, email: 'a'.repeat(247) + '@ex.test' }), status(400))
  assert.throws(() => validation.validatePublicSubmission({ ...draft, email: 'sin correo' }), status(400))
  for (const field of ['nombre', 'descripcion']) assert.throws(() => validation.validatePublicSubmission({ ...draft, [field]: '  ' }), status(400))
  assert.throws(() => validation.validatePublicSubmission({ ...draft, nombre: 'dato\u0000' }), status(400))
  assert.throws(() => validation.validatePublicSubmission({ ...draft, categoria: 'Administrativo' }), status(400))
})

test('token exige hex de 32 caracteres y submissionId UUID aleatorio v4', () => {
  for (const formToken of ['a'.repeat(31), 'a'.repeat(33), 'A'.repeat(32), 'g'.repeat(32), ' ' + draft.formToken, FORM, null]) {
    assert.throws(() => validation.validatePublicSubmission({ ...draft, formToken }), status(400))
  }
  for (const submissionId of ['', '123', '22345678-1234-1234-8234-123456789abc', '22345678-1234-4234-1234-123456789abc', null]) {
    assert.throws(() => validation.validatePublicSubmission({ ...draft, submissionId }), status(400))
  }
  assert.equal(validation.validatePublicSubmission({ ...draft, submissionId: SUBMISSION.toUpperCase() }).submissionId, SUBMISSION)
  assert.throws(() => validation.validatePublicSubmission({ ...draft, honeypot: 'bot' }), status(403))
})

test('hash canónico excluye token, idempotencia y honeypot, pero liga formulario y contenido', () => {
  const normalized = validation.validatePublicSubmission(draft)
  const first = validation.hashPublicPayload(FORM, normalized)
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(first, validation.hashPublicPayload(FORM, { ...normalized, formToken: 'a'.repeat(32), submissionId: OTHER, honeypot: 'ignored' }))
  assert.notEqual(first, validation.hashPublicPayload(OTHER, normalized))
  assert.notEqual(first, validation.hashPublicPayload(FORM, { ...normalized, descripcion: 'Otro contenido' }))
})

test('finalizar recibe solamente una capacidad sin IDs libres', () => {
  assert.equal(validation.validatePublicFinalization({ uploadToken: 'capacidad' }), 'capacidad')
  for (const value of [{ uploadToken: 'capacidad', quejaId: QUEJA }, { uploadToken: '' }, { uploadToken: 1 }, { uploadToken: 'x'.repeat(2049) }]) {
    assert.throws(() => validation.validatePublicFinalization(value), status(400))
  }
})

test('JSON se limita por bytes reales a 64 KiB aunque no haya Content-Length', async () => {
  const valid = JSON.stringify('x'.repeat(limits.MAX_PUBLIC_JSON_BYTES - 2))
  assert.equal((await bodies.readPublicJson(request(valid))).length, limits.MAX_PUBLIC_JSON_BYTES - 2)
  await assert.rejects(bodies.readPublicJson(request(valid + ' ')), status(413))
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(limits.MAX_PUBLIC_JSON_BYTES + 1)) },
    cancel() { cancelled = true },
  })
  await assert.rejects(bodies.readPublicJson(request(stream, { 'Content-Length': '1' })), status(413))
  assert.equal(cancelled, true)
})

test('rechaza JSON malformado, claves duplicadas incluso escapadas y UTF-8 inválido', async () => {
  for (const value of ['{', '{"nombre":"a","nombre":"b"}', '{"nombre":"a","nom\\u0062re":"b"}', '{"obj":{"x":1,"x":2}}']) {
    await assert.rejects(bodies.readPublicJson(request(value)), status(400))
  }
  await assert.rejects(bodies.readPublicJson(request(Buffer.from([0xff]))), status(400))
  await assert.rejects(bodies.readPublicJson(request('{}', { 'Content-Type': 'text/plain' })), status(415))
  await assert.rejects(bodies.readPublicJson(request('{}', { 'Content-Length': String(limits.MAX_PUBLIC_JSON_BYTES + 1) })), status(413))
  await assert.rejects(bodies.readPublicJson(request('{}', { 'Content-Length': '-1' })), status(400))
  assert.equal((await bodies.readPublicJson(request('{"value":"quote \\" brace { colon :","arr":[{"x":1},{"x":2}]}'))).arr.length, 2)
})

test('configuración exige secreto dedicado mínimo 32 bytes y falla cerrada con el interruptor', () => {
  assert.equal(config.getPublicFormsConfig({ PUBLIC_FORMS_SIGNING_SECRET: SECRET }).signingSecret, SECRET)
  assert.equal(config.getPublicFormsConfig({ PUBLIC_FORMS_ENABLED: 'true', PUBLIC_FORMS_SIGNING_SECRET: SECRET }).signingSecret, SECRET)
  for (const environment of [{}, { PUBLIC_FORMS_SIGNING_SECRET: 'x'.repeat(31) }, { PUBLIC_FORMS_SIGNING_SECRET: ' '.repeat(32) },
    { PUBLIC_FORMS_SIGNING_SECRET: SECRET, PUBLIC_FORMS_ENABLED: 'false' }, { PUBLIC_FORMS_SIGNING_SECRET: SECRET, PUBLIC_FORMS_ENABLED: 'TRUE' },
    { SUPABASE_SERVICE_ROLE_KEY: SECRET }]) {
    assert.throws(() => config.getPublicFormsConfig(environment), status(503))
  }
  assert.throws(() => capabilities.issueUploadCapability({ formId: FORM, submissionId: SUBMISSION, quejaId: QUEJA }, 'corto', NOW), status(503))
})

test('capacidad HS256 de upload dura 30 minutos y es estable para fecha de creación persistida', () => {
  const input = { formId: FORM, submissionId: SUBMISSION, quejaId: QUEJA, issuedAt: new Date(NOW).toISOString() }
  const issued = capabilities.issueUploadCapability(input, SECRET, NOW)
  assert.equal(issued.uploadToken.split('.').length, 3)
  assert.equal(issued.expiresAt, new Date(NOW + 1800000).toISOString())
  assert.equal(capabilities.issueUploadCapability(input, SECRET, NOW + 60000).uploadToken, issued.uploadToken)
  assert.deepEqual(JSON.parse(JSON.stringify(capabilities.verifyUploadCapability(issued.uploadToken, SECRET, NOW))), originalClaims)
  assert.equal(capabilities.verifyUploadCapability(issued.uploadToken, SECRET, NOW + 1799999).quejaId, QUEJA)
  assert.throws(() => capabilities.verifyUploadCapability(issued.uploadToken, SECRET, NOW + 1800000), status(410))
})

test('capacidad rechaza firma, algoritmo, purpose, actores y tiempos alterados', () => {
  const issued = capabilities.issueUploadCapability({ formId: FORM, submissionId: SUBMISSION, quejaId: QUEJA }, SECRET, NOW)
  assert.throws(() => capabilities.verifyUploadCapability(issued.uploadToken, OTHER_SECRET, NOW), status(403))
  for (const field of ['formId', 'submissionId', 'quejaId']) {
    const parts = issued.uploadToken.split('.')
    const changed = { ...originalClaims, [field]: OTHER }
    parts[1] = Buffer.from(JSON.stringify(changed)).toString('base64url')
    assert.throws(() => capabilities.verifyUploadCapability(parts.join('.'), SECRET, NOW), status(403))
    assert.throws(() => capabilities.verifyUploadCapability(signClaims({ ...originalClaims, [field]: 'malformed' }), SECRET, NOW), status(403))
  }
  for (const claims of [{ ...originalClaims, purpose: 'finalize' }, { ...originalClaims, admin: true }, { ...originalClaims, exp: originalClaims.exp + 1 },
    { ...originalClaims, iat: originalClaims.iat + 1, exp: originalClaims.exp + 1 }, { ...originalClaims, iat: 'now' }]) {
    assert.throws(() => capabilities.verifyUploadCapability(signClaims(claims), SECRET, NOW), status(403))
  }
  assert.throws(() => capabilities.verifyUploadCapability(signClaims(originalClaims, { alg: 'none', typ: 'QMS-UPLOAD', v: 1 }), SECRET, NOW), status(403))
  for (const token of [null, '', issued.uploadToken + '=', issued.uploadToken + '.more', 'x'.repeat(2049)]) {
    assert.throws(() => capabilities.verifyUploadCapability(token, SECRET, NOW), status(403))
  }
})

test('HMAC de cuotas es determinista, no contiene la IP y cambia al rotar secreto', () => {
  const key = capabilities.hashPublicRateKey('192.0.2.1', SECRET)
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.equal(key, capabilities.hashPublicRateKey('192.0.2.1', SECRET))
  assert.notEqual(key, capabilities.hashPublicRateKey('192.0.2.2', SECRET))
  assert.notEqual(key, capabilities.hashPublicRateKey('192.0.2.1', OTHER_SECRET))
  assert.notEqual(key, createHmac('sha256', SECRET).update('192.0.2.1').digest('hex'))
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(kind, data) {
  const bytes = Buffer.alloc(data.length + 12)
  bytes.writeUInt32BE(data.length); bytes.write(kind, 4, 'ascii'); data.copy(bytes, 8)
  bytes.writeUInt32BE(crc32(bytes.subarray(4, data.length + 8)), data.length + 8)
  return bytes
}
function png() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))])
}
function segment(marker, data) {
  const header = Buffer.from([255, marker, 0, 0]); header.writeUInt16BE(data.length + 2, 2)
  return Buffer.concat([header, data])
}
function jpeg(width = 1, height = 1) {
  const dc = Buffer.from([0, 1, ...new Array(15).fill(0), 0])
  const ac = Buffer.from([16, 1, ...new Array(15).fill(0), 0])
  return Buffer.concat([Buffer.from([255, 216]), segment(0xdb, Buffer.from([0, ...new Array(64).fill(1)])),
    segment(0xc4, Buffer.concat([dc, ac])), segment(0xc0, Buffer.from([8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 17, 0])),
    segment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([63, 255, 217])])
}
function pdf(extra = '', stream, streamType = '') {
  const objects = ['<< /Type /Catalog /Pages 2 0 R ' + extra + ' >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>']
  if (stream) objects.push('<< /Length ' + stream.length + ' /Filter /FlateDecode ' + streamType + ' >>\nstream\n' + stream.toString('latin1') + '\nendstream')
  let source = '%PDF-1.7\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(source, 'latin1'))
    source += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n'
  }
  const startxref = Buffer.byteLength(source, 'latin1')
  source += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n'
  source += offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  source += 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF\n'
  return Buffer.from(source, 'latin1')
}
const meta = (bytes, name, type) => ({ name, type, size: bytes.length })

test('PDF generados por el sistema admiten vista inicial y zoom normales, comprimidos o no', () => {
  for (const compress of [false, true]) for (const mode of ['fullwidth', 'fullheight', 'fullpage', 'original', '125%']) {
    const document = new jsPDF({ compress })
    document.text('Documento sintético de prueba.', 20, 20)
    document.setDisplayMode(mode)
    const bytes = Buffer.from(document.output('arraybuffer'))
    assert.equal(files.validatePublicFile(meta(bytes, 'informe.pdf', 'application/pdf'), bytes).size, bytes.length)
  }
})

test('OpenAction permite destinos de vista cerrados y conserva el rechazo de acciones o destinos ambiguos', () => {
  for (const value of ['[3 0 R /XYZ null 10 1.25]', '[3 0 R /Fit]', '[3 0 R /FitH null]', '[3 0 R /FitV 0]', '[3 0 R /FitR -1 0 100 100]', '[3 0 R /FitB]', '[3 0 R /FitBH null]', '[3 0 R /FitBV 1]', '[3 0 R % vista inicial\n/FitH null]']) {
    for (const key of ['OpenAction', 'Open#41ction']) {
      const bytes = pdf('/' + key + ' ' + value)
      assert.equal(files.validatePublicFile(meta(bytes, 'vista.pdf', 'application/pdf'), bytes).mimeType, 'application/pdf')
      const compressed = pdf('', deflateSync(Buffer.from('/' + key + ' ' + value)), '/Type /ObjStm')
      assert.equal(files.validatePublicFile(meta(compressed, 'vista.pdf', 'application/pdf'), compressed).mimeType, 'application/pdf')
    }
  }
  for (const value of ['4 0 R', '<< /S /JavaScript /JS (sintético) >>', '<< /S /Launch /F (sintético) >>', '[3 0 R /Fit /Next 4 0 R]', '[3 0 R /XYZ null null (sintético)]', '[3 0 R /FitR null 0 1 1]', '[3 0 R /Unknown]', '[3 99999 R /Fit]', '[3 0 R /Fit', '[3 0 R /XYZ null null 1e200]']) {
    for (const bytes of [pdf('/OpenAction ' + value), pdf('', deflateSync(Buffer.from('/OpenAction ' + value)), '/Type /ObjStm')]) {
      assert.throws(() => files.validatePublicFile(meta(bytes, 'accion.pdf', 'application/pdf'), bytes), status(415))
    }
  }
})

test('una fuente binaria incrustada no confunde bytes /AA con acciones PDF, sin omitir ObjStm', () => {
  const font = Buffer.alloc(128)
  font.writeUInt32BE(0x00010000); font.writeUInt16BE(3, 4)
  for (const [index, tag, offset, length] of [[0, 'head', 60, 54], [1, 'maxp', 116, 6], [2, 'glyf', 124, 4]]) {
    const cursor = 12 + index * 16
    font.write(tag, cursor, 'ascii'); font.writeUInt32BE(offset, cursor + 8); font.writeUInt32BE(length, cursor + 12)
  }
  font.writeUInt32BE(0x5f0f3cf5, 72); font.write('/AA ', 124, 'ascii')
  const valid = pdf('', deflateSync(font))
  assert.equal(files.validatePublicFile(meta(valid, 'fuente.pdf', 'application/pdf'), valid).mimeType, 'application/pdf')
  for (const type of ['/Type /ObjStm', '/Type /Obj#53tm']) {
    const hidden = pdf('', deflateSync(font), type)
    assert.throws(() => files.validatePublicFile(meta(hidden, 'oculto.pdf', 'application/pdf'), hidden), status(415))
  }
  const fake = Buffer.from(font); fake.writeUInt32BE(0xffffffff, 20)
  const malformed = pdf('', deflateSync(fake))
  assert.throws(() => files.validatePublicFile(meta(malformed, 'falsa.pdf', 'application/pdf'), malformed), status(415))
})

test('admite archivos PDF, JPEG y PNG con estructura real y rechaza otros formatos renombrados', () => {
  for (const [bytes, name, type] of [[pdf(), 'ejemplo.pdf', 'application/pdf'], [jpeg(), 'ejemplo.jpeg', 'image/jpeg'], [png(), 'ejemplo.png', 'image/png']]) {
    assert.equal(files.validatePublicFile(meta(bytes, name, type), bytes).mimeType, type)
    for (const fake of [Buffer.from('MZarchivo ejecutable'), Buffer.from('PK\u0003\u0004documento con macros'), Buffer.from('<svg/>')]) {
      assert.throws(() => files.validatePublicFile(meta(fake, name, type), fake), status(415))
    }
  }
  assert.throws(() => files.validatePublicFile(meta(png(), 'fake.pdf', 'application/pdf'), png()), status(415))
  assert.throws(() => files.validatePublicFile(meta(pdf(), 'fake.png', 'image/png'), pdf()), status(415))
  assert.throws(() => files.validatePublicFile(meta(pdf(), 'fake.docm', 'application/pdf'), pdf()), status(415))
  for (const type of ['constructor', '__proto__', 'application/zip']) assert.throws(() => files.validatePublicFile(meta(pdf(), 'fake.pdf', type), pdf()), status(415))
})

test('PNG rechaza CRC inválido, datos truncados, PNG animado y bytes ajenos después de IEND', () => {
  const valid = png()
  const badCrc = Buffer.from(valid); badCrc[20] ^= 1
  const animated = Buffer.concat([valid.subarray(0, 33), chunk('acTL', Buffer.alloc(8)), valid.subarray(33)])
  for (const bytes of [badCrc, valid.subarray(0, valid.length - 1), Buffer.concat([valid, Buffer.from('MZ')]), animated]) {
    assert.throws(() => files.validatePublicFile(meta(bytes, 'image.png', 'image/png'), bytes), status(415))
  }
})

test('JPEG rechaza firma aislada, ausencia de tablas, truncamiento y bytes después de EOI', () => {
  const valid = jpeg()
  for (const bytes of [Buffer.from([255, 216, 255, 217]), valid.subarray(0, valid.length - 1), Buffer.concat([valid, Buffer.from('MZ')]),
    Buffer.concat([Buffer.from([255, 216]), segment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 17, 0])), segment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([63, 255, 217])])]) {
    assert.throws(() => files.validatePublicFile(meta(bytes, 'image.jpg', 'image/jpeg'), bytes), status(415))
  }
})

test('JPEG limita el raster del visor a 64 MiB incluso cuando el archivo comprimido es diminuto', () => {
  const boundary = jpeg(4096, 4096)
  assert.equal(files.validatePublicFile(meta(boundary, 'borde.jpg', 'image/jpeg'), boundary).mimeType, 'image/jpeg')
  for (const bytes of [jpeg(4097, 4096), jpeg(65500, 65500)]) {
    assert.equal(bytes.length, 137)
    assert.throws(() => files.validatePublicFile(meta(bytes, 'grande.jpg', 'image/jpeg'), bytes), status(415))
  }
})

test('PNG grayscale compacto limita la expansión RGBA del visor además de sus bytes descomprimidos', () => {
  const raster = (width, height) => {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 1; header[9] = 0
    const rows = Buffer.alloc((Math.ceil(width / 8) + 1) * height)
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
  }
  const boundary = raster(4096, 4096)
  assert.equal(files.validatePublicFile(meta(boundary, 'borde.png', 'image/png'), boundary).mimeType, 'image/png')
  const overflow = raster(4097, 4096)
  assert.ok(overflow.length < 4096)
  assert.throws(() => files.validatePublicFile(meta(overflow, 'grande.png', 'image/png'), overflow), status(415))
})

test('PDF rechaza cabecera fingida, anexos, scripts y acciones incluso nombres escapados o streams comprimidos', () => {
  for (const bytes of [Buffer.from('%PDF-1.7\ntexto\n%%EOF'), Buffer.concat([pdf(), Buffer.from('MZ')]),
    pdf('/OpenAction 4 0 R'), pdf('/J#61vaScript (dato)'), pdf('/EmbeddedFile 4 0 R'), pdf('', deflateSync(Buffer.from('/JavaScript (dato sintético)')))]) {
    assert.throws(() => files.validatePublicFile(meta(bytes, 'document.pdf', 'application/pdf'), bytes), status(415))
  }
  const valid = pdf('', deflateSync(Buffer.from('BT (texto sintético) Tj ET')))
  assert.equal(files.validatePublicFile(meta(valid, 'document.pdf', 'application/pdf'), valid).filename, 'document.pdf')
})

test('archivo exige tamaño real positivo, máximo 4 MiB y metadatos sin rutas o caracteres inseguros', () => {
  const bytes = pdf()
  assert.equal(files.validatePublicFile(meta(bytes, '../../evidencia.pdf', 'application/pdf'), bytes).filename, 'evidencia.pdf')
  assert.equal(files.sanitizePublicFilename('C:\\fakepath\\evidencia.pdf'), 'evidencia.pdf')
  assert.equal(files.sanitizePublicFilename('../<dato>.pdf'), '_dato_.pdf')
  assert.equal(files.sanitizePublicFilename('x'.repeat(200) + '.pdf'), 'evidencia.pdf')
  assert.throws(() => files.validatePublicFile({ ...meta(bytes, 'dato.pdf', 'application/pdf'), size: 0 }, bytes), status(400))
  assert.throws(() => files.validatePublicFile({ ...meta(bytes, 'dato.pdf', 'application/pdf'), size: bytes.length + 1 }, bytes), status(400))
  assert.throws(() => files.validatePublicFile(meta(bytes, 'dato\u0000.pdf', 'application/pdf'), bytes), status(415))
  const huge = Buffer.alloc(limits.MAX_FILE_BYTES + 1)
  assert.throws(() => files.validatePublicFile(meta(huge, 'dato.pdf', 'application/pdf'), huge), status(413))
})

test('multipart exige una sola instancia de file/uploadToken/uploadId y rechaza IDs de actor libres', async () => {
  function form() {
    const data = new FormData()
    data.set('file', new File([pdf()], 'dato.pdf', { type: 'application/pdf' }))
    data.set('uploadToken', 'capacidad')
    data.set('uploadId', SUBMISSION)
    return data
  }
  const accepted = files.validatePublicUploadForm(form())
  assert.equal(accepted.uploadId, SUBMISSION)
  for (const key of ['file', 'uploadToken', 'uploadId']) {
    const data = form(); data.append(key, 'duplicado')
    assert.throws(() => files.validatePublicUploadForm(data), status(400))
  }
  const unsafe = form(); unsafe.set('queja_id', OTHER)
  assert.throws(() => files.validatePublicUploadForm(unsafe), status(400))
  const invalid = form(); invalid.set('uploadId', 'libre')
  assert.throws(() => files.validatePublicUploadForm(invalid), status(400))
  const missing = form(); missing.delete('file')
  assert.throws(() => files.validatePublicUploadForm(missing), status(400))
  const parsed = await bodies.readPublicUpload(new Request('https://example.test/upload', { method: 'POST', body: form() }))
  assert.equal(files.validatePublicUploadForm(parsed).file.name, 'dato.pdf')
  const largeStream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(limits.MAX_UPLOAD_BODY_BYTES + 1)); controller.close() } })
  await assert.rejects(bodies.readPublicUpload(request(largeStream, { 'Content-Type': 'multipart/form-data; boundary=test' })), status(413))
})

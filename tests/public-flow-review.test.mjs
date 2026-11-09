import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { loadModule } from './load-module.mjs'

const { validatePublicFile } = loadModule('lib/server/publicForms/files.ts')
const validate = bytes => validatePublicFile({ name: 'sintetico.pdf', type: 'application/pdf', size: bytes.length }, bytes)
const unsupported = error => error?.status === 415

function regularPdf(streams = []) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
    ...streams.map(({ content, filter = '' }) => '<< /Length ' + content.length + filter + ' >>\nstream\n' + content.toString('latin1') + '\nendstream'),
  ]
  let source = '%PDF-1.7\n'
  const offsets = []
  for (let index = 0; index < objects.length; index++) {
    offsets.push(source.length)
    source += (index + 1) + ' 0 obj\n' + objects[index] + '\nendobj\n'
  }
  const xref = source.length
  source += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'
  source += offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  source += 'trailer\n<< /Root 1 0 R /Size ' + (objects.length + 1) + ' >>\nstartxref\n' + xref + '\n%%EOF\n'
  return Buffer.from(source, 'latin1')
}

function objectStreamPdf() {
  // La raíz real vive en un ObjStm; XRef enlaza cada objeto comprimido por su índice.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (sintetico) >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
  ]
  const header = '1 0 2 ' + (objects[0].length + 1) + ' 3 ' + (objects[0].length + objects[1].length + 2) + ' '
  const compressed = deflateSync(Buffer.from(header + objects.join('\n'), 'latin1'))
  let source = '%PDF-1.7\n'
  const objectOffset = source.length
  source += '4 0 obj\n<< /Type /Obj#53tm /N 3 /First ' + header.length + ' /Filter /Flate#44ecode /Length ' + compressed.length + ' >>\nstream\n'
  source += compressed.toString('latin1') + '\nendstream\nendobj\n'
  const xrefOffset = source.length
  const xref = Buffer.alloc(6 * 7)
  xref.writeUInt16BE(65535, 5)
  for (let object = 1; object <= 3; object++) {
    const offset = object * 7
    xref[offset] = 2
    xref.writeUInt32BE(4, offset + 1)
    xref.writeUInt16BE(object - 1, offset + 5)
  }
  for (const [object, position] of [[4, objectOffset], [5, xrefOffset]]) {
    const offset = object * 7
    xref[offset] = 1
    xref.writeUInt32BE(position, offset + 1)
  }
  source += '5 0 obj\n<< /Type /XRef /Root 1 0 R /Size 6 /W [1 4 2] /Length ' + xref.length + ' >>\nstream\n'
  source += xref.toString('latin1') + '\nendstream\nendobj\nstartxref\n' + xrefOffset + '\n%%EOF\n'
  return Buffer.from(source, 'latin1')
}

function indirectObjectStreamPdf() {
  // pypdf strict=True resuelve este ObjStm y su OpenAction: Type también puede ser una referencia.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (sintetico) >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
  ]
  const header = '1 0 2 ' + (objects[0].length + 1) + ' 3 ' + (objects[0].length + objects[1].length + 2) + ' '
  const encoded = Buffer.from(Buffer.from(header + objects.join('\n'), 'latin1').toString('hex') + '>', 'ascii')
  let source = '%PDF-1.7\n'
  const objectOffset = source.length
  source += '4 0 obj\n<< /Type 6 0 R /N 3 /First ' + header.length + ' /Filter /ASCIIHexDecode /Length ' + encoded.length + ' >>\nstream\n'
  source += encoded.toString('latin1') + '\nendstream\nendobj\n'
  const typeOffset = source.length
  source += '6 0 obj\n/ObjStm\nendobj\n'
  const xrefOffset = source.length
  const xref = Buffer.alloc(7 * 7)
  xref.writeUInt16BE(65535, 5)
  for (let object = 1; object <= 3; object++) {
    const offset = object * 7
    xref[offset] = 2; xref.writeUInt32BE(4, offset + 1); xref.writeUInt16BE(object - 1, offset + 5)
  }
  for (const [object, position] of [[4, objectOffset], [5, xrefOffset], [6, typeOffset]]) {
    const offset = object * 7
    xref[offset] = 1; xref.writeUInt32BE(position, offset + 1)
  }
  source += '5 0 obj\n<< /Type /XRef /Root 1 0 R /Size 7 /W [1 4 2] /Length ' + xref.length + ' >>\nstream\n'
  source += xref.toString('latin1') + '\nendstream\nendobj\nstartxref\n' + xrefOffset + '\n%%EOF\n'
  return Buffer.from(source, 'latin1')
}

test('PDF rechaza ObjStm con Type indirecto que ocultaría acciones en un filtro opaco', () => {
  const bytes = indirectObjectStreamPdf()
  assert.equal(bytes.length, 687)
  assert.throws(() => validate(bytes), unsupported)
})

test('PDF rechaza acciones comprimidas cuando los nombres de filtro y ObjStm usan escapes', () => {
  assert.throws(() => validate(objectStreamPdf()), unsupported)
})

test('PDF trata falsos delimitadores dentro de un stream como contenido sin reinterpretarlos', () => {
  const literal = Buffer.from(('>>\nstream\nx\nendstream\n').repeat(6000)
    + '99 0 obj\n<< /Filter /FlateDecode /Length 3 >>\nstream\nbad\nendstream\n', 'latin1')
  assert.equal(validate(regularPdf([{ content: literal }])).mimeType, 'application/pdf')
})

test('PDF rechaza claves duplicadas que permiten interpretaciones distintas de filtros, tipo o longitud', () => {
  const encoded = deflateSync(Buffer.from('/JavaScript (sintetico)', 'latin1'))
  for (const filter of [
    ' /Filter /FlateDecode /Filter /DCTDecode /Type /XObject /Subtype /Image',
    ' /Filter /FlateDecode /Type /ObjStm /Type /XObject /Subtype /Image',
    ' /Filter /FlateDecode /Type /XObject /Subtype /Image /Subtype /Form',
    ' /Length 0 /Filter /FlateDecode',
  ]) assert.throws(() => validate(regularPdf([{ content: encoded, filter }])), unsupported)
})

test('PDF limita a 64 MiB la expansión conjunta de varios streams comprimidos', () => {
  const content = deflateSync(Buffer.alloc(32 * 1024 * 1024 + 1))
  assert.throws(() => validate(regularPdf([
    { content, filter: ' /Filter /FlateDecode' },
    { content, filter: ' /Filter /FlateDecode' },
  ])), unsupported)
})

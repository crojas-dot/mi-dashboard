import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadModule } from './load-module.mjs'
import { MarkdownManager } from '@tiptap/markdown'
import { createRequire } from 'node:module'
const { unzipSync, strFromU8 } = createRequire(import.meta.resolve('docx'))('fflate')

const { crearPlantillaInforme, informeFilename } = loadModule('lib/utils/quejaInforme.ts')
const { richTextExtensions } = loadModule('lib/utils/richTextExtensions.ts')
const caseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sample = { id: caseId, folio: '2026-001', revision: 7, cliente_nombre: 'Persona **literal** <script>', categoria: 'Queja', descripcion: 'Texto **sin negrita**',
  estado: 'Pendiente de Revisión GC', fecha: '2026-11-03', notas: '[Procede] Procede\nHallazgo propio', justificacion_procede: 'Procede', resolucion: '**Propuesta en negrita**', resolucion_formato: 'markdown' }
const template = () => crearPlantillaInforme(sample, [{ nombre: 'Factura [1].pdf' }, { nombre: 'Hallazgos.docx' }], 'Calidad de prueba', new Date('2026-11-03T18:00:00Z'))

test('informe y archivo conservan el folio de registro aunque el documento se emita en otro año', () => {
  for (const folio of ['2026-2088', '2027-001', '2027-1000', 'QUEJA-2025-0016']) {
    const contenido = crearPlantillaInforme({ ...sample, folio }, [], 'Calidad', new Date('2028-01-01T18:00:00Z'))
    const documento = JSON.stringify(new MarkdownManager({ extensions: richTextExtensions() }).parse(contenido))
    assert.ok(documento.includes('Folio:'))
    assert.ok(documento.includes(`Folio ${folio}`))
    assert.ok(documento.split(folio).length >= 3)
    assert.equal(informeFilename(folio), `Expediente-${folio}.docx`)
  }
})

test('plantilla conserva datos literales, fecha civil y separa las etapas sin duplicar notas legacy', () => {
  const json = new MarkdownManager({ extensions: richTextExtensions() }).parse(template())
  const serialized = JSON.stringify(json)
  assert.ok(serialized.includes('Persona **literal** <script>'))
  assert.ok(serialized.includes('Texto **sin negrita**'))
  assert.ok(serialized.includes('3 de noviembre de 2026'))
  assert.ok(!serialized.includes('[Procede]'))
  assert.ok(serialized.includes('Hallazgo propio'))
  assert.ok(serialized.includes('Propuesta en negrita'))
  assert.ok(serialized.includes('3. Conclusión y Resolución Final'))
  assert.ok(serialized.includes('Anexo 1: Factura [1].pdf'))
  assert.ok(!serialized.includes('http'))
  assert.equal(informeFilename('../2026/001'), 'Expediente-___2026_001.docx')
})

test('Word real contiene párrafos editables, negrita, cursiva, listas y A4', async () => {
  const { crearInformeWord } = loadModule('lib/utils/quejaInformeWord.ts')
  const blob = await crearInformeWord(template() + '\n\nDictamen **confirmado** y *cursiva*.\n\n- Medida uno\n- Medida dos')
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const xml = strFromU8(zip['word/document.xml'])
  assert.ok(xml.includes('Dictamen '))
  assert.ok(xml.includes('confirmado'))
  assert.match(xml, /<w:b\s*\/>/)
  assert.match(xml, /<w:i\s*\/>/)
  assert.ok(xml.includes('w:numPr'))
  assert.doesNotMatch(xml, /<w:shd/)
  assert.match(xml, /w:color w:val="2A61B0"/)
  assert.match(xml, /w:ascii="Century Gothic"/)
  assert.match(xml, /<w:tabs>/)
  assert.match(xml, /<w:tab\/>/)
  assert.ok(xml.includes('w:w="11906"'))
  assert.ok(xml.includes('w:h="16838"'))
  assert.ok(!xml.includes('altChunk'))
  assert.ok(!Object.keys(zip).some(name => /media\//.test(name)))
})

test('Word conserva el espacio editable entre Conclusión vacía y Anexos sin unir fondos', async () => {
  const { crearInformeWord } = loadModule('lib/utils/quejaInformeWord.ts')
  for(const anexos of [[],[{nombre:'Evidencia.pdf'}]]) {
    const markdown=crearPlantillaInforme(sample,anexos,'Gestión de Calidad')
    const zip=unzipSync(new Uint8Array(await (await crearInformeWord(markdown)).arrayBuffer()))
    const xml=strFromU8(zip['word/document.xml'])
    const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match=>match[0])
    const conclusion=paragraphs.findIndex(p=>p.includes('3. Conclusión y Resolución Final'))
    const annex=paragraphs.findIndex(p=>p.includes('>Anexos<'))
    assert.equal(annex,conclusion+2)
    assert.doesNotMatch(paragraphs[conclusion+1],/<w:t[ >]/)
    assert.doesNotMatch(xml,/<w:shd/)
    assert.match(xml,/w:pStyle w:val="Title"/)
    const styles=strFromU8(zip['word/styles.xml'])
    assert.match(styles,/w:ascii="Arial"/)
    assert.match(styles,/w:ascii="Century Gothic"/)
  }
})

test('la hoja usa el layout de documento con barra fija y scroll del editor', () => {
  const { default: Hoja } = loadModule('app/quejas/components/QuejaInformeHoja.tsx', {
    '@/components/ui/RichTextEditor': { default: 'RichTextEditor' },
    '@/lib/utils/quejaInforme': { INFORME_MAX_LENGTH: 100000 },
  })
  const initialized = () => {}
  const editor = Hoja({ id: 'informe-a', contenido: 'Texto', onChange() {}, onInitialized: initialized, disabled: false })
  assert.equal(editor.type, 'RichTextEditor')
  assert.equal(editor.props.layout, 'fill')
  assert.equal(editor.props.variant, 'document')
  assert.equal(editor.props.pagination, true)
  assert.equal(editor.props.className, 'queja-informe-editor')
  assert.equal(editor.props.maxLength, 100000)
  assert.equal(editor.props.onInitialized, initialized)
})

test('el editor de informe mantiene una sola zona de scroll y reduce el espacio no editable', () => {
  const styles = readFileSync('app/styles/components.css', 'utf8')
  assert.match(styles, /\.queja-informe-editor \[data-rich-text-toolbar\]\s*\{[^}]*height:\s*44px/s)
  assert.match(styles, /\.queja-informe-editor \[data-rich-text-toolbar\] select\s*\{[^}]*padding:\s*4px 36px 4px 10px;/s)
  assert.match(styles, /\.queja-informe-editor \[data-rich-text-viewport\]\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*auto;/s)
  assert.match(styles, /\.queja-informe-editor \.tiptap\s*\{[^}]*width:\s*min\(210mm,\s*100%\);[^}]*min-height:\s*297mm;[^}]*font-family:\s*Arial,\s*Helvetica,\s*sans-serif;[^}]*font-size:\s*11pt;/s)
  assert.match(styles, /\.queja-informe-editor \[data-rich-text-viewport\] \.tiptap\s*\{[^}]*padding-bottom:\s*0;[^}]*padding-top:\s*0;/s)
  assert.match(styles, /\.queja-informe-editor \.tiptap > h2:first-of-type/)
  assert.match(styles, /\.queja-informe-editor \.tiptap > h2:not\(:first-of-type\)/)
  assert.match(styles, /\.queja-informe-editor \.tiptap:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--color-qms-border\);/s)
  assert.match(styles, /\.queja-informe-editor > p:not\(\[role="status"\]\)\s*\{[^}]*position:\s*absolute;/s)
})

test('PDF presenta jerarquía, metadatos alineados y contenido sin sintaxis Markdown visible', async () => {
  const calls = []
  class PdfFixture {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } }
    setFont(...args) { calls.push(['font', ...args]) }
    setFontSize(...args) { calls.push(['size', ...args]) }
    setTextColor(...args) { calls.push(['color', ...args]) }
    setFillColor(...args) { calls.push(['fill', ...args]) }
    setDrawColor(...args) { calls.push(['draw-color', ...args]) }
    getTextWidth(text) { return text.length * 6 }
    getNumberOfPages() { return 1 }
    setPage() {}
    splitTextToSize(text) { return [text] }
    text(...args) { calls.push(['text', ...args]) }
    roundedRect(...args) { calls.push(['rect', ...args]) }
    line(...args) { calls.push(['line', ...args]) }
    addPage() { calls.push(['page']) }
    output() { return 'pdf-blob' }
  }
  const { crearInformePdf } = loadModule('lib/utils/quejaInformePdf.ts', { jspdf: { jsPDF: PdfFixture } })
  const output = await crearInformePdf('## ENTE COSTARRICENSE DE ACREDITACIÓN\n\n## 1. Antecedentes del expediente\n\n**Folio:** 2026-001\n\nDescripción del caso')
  const textCalls = calls.filter(call => call[0] === 'text')
  const label = textCalls.find(call => call[1] === 'Folio:')
  const value = textCalls.find(call => call[1] === '2026-001')
  assert.equal(output, 'pdf-blob')
  assert.ok(!calls.some(call => call[0] === 'rect'))
  assert.ok(calls.some(call => call[0] === 'color' && call.slice(1).join(',') === '42,97,176'))
  assert.ok(label && value && value[2] > label[2])
  assert.ok(textCalls.map(call => String(call[1])).join('').includes('Descripción del caso'))
  assert.ok(textCalls.every(call => !/[#*]{1,2}/.test(call[1])))
})

function apiFixture({ rol = 'calidad', entity = { id: caseId, revision: 7 }, initial = [], insertCode, latestCode, permiso = { leer: true, escribir: true }, permisoCode } = {}) {
  const rows = initial.map(row => ({ ...row }))
  const effects = []
  const client = { from(table) {
    effects.push(table)
    let insert, id
    const query = {
      select() { return query }, eq(key, value) { if (key === 'id' || key === 'queja_id') id = value; return query }, order() { return query }, limit() { return query },
      insert(row) { insert = row; return query },
      async maybeSingle() { return table === 'permisos' ? { data: permiso, error: permisoCode ? { code: permisoCode } : null } : table === 'quejas' ? { data: entity?.id === id ? entity : null, error: null } : { data: rows.filter(row => row.queja_id === id).sort((a,b) => b.version-a.version)[0] ?? null, error: latestCode ? { code: latestCode } : null } },
      async single() {
        if (insertCode) return { data: null, error: { code: insertCode } }
        if (rows.some(row => row.queja_id === insert.queja_id && row.version === insert.version)) return { data: null, error: { code: '23505' } }
        const row = { ...insert, created_at: '2026-11-03T18:00:00Z' }; rows.push(row); return { data: row, error: null }
      },
    }; return query
  } }
  const api = loadModule('app/api/quejas/informe/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } },
    '@/lib/server/auth': { getCurrentUser: async () => rol ? { id: 'actor-profile', rol } : null },
    '@/lib/server/supabase-admin': { createServiceClient: () => client },
  })
  const input = { quejaId: caseId, version: 0, fuenteRevision: 7, contenido: template() }
  const request = (value = input, queryId = caseId) => {
    const req = new Request('http://local/api/quejas/informe?quejaId=' + queryId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
    req.nextUrl = new URL(req.url); return req
  }
  return { ...api, request, input, rows, effects }
}

for (const rol of [null, 'colaborador', 'auditor']) test(`GET/PUT rechazan ${rol ?? 'sin token'} antes de acceso privilegiado`, async () => {
  const api = apiFixture({ rol })
  for (const method of ['GET','PUT']) assert.equal((await api[method](api.request())).status, rol ? 403 : 401)
  assert.equal(api.effects.length, 0)
})

test('Calidad sin lectura no accede al expediente ni al informe; permiso ausente o fallido no autoriza', async () => {
  for (const permiso of [null, { leer: false, escribir: true }]) {
    const api = apiFixture({ permiso })
    for (const method of ['GET', 'PUT']) assert.equal((await api[method](api.request())).status, 403)
    assert.deepEqual([...new Set(api.effects)], ['permisos'])
    assert.equal(api.rows.length, 0)
  }
  const failed = apiFixture({ permisoCode: '42501' })
  assert.equal((await failed.GET(failed.request())).status, 503)
  assert.deepEqual(failed.effects, ['permisos'])
})

test('Calidad con solo lectura puede consultar pero no guardar; admin conserva su autorización', async () => {
  const api = apiFixture({ permiso: { leer: true, escribir: false } })
  assert.equal((await api.GET(api.request())).status, 200)
  api.effects.length = 0
  assert.equal((await api.PUT(api.request())).status, 403)
  assert.deepEqual(api.effects, ['permisos'])
  const admin = apiFixture({ rol: 'admin', permiso: null })
  assert.equal((await admin.PUT(admin.request())).status, 200)
  assert.ok(!admin.effects.includes('permisos'))
})

test('valida entidad, revisión, longitud y campos sin efectos de escritura', async () => {
  const api = apiFixture()
  for (const fields of [{ version: -1 }, { version: 1.2 }, { fuenteRevision: 8 }, { contenido: '' }, { contenido: 'x'.repeat(100001) }, { creado_por: 'otro' }, { quejaId: 'bad' }]) {
    assert.equal((await api.PUT(api.request({ ...api.input, ...fields }))).status, 400)
  }
  assert.equal((await apiFixture({ entity: null }).PUT(api.request())).status, 404)
  assert.equal((await api.GET(api.request(null, 'bad'))).status, 400)
  assert.equal(api.rows.length, 0)
})

test('guarda versiones y permite retomar el documento sin tocar workflow, adjuntos ni correo', async () => {
  const api = apiFixture({ rol: 'admin' })
  assert.equal((await api.GET(api.request())).body.informe, null)
  const first = await api.PUT(api.request())
  assert.equal(first.status, 200)
  assert.equal(first.body.informe.version, 1)
  assert.equal(first.body.informe.creado_por, 'actor-profile')
  assert.equal((await api.PUT(api.request({ ...api.input, version: 1, contenido: 'Edición final' }))).status, 200)
  const read = await api.GET(api.request())
  assert.equal(read.body.informe.contenido, 'Edición final')
  assert.equal(read.headers['Cache-Control'], 'private, no-store')
  assert.equal(api.rows[0].contenido, api.input.contenido)
  assert.deepEqual([...new Set(api.effects)], ['quejas', 'queja_informes'])
})

test('dos escritores desde la misma versión producen un éxito y un conflicto; no hay reintento', async () => {
  const api = apiFixture()
  const replies = await Promise.all([api.PUT(api.request()), api.PUT(api.request({ ...api.input, contenido: 'Segundo autor' }))])
  assert.deepEqual(replies.map(reply => reply.status).sort(), [200,409])
  assert.equal(api.rows.length, 1)
  assert.equal((await api.PUT(api.request())).status, 409)
})

test('fallo de almacenamiento no se confunde con un informe nuevo ni pierde el texto enviado', async () => {
  const api = apiFixture({ latestCode: '42P01' })
  assert.equal((await api.GET(api.request())).status, 503)
  assert.equal((await api.PUT(api.request())).status, 503)
  assert.equal(api.rows.length, 0)
})

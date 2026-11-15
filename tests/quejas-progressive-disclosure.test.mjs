import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import { loadModule } from './load-module.mjs'

const { CaseWorkspace, CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
const { CaseTriageSummary, CaseTriageExcerpt, CaseTriageAttachments, CaseTriageFooter } =
  loadModule('app/quejas/components/CaseTriageSummary.tsx')
const html = (component, props) => renderToStaticMarkup(createElement(component, props))
const queja = {
  id: 'test-case', folio: '2026-091', estado: 'En Investigación', estado_color: 'blue',
  estado_nombre: 'En investigación', fecha: '2026-11-14T16:00:00Z',
  cliente_nombre: 'Persona sintética', descripcion: 'Una solicitud de prueba',
}

test('el triaje se ve solo contraído y conserva el MISMO documento y editor montados', () => {
  for (const expanded of [false, true, false]) {
    const result = html(CaseWorkspace, {
      expanded, documentKey: 'test-case', presentation: 'reference', cyclePlacement: 'header',
      documentStyle: 'cards', readingLayout: true,
      compact: createElement(CaseCycle, { queja, process: true, currentOnly: true }),
      compactContent: createElement('span', null, 'Solo triaje'),
      cycle: createElement(CaseCycle, { queja, process: true }),
      request: createElement('span', null, 'Contacto íntegro'),
      action: createElement('button', null, 'Guardar en ampliado'),
      children: createElement('textarea', { 'data-editor-preserved': true, defaultValue: 'Borrador local' }),
    })
    assert.equal((result.match(/data-editor-preserved/g) || []).length, 1)
    assert.equal((result.match(/Borrador local/g) || []).length, 1)
    assert.equal((result.match(/Guardar en ampliado/g) || []).length, 1)
    assert.equal((result.match(/data-case-triage=""/g) || []).length, expanded ? 0 : 1)
    assert.equal(/data-case-frame[^>]*style="display:none"/.test(result), !expanded)
    if (!expanded) assert.match(result, /data-case-triage[^>]*Solo triaje/)
    else assert.match(result, /@min-\[1100px\]:grid-cols-\[240px_minmax\(0,1fr\)_270px\]/)
  }
})

test('lectura rápida no renderiza editor y mantiene un extracto de máximo tres líneas', () => {
  const result = html(CaseTriageExcerpt, {
    title: 'Propuesta para revisión', text: 'Texto largo que no necesita un editor para consultarse.',
  })
  assert.match(result, /line-clamp-3/)
  assert.match(result, /Texto largo/)
  assert.doesNotMatch(result, /contenteditable|<textarea|<input/)
})

test('evidencias muestran máximo dos chips y el contador real sin perder el resto', () => {
  const files = Array.from({ length: 5 }, (_, index) => ({
    id: 'a' + index, nombre: 'Archivo-' + (index + 1) + '.pdf',
  }))
  const result = html(CaseTriageAttachments, { files, onPreview() {} })
  assert.equal((result.match(/title="Previsualizar/g) || []).length, 2)
  assert.match(result, /Archivo-1.pdf/)
  assert.match(result, /Archivo-2.pdf/)
  assert.doesNotMatch(result, /Archivo-3.pdf|Archivo-4.pdf|Archivo-5.pdf/)
  assert.match(result, /\+3 más en ampliado/)
})

test('estado/plazo y pie de historial se limitan a un bloque compacto, sin mutaciones', () => {
  const result = html(CaseTriageSummary, {
    queja, runs: [], responsable: 'Responsable de prueba',
    children: createElement(CaseTriageExcerpt, { title: 'Resumen', text: 'Solo lectura' }),
    footer: createElement(CaseTriageFooter, { count: 3, onOpen() {} }),
  })
  assert.match(result, /data-case-triage-summary/)
  assert.match(result, /data-case-triage-footer/)
  assert.match(result, /En investigación/)
  assert.match(result, /Responsable de prueba/)
  assert.match(result, /Historial y observaciones \(3\)/)
  assert.doesNotMatch(result, /contenteditable|<textarea/)
})

test('las etapas de Calidad usan resúmenes y conservan tres tarjetas salvo No Procede', () => {
  const source = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  for (const token of ["'Recibido'", "'En Investigación'", "'Pendiente de Revisión GC'", "'Resuelto'", "'Finalizado'", "'No Procede'"])
    assert.ok(source.includes(token), token)
  assert.match(source, /compactContent=\{compactTriage\}/)
  assert.match(source, /CaseTriageAttachments files=\{adjuntosCliente\}/)
  assert.match(source, /CaseTriageAttachments files=\{adjuntos\.filter\(item => !!item\.usuario_id\)\}/)
  assert.match(source, /CaseTriageExcerpt title="Propuesta para revisión"/)
  assert.match(source, /CaseTriageExcerpt title="Resumen de investigación"/)
  assert.match(source, /QuejaCierreResumen key=\{queja\.id \+ ':compact'\}/)
  assert.match(source, /CaseTriageFooter count=/)
  assert.match(source, /onEscape=\{\(\) => \{/)
})

test('Mis Quejas reserva Tiptap para el ampliado visible y protege sus cambios locales', () => {
  const source = fs.readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  assert.match(source, /compactContent=\{compactTriage\}/)
  assert.match(source, /data-case-triage-resolution/)
  assert.match(source, /Borrador guardado/)
  assert.match(source, /Cambios sin guardar/)
  assert.match(source, /Redactar resolución/)
  assert.match(source, /Corregir en editor/)
  assert.match(source, /line-clamp-2/)
  assert.match(source, /CaseTriageAttachments files=\{adjuntosAnalisis\}/)
  assert.match(source, /const prepararResolucion = \(\) => \{[\s\S]*setIsExpanded\(true\)[\s\S]*setEditandoResolucion\(true\)/)
  assert.equal((source.match(/<RichTextEditor id=\{`colaborador-resolucion-/g) || []).length, 1)
  assert.match(source, /if \(resolutionDirty \|\| !!nota\.trim\(\)\)/)
})

test('Escape tiene callback propio y conserva el botón X de cierre', () => {
  const modal = fs.readFileSync('components/Modal.tsx', 'utf8')
  assert.match(modal, /onEscape\?: \(\) => void/)
  assert.match(modal, /\(onEscape \?\? onClose\)\(\)/)
  assert.match(modal, /onClick=\{onClose\}/)
  assert.doesNotMatch(modal, /scroll-smooth|backdrop-blur/)
})

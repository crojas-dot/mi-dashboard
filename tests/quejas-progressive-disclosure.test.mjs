import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import { loadModule } from './load-module.mjs'

const { CaseWorkspace, CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
const { getCaseTriageCta, getCaseTriageNextStep } = loadModule('app/quejas/components/quejaExpedienteModel.ts')
const { CaseTriageSummary, CaseTriageNextStep, CaseTriageExcerpt, CaseTriageAttachments, CaseTriageFooter } =
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
    assert.equal((result.match(/data-case-triage(?==| |>)/g) || []).length, 1, 'mismo hermano React, también al ampliar')
    assert.equal(/data-case-triage[^>]*hidden=""/.test(result), expanded, 'triaje oculto al ampliar')
    assert.equal(/data-case-frame[^>]*style="display:none"/.test(result), !expanded)
    if (!expanded) assert.match(result, /Solo triaje/)
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

test('la CTA segura depende de la etapa y no contiene instrucciones de mutación', () => {
  for (const [estado, expected] of [
    ['Recibido', 'Revisar solicitud completa'],
    ['En Investigación', 'Ver avance del caso completo'],
    ['Pendiente de Revisión GC', 'Revisar propuesta completa'],
    ['Finalizado', 'Ver expediente de cierre completo'],
    ['No Procede', 'Ver expediente de cierre completo'],
  ]) {
    assert.equal(getCaseTriageCta(estado), expected)
    assert.equal(getCaseTriageCta(estado, true), expected)
  }
  assert.equal(getCaseTriageCta('Resuelto', true), 'Redactar y publicar respuesta')
  assert.equal(getCaseTriageCta('Resuelto', false), 'Ver expediente completo')
  assert.equal(getCaseTriageCta('Estado no registrado'), 'Ver expediente completo')
})

test('la CTA de revisión aparece arriba, antes del extracto, sin botones críticos', () => {
  const result = html(CaseTriageSummary, {
    queja: { ...queja, estado: 'Pendiente de Revisión GC' }, runs: [], responsable: 'Responsable',
    primaryAction: createElement(CaseTriageNextStep, {
      step: getCaseTriageNextStep('Pendiente de Revisión GC'), onOpen() {},
    }),
    children: createElement(CaseTriageExcerpt, { title: 'Propuesta para revisión', text: 'Texto abreviado' }),
    footer: createElement(CaseTriageFooter, { count: 2, onOpen() {} }),
  })
  assert.match(result, /data-case-triage-review-cta/)
  assert.match(result, /data-case-triage-expand/)
  assert.ok(result.indexOf('Revisar propuesta completa') < result.indexOf('Propuesta para revisión'))
  assert.doesNotMatch(result, /Tomar decisión|Aprobar y continuar|Devolver a investigación|Derivar a SACP|Publicar respuesta|Enviar a Revisión GC/)
})

test('cada etapa de Calidad contiene título, contexto, icono, tono y CTA prominente', () => {
  const cases = [
    ['Recibido', 'Evaluar procedencia', 'Revisa la solicitud y evidencias', 'Revisar solicitud completa', 'clipboard', 'blue'],
    ['En Investigación', 'Seguimiento de caso', 'por María Responsable', 'Ver avance del caso completo', 'search', 'blue'],
    ['Pendiente de Revisión GC', 'Revisión de Calidad', 'Revisa la propuesta y evidencias', 'Revisar propuesta completa', 'review', 'amber'],
    ['Resuelto', 'Preparar respuesta al cliente', 'El caso fue aprobado', 'Redactar y publicar respuesta', 'mail', 'blue'],
    ['Finalizado', 'Expediente cerrado', 'Consulta el resumen de cierre', 'Ver expediente de cierre completo', 'archive', 'green'],
    ['No Procede', 'Expediente cerrado', 'Consulta el resumen de cierre', 'Ver expediente de cierre completo', 'archive', 'green'],
  ]
  for (const [estado, title, description, ctaLabel, icon, tone] of cases) {
    const step = getCaseTriageNextStep(estado, { responsable: 'María Responsable', canPublish: true })
    assert.equal(step.title, title)
    assert.match(step.description, new RegExp(description))
    assert.equal(step.ctaLabel, ctaLabel)
    assert.equal(step.icon, icon)
    assert.equal(step.tone, tone)
    const result = html(CaseTriageNextStep, { step, onOpen() {} })
    assert.match(result, /data-case-triage-next-step/)
    assert.match(result, /data-case-triage-expand/)
    assert.match(result, /bg-qms-primary/)
    assert.match(result, /text-white/)
    assert.match(result, /hover:bg-blue-700/)
    assert.match(result, /line-clamp-2/)
    assert.match(result, /text-\[13px\]/)
    assert.match(result, /<svg/)
    assert.match(result, new RegExp(ctaLabel))
    assert.match(result, new RegExp(title))
  }
  const noWrite = getCaseTriageNextStep('Resuelto', { canPublish: false })
  assert.equal(noWrite.ctaLabel, 'Ver expediente completo')
  assert.match(getCaseTriageNextStep('En Investigación').description, /persona responsable/)
})

test('el CTA de todas las etapas solo invoca la callback de expansión', () => {
  let expanded = 0
  const onOpen = () => { expanded++ }
  const step = getCaseTriageNextStep('Pendiente de Revisión GC')
  const tree = CaseTriageNextStep({ step, onOpen })
  const action = tree.props.children[1]
  assert.equal(action.props.onClick, onOpen)
  assert.equal(expanded, 0, 'renderizar no ejecuta ningún cambio')
  action.props.onClick()
  assert.equal(expanded, 1, 'la única acción invocada es ampliar')
})

test('Mis Quejas también tiene siguiente paso para borrador, devolución y consulta', () => {
  const source = fs.readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  const triage = source.split('  const triageStep: CaseTriageNextStepData = ')[1]?.split('  // La ayuda se despliega')[0]
  assert.ok(triage)
  for (const text of [
    'Redactar resolución', 'Prepara la propuesta de resolución',
    'Borrador guardado', 'Tienes una propuesta guardada el',
    'Corrección requerida', 'Calidad devolvió tu propuesta',
    'Cambios sin guardar', 'Continuar editando',
    'En revisión de Calidad', 'Expediente cerrado', 'Consultar expediente',
  ]) assert.ok(triage.includes(text), text)
  assert.match(source, /primaryAction=\{<CaseTriageNextStep step=\{triageStep\}/)
  assert.match(source, /onOpen=\{investigando \? prepararResolucion : \(\) => setIsExpanded\(true\)\}/)
  const compact = source.split('  const compactTriage = ')[1]?.split('  return <>')[0]
  assert.ok(compact)
  assert.equal((compact.match(/data-case-triage-expand/g) || []).length, 0, 'el CTA es el único botón primario en CaseTriageNextStep')
  assert.doesNotMatch(compact, /onClick=\{handleEnviarRevision\}|guardarResolucionBorrador\(/)
})

test('en Quejas las acciones reales existen solo en la columna del AMPLIADO', () => {
  const source = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  const triage = source.split('  const compactTriage = ')[1]?.split('\n  return <>')[0]
  assert.ok(triage, 'se mantiene un triaje específico')
  assert.match(triage, /primaryAction=\{<CaseTriageNextStep/)
  assert.match(triage, /getCaseTriageNextStep\(estadoActual, \{ responsable: responsableActual\?\.nombre, canPublish: esStaff \}\)/)
  assert.doesNotMatch(triage, /workflowActions|handleAprobarResolucion|setReviewOpen\(true\)|pedirDesactivar|onClick=\{openAction\}|runCaseUpdate/)
  assert.equal((source.match(/\{workflowActions\}/g) || []).length, 1, 'una única instancia de las acciones originales')
  const actionColumn = source.split('action={<CaseAction ')[1]?.split('</CaseAction>')[0]
  assert.ok(actionColumn)
  assert.match(actionColumn, /\{workflowActions\}/)
})

test('Mis Quejas reserva Tiptap para el ampliado visible y protege sus cambios locales', () => {
  const source = fs.readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  assert.match(source, /compactContent=\{compactTriage\}/)
  assert.match(source, /data-case-triage-resolution/)
  assert.match(source, /Borrador guardado/)
  assert.match(source, /Cambios sin guardar/)
  assert.match(source, /Redactar resolución/)
  assert.match(source, /ctaLabel: 'Corregir en editor'/)
  assert.match(source, /ctaLabel: 'Continuar editando'/)
  assert.match(source, /ctaLabel: 'Abrir editor para modificar'/)
  assert.match(source, /ctaLabel: 'Abrir editor para redactar'/)
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

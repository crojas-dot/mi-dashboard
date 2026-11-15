import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: Assignment } = loadModule('app/quejas/components/QuejaInvestigacionAsignacion.tsx', {
  './QuejaExpedientePanels': {
    CaseSection: ({ title, children }) => createElement('section', { 'data-case-title': title }, children),
  },
  '@/components/quejas/ListaAdjuntos': {
    default: ({ adjuntos }) => createElement('ul', { 'data-test-files': true },
      adjuntos.map(file => createElement('li', { key: file.id }, file.nombre))),
  },
  '@/components/ui/RichTextContent': {
    default: ({ value, format }) => createElement('div', { 'data-test-richtext-format': format }, value),
  },
})
const html = props => renderToStaticMarkup(createElement(Assignment, {
  responsable: 'Investigadora Ejemplo', asignacion: null, asignacionLoading: false, asignacionError: false,
  adjuntos: [],
  adjuntosLoading: false, adjuntosError: false, onPreview() {}, onDownload() {}, ...props,
}))

test('etapa 2 presenta justificación antes del investigador y mantiene documentos', () => {
  const oficio = { id: 'o1', nombre: 'Oficio de apertura.pdf', usuario_id: 'calidad', queja_id: 'q1' }
  const evidence = { id: 'e2', nombre: 'Otra evidencia.docx', usuario_id: 'investigador', queja_id: 'q1' }
  const value = html({
    asignacion: { queja_id: 'q1', responsable_id: 'responsable', instrucciones: 'Entrevistar a las partes.',
      oficio_adjunto_id: oficio.id, asignado_por: 'calidad', updated_at: '2026-11-14T14:30:00Z' },
    adjuntos: [oficio, evidence],
  })
  assert.match(value, /Detalles de asignación/)
  assert.match(value, /Justificación de Calidad/)
  assert.match(value, /Investigadora Ejemplo/)
  assert.ok(value.indexOf('Justificación de Calidad') < value.indexOf('Investigador asignado'), 'justificación antes del encargado')
  assert.match(value, /Entrevistar a las partes/)
  assert.match(value, /Oficio de apertura\.pdf/)
  assert.equal(value.split('Oficio de apertura.pdf').length - 1, 1, 'sin archivo duplicado')
  assert.match(value, /Otra evidencia\.docx/)
  assert.doesNotMatch(value, /borrador|Última modificación|Comprobando progreso/i, 'no mostrar estado del borrador')
  assert.doesNotMatch(value, /La investigación está a cargo de la persona asignada/)
})

test('sin justificación ni oficio no inventa información', () => {
  const value = html()
  assert.match(value, /Sin justificación registrada/)
  assert.doesNotMatch(value, /borrador/i)
  assert.doesNotMatch(value, /Oficio de apertura|Ver análisis|Ver borrador en curso|Publicar/)
  const failed = html({ asignacionError: true })
  assert.match(failed, /No se pudieron consultar los archivos vinculados/)
})

test('Procede persiste justificación, responsable e instrucciones con una sola RPC y revisión esperada', async () => {
  const calls = []
  const svc = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { rpc: async (name, args) => {
      calls.push({ name, args }); return { data: { id: args.p_id, revision: args.p_expected + 1 }, error: null }
    } } },
  })
  const id = randomUUID(), responsible = randomUUID(), office = randomUUID()
  const result = await svc.iniciarInvestigacionQueja({ id, revision: 7 }, {
    justificacion: '  Procede por evidencia  ', formato: 'plain', responsableId: responsible,
    oficioAdjuntoId: office,
  })
  assert.equal(result.revision, 8)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'qms_start_investigation_with_assignment')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), {
    p_id: id, p_expected: 7, p_justification: 'Procede por evidencia',
    p_justification_format: 'plain', p_owner: responsible,
    p_instructions: null, p_office_attachment: office,
  })
  await svc.iniciarInvestigacionQueja({ id, revision: 8 }, {
    justificacion: 'Procede', formato: 'markdown', responsableId: responsible,
  })
  assert.equal(calls[1].args.p_instructions, null)
  assert.equal(calls[1].args.p_office_attachment, null)
  assert.equal(calls[1].args.p_expected, 8)
  for (const input of [{ justificacion: ' ' }, { formato: 'html' }, { responsableId: '' }]) {
    assert.throws(() => svc.iniciarInvestigacionQueja({ id, revision: 7 }, {
      justificacion: 'Procede', formato: 'plain', responsableId: responsible, ...input,
    }))
  }
  assert.equal(calls.length, 2, 'ninguna entrada inválida llega al RPC')
})

test('errores del RPC conservan revisión y no fabrican una asignación confirmada', async () => {
  const err = { code: '40001', message: 'Otra persona modificó la queja' }
  const calls = []
  const svc = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { rpc: async (name, args) => {
      calls.push({ name, args }); return { data: null, error: err }
    } } },
  })
  await assert.rejects(svc.iniciarInvestigacionQueja({ id: randomUUID(), revision: 4 },
    { justificacion: 'Procede', formato: 'plain', responsableId: randomUUID() }), x => x === err)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_expected, 4)
})

test('la migración mantiene autorizaciones y transición atómica sin escritura directa pública', () => {
  const sql = fs.readFileSync('supabase/migrations/20261115041345_quejas_investigacion_asignacion.sql', 'utf8')
  assert.match(sql, /create table public\.queja_investigation_assignments/)
  assert.match(sql, /alter table public\.queja_investigation_assignments enable row level security/)
  assert.match(sql, /create policy assignment_context_authorized_read/)
  assert.match(sql, /grant select on public\.queja_investigation_assignments to authenticated/)
  assert.doesNotMatch(sql, /grant (?:insert|update|delete|all) on public\.queja_investigation_assignments to authenticated/i)
  assert.match(sql, /create function public\.qms_start_investigation_with_assignment/)
  assert.match(sql, /q\.revision is distinct from p_expected/)
  assert.match(sql, /q\.estado is distinct from 'Recibido'/)
  assert.match(sql, /usuario_id = editor/)
  assert.match(sql, /public\.qms_transition_complaint\(/)
  assert.match(sql, /insert into public\.queja_investigation_assignments/)
  assert.match(sql, /revoke all on function public\.qms_start_investigation_with_assignment/)
  assert.match(sql, /grant execute on function public\.qms_start_investigation_with_assignment/)
})

test('Calidad espera propuesta, no reabre evaluación: CTA compacto, plazo real y sin Ver análisis en etapa 2', () => {
  const model = loadModule('app/quejas/components/quejaExpedienteModel.ts')
  assert.equal(model.getCaseTriageCta('En Investigación'), 'Ver estado de la investigación')
  const modal = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.match(modal, /actionTitle=\{readOnlyStage \? 'Vista de consulta' : estadoActual === 'En Investigación' \? 'Esperar propuesta del investigador'/)
  assert.match(modal, /investigationDeadline\.business && investigationDeadline\.duration/)
  assert.match(modal, /El responsable tiene \$\{investigationDeadline\.duration\} días hábiles/)
  assert.match(modal, /El caso pasará a «Revisión GC»/)
  assert.match(modal, /\{qualityReview && <Button[^\n]*setAnalisisCalidadOpen\(true\)/)
  assert.doesNotMatch(modal, /\(estadoActual === 'En Investigación' \|\| qualityReview\) && <Button/)
  assert.match(modal, /estadoActual === 'En Investigación' \? <QuejaInvestigacionAsignacion/)
  assert.match(modal, /data-assignment-compose/)
  assert.match(modal, /Adjuntar documento/)
  assert.doesNotMatch(modal, /Adjuntar oficio de apertura/)
  assert.doesNotMatch(modal, /useQuejaResolucionDraft|borradorInvestigador/,'Calidad no consulta ni presenta borradores')
  assert.match(modal, /Escribe la justificación de la decisión e instrucciones para el investigador/)
  assert.match(modal, /iniciarInvestigacionQueja\(workflowQueja/)
  assert.doesNotMatch(modal, /La investigación está a cargo de la persona asignada\./)
})

test('el editor de Procede es el único campo de instrucciones y su ayuda gris está oculta solo aquí', () => {
  const modal = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  const editor = fs.readFileSync('components/ui/RichTextEditorBody.tsx', 'utf8')
  const service = fs.readFileSync('lib/services/quejaWorkflowService.ts', 'utf8')
  const start = modal.indexOf("{decisionProcedencia === 'procede' && <section data-assignment-compose")
  const end = modal.indexOf("{decisionProcedencia === 'no_procede' &&", start)
  assert.ok(start >= 0 && end > start)
  const attachmentArea = modal.slice(start, end)
  assert.doesNotMatch(attachmentArea, /<textarea|Instrucciones para el investigador \(opcional\)|queja-instrucciones-asignacion/)
  assert.match(attachmentArea, /Adjuntar documento/)
  assert.doesNotMatch(attachmentArea, /Adjuntar oficio de apertura/)
  assert.match(attachmentArea, /El archivo se almacena en el expediente al subirlo/)
  assert.match(modal, /showFormattingHint=\{decisionProcedencia !== 'procede'\}/)
  assert.match(modal, /placeholder=\{decisionProcedencia === 'procede' \? 'Escribe la justificación de la decisión e instrucciones para el investigador\.\.\.'/)
  assert.doesNotMatch(modal, /instruccionesAsignacion|setInstruccionesAsignacion/)
  assert.match(editor, /!showFormattingHint && !limitReached/)
  assert.match(editor, /limitReached[\s\S]*El contenido admite hasta/)
  assert.match(service, /p_instructions: null/)
})

test('la investigación muestra la justificación principal en formato rico y conserva instrucciones históricas', () => {
  const fallback = html({ justificacionProcede: '**Verificar archivos**', justificacionFormato: 'markdown' })
  assert.match(fallback, /Justificación de Calidad/)
  assert.match(fallback, /data-test-richtext-format="markdown"/)
  assert.match(fallback, /\*\*Verificar archivos\*\*/)
  const old = html({ justificacionProcede: '**Nueva fuente**', justificacionFormato: 'markdown',
    asignacion: { instrucciones: 'Indicaciones históricas', oficio_adjunto_id: null } })
  assert.match(old, /\*\*Nueva fuente\*\*/)
  assert.match(old, /data-test-richtext-format="markdown"/)
  assert.doesNotMatch(old, /Indicaciones históricas/)
  const legacy = html({ asignacion: { instrucciones: 'Indicaciones históricas', oficio_adjunto_id: null } })
  assert.match(legacy, /Indicaciones históricas/)
  assert.match(legacy, /data-test-richtext-format="plain"/)
})

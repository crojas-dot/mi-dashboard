import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const detail = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx','utf8')
const summary = fs.readFileSync('app/mis-quejas/components/QuejaInvestigacionResumen.tsx','utf8')
const response = fs.readFileSync('app/quejas/components/QuejaRespuestaClienteModal.tsx','utf8')
const report = fs.readFileSync('app/quejas/components/QuejaInformeModal.tsx','utf8')
const migration = fs.readFileSync('supabase/migrations/20261113235000_quejas_adjuntos_devolucion_gc.sql','utf8')

test('Devolución asocia los soportes a la revisión y usa la subida directa',() => {
  assert.match(detail,/subirAdjuntoQueja\(queja.id, file\)/)
  assert.match(detail,/revisarResolucionQueja\(workflowQueja, 'returned', motivoDevolucion, adjuntosDevolucion.map/)
  assert.match(migration,/references public.queja_gc_revisiones\(queja_id, source_revision\)/)
  assert.match(migration,/qms_private.review_resolution\(p_id,p_expected,'returned',p_motivo\)/)
})
test('El responsable solo ve los soportes asociados a cada devolución',() => {
  assert.match(summary,/item.adjuntoIds\?\.includes\(file.id\)/)
  assert.doesNotMatch(summary,/archivos.filter\(file => !!file.usuario_id\)/)
  assert.match(summary,/Ir al editor/)
})
test('No se duplica generar PDF y se exige adjunto oficial en el correo',() => {
  assert.doesNotMatch(report,/Preparar PDF para cliente/)
  assert.match(response,/Es necesario adjuntar un informe antes de publicar/)
})

test('Quejas ampliado conserva el mismo sistema de tarjetas y columnas que Mis Quejas', () => {
  const quejas = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  const misQuejas = fs.readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  assert.match(misQuejas, /presentation="reference" documentStyle="cards" readingLayout/)
  assert.match(quejas, /readingLayout documentStyle=\{expanded \? 'cards' : 'sheet'\}/)
  assert.match(quejas, /const documentVariant = expanded \? 'panel' : 'document'/)
  assert.match(quejas, /action=\{<div className=\{expanded \? 'ui-panel overflow-hidden' : undefined\}>/)
  assert.match(quejas, /data-case-review-context className=\{expanded \? 'ui-panel overflow-hidden' : undefined\}/)
  assert.match(quejas, /data-case-close-context className=\{expanded \? 'ui-panel overflow-hidden' : undefined\}/)
  assert.match(quejas, /data-close-report-shortcut/)
  assert.match(quejas, /Generar expediente/)
})

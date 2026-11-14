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


test('El workspace mantiene navegación idéntica y lateral fijo en ambos módulos', () => {
  const shared = fs.readFileSync('app/quejas/components/QuejaExpedientePanels.tsx', 'utf8')
  const quality = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  const responsible = fs.readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  assert.match(shared, /export function CaseWorkspaceNavigation/)
  assert.match(shared, /@min-\[480px\]\/workspace:flex/)
  assert.match(shared, /aria-pressed=\{expanded\}/)
  assert.match(shared, /@min-\[1100px\]:sticky @min-\[1100px\]:top-4/)
  assert.match(shared, /@min-\[1100px\]:max-h-\[calc\(100dvh-8rem\)\]/)
  assert.match(quality, /headerActions=\{<CaseWorkspaceNavigation/)
  assert.match(responsible, /headerActions=\{<CaseWorkspaceNavigation/)
  assert.match(quality, /data-close-report-shortcut/)
  assert.match(quality, /data-close-report-shortcut className="min-w-0 rounded-card/)
  assert.match(quality, /variant="secondary" className="min-h-11 w-full min-w-0/)
  assert.doesNotMatch(quality, /Generá el PDF oficial con las evidencias del caso/)
})


test('Historial usa los mismos puntos simples y modal centrado en ambos módulos', () => {
  const analysis = fs.readFileSync('app/mis-quejas/components/QuejaAnalisisPanel.tsx', 'utf8')
  const quality = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.match(analysis, /export function QuejaTimeline/)
  assert.match(analysis, /data-queja-timeline/)
  assert.match(analysis, /ring-4 ring-qms-surface/)
  assert.match(analysis, /index === 0 \? 'bg-qms-primary' : 'bg-gray-300'/)
  assert.match(analysis, /<QuejaTimeline actividad=\{props.actividad\}/)
  assert.match(quality, /<QuejaTimeline actividad=\{actividad\}/)
  assert.match(quality, /title="Historial y observaciones" titleSuffix=\{queja.folio\}/)
  assert.match(quality, /variant="document" size="mail" height="fill"/)
  assert.doesNotMatch(quality, /title=\{'Actividad · ' \+ queja.folio\} variant="sheet"/)
})

test('Cierre muestra tres pasos y abre un modal de solo lectura del sistema', () => {
  const detail = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx','utf8')
  const summary = fs.readFileSync('app/quejas/components/QuejaCierreResumen.tsx','utf8')
  assert.match(detail, /\['Resuelto', 'Finalizado'\]\.includes\(estadoActual\) \? <QuejaCierreResumen/)
  for (const name of ['cliente', 'investigacion', 'cierre']) assert.ok(summary.includes("id: '" + name + "'"))
  assert.match(summary, /data-case-close-timeline/)
  assert.match(summary, /data-case-close-step=\{item.id\}/)
  assert.match(summary, /variant="document" size="mail" height="fill"/)
  assert.match(summary, /onPreview=\{onPreview\} onDownload=\{onDownload\}/)
  assert.match(summary, /informePdfFilename\(queja.folio, informe.version\)/)
  assert.doesNotMatch(summary, /backdrop-blur|scroll-smooth/)
})

test('Tarjetas de Cierre usan línea gruesa, nodos icónicos y cabeceras suaves, con visor navegable', () => {
  const summary = fs.readFileSync('app/quejas/components/QuejaCierreResumen.tsx', 'utf8')
  assert.match(summary, /data-case-close-timeline className="@container/)
  assert.match(summary, /border-l-\[4px\] border-qms-primary\/15/)
  assert.match(summary, /top-1\/2 z-10 flex size-8 -translate-y-1\/2/)
  assert.match(summary, /rounded-full border-\[3px\] border-qms-surface/)
  assert.match(summary, /@min-\[580px\]:h-\[124px\]/)
  assert.match(summary, /bg-qms-primary-soft\/70/)
  assert.match(summary, /bg-qms-purple\/10/)
  assert.match(summary, /bg-qms-success\/10/)
  assert.match(summary, /line-clamp-2/)
  assert.match(summary, /text-\[14px\]/)
  assert.match(summary, /data-case-close-step=\{item.id\}/)
  assert.match(summary, /navegarVisor|setSelected\(current => current === null/)
  assert.match(summary, /variant="document" size="mail" height="fill"/)
})


test('el stepper conserva panel contraído limpio y lectura solo en expandido', () => {
  const layout = fs.readFileSync('app/quejas/components/QuejaExpedientePanels.tsx', 'utf8')
  const detail = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.match(layout, /data-case-stage=\{step.id\}/)
  assert.match(layout, /onClick=\{\(\) => onStageChange\(step.id\)\}/)
  assert.match(layout, /data-case-mobile-cycle/)
  assert.match(layout, /ExternalLink/)
  assert.match(detail, /setReadOnlyStage\(null\)/)
  assert.match(detail, /data-case-stage-readonly/)
  assert.match(detail, /Volver a etapa actual/)
  assert.match(detail, /readOnlyStage \? readOnlyDocument/)
  assert.match(detail, /!readOnlyStage && canAct/)
})

test('las vistas por etapa muestran contenido propio y adjuntos sin acordeones de antecedentes', () => {
  assert.doesNotMatch(detail, /Ver antecedentes|Ver descripción original/)
  assert.match(detail, /soloLecturaFiles\(adjuntosCliente\)/)
  assert.match(detail, /soloLecturaFiles\(adjuntos\.filter\(item => !!item\.usuario_id\)\)/)
  assert.match(detail, /expanded \? toggleProcessStage : undefined/)
  assert.match(detail, /process currentOnly/)
})

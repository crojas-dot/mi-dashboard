'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleHelp, Maximize, Minimize, Send, Upload } from 'lucide-react'
import Modal from '@/components/Modal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import DeferredMount from '@/components/ui/DeferredMount'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextContent from '@/components/ui/RichTextContent'
import type { Queja } from '@/lib/types'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import { useQuejaActividad, useCrearQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { useQuejaPlazos } from '@/lib/queries/useQuejaSeguimiento'
import { transicionarQueja } from '@/lib/services/quejaWorkflowService'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaAttachmentActions } from '@/hooks/useQuejaAttachmentActions'
import { useQuejaAssistant } from '@/app/mis-quejas/components/useQuejaAssistant'
import { CaseCycle, CaseRequestHeader, CaseSection, CaseWorkspace } from '@/app/quejas/components/QuejaExpedientePanels'
import { caseDate, caseDeadline } from '@/app/quejas/components/quejaExpedienteModel'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  onNavigationLockChange?: (locked: boolean) => void
  onPrevious?: () => void
  onNext?: () => void
}
type Tab = 'detalle' | 'resolucion'
const tabs = [{ id: 'detalle', label: 'Análisis' }, { id: 'resolucion', label: 'Resolución' }]
const DOCUMENT_LIMIT = 10000
const RETURN_NOTE_PREFIX = 'Devuelta a investigación. Motivo: '

export default function QuejaColaboradorPanel({ queja, onClose, onUpdated, onNavigationLockChange, onPrevious, onNext }: Props) {
  const user = useAuthStore(s => s.user)
  const scope = useEntityRequestGuard(queja?.id ?? null)
  const draftVersions = useRef({ nota: 0, resolucion: 0 })
  const [activeTab, setActiveTab] = useState<Tab>('detalle')
  const [resolucion, setResolucion] = useState('')
  const [resolucionFormato, setResolucionFormato] = useState<'plain' | 'markdown'>('plain')
  const [resolucionRevision, setResolucionRevision] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [notaDevolucionAbierta, setNotaDevolucionAbierta] = useState(false)
  const [assistanceOpen, setAssistanceOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [agregandoNota, setAgregandoNota] = useState(false)
  const {
    previewAdjunto, setPreviewAdjunto, subiendoAdjunto: subiendoAdjuntoAnalisis,
    eliminandoAdjunto, confirmarEliminacion, setConfirmarEliminacion,
    handleSubirAdjunto: handleSubirAdjuntoAnalisis, handleEliminarAdjunto, handleDescargarAdjunto,
  } = useQuejaAttachmentActions(queja?.id ?? null, scope)
  const {
    aiAutoLoading, aiResult, chat, chatInput, setChatInput,
    chatLoading, handleAnalisisAuto, handleEnviarIA,
  } = useQuejaAssistant(queja?.id ?? null, scope)
  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: refetchActividad } = useQuejaActividad(activeTab === 'detalle' || queja?.estado === 'En Investigación' ? quejaId : '')
  const crearActividad = useCrearQuejaActividad()
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: refetchAdjuntos } = useQuejaAdjuntos(quejaId)
  const { data: runs = [], error: plazosError } = useQuejaPlazos(quejaId)
  const navigationLocked = loading || subiendoAdjuntoAnalisis || agregandoNota || aiAutoLoading || chatLoading || !!resolucion.trim() || !!nota.trim() || !!aiResult.trim()
  useEffect(() => {
    onNavigationLockChange?.(!!queja && navigationLocked)
    return () => onNavigationLockChange?.(false)
  }, [queja, navigationLocked, onNavigationLockChange])
  const handleClose = useCallback(() => {
    scope.invalidate()
    setIsExpanded(false)
    setActiveTab('detalle')
    setNotaDevolucionAbierta(false)
    setAssistanceOpen(false)
    onNavigationLockChange?.(false)
    onClose()
  }, [scope, onClose, onNavigationLockChange])
  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
    setNota(''); setNotaDevolucionAbierta(false); setAssistanceOpen(false); setIsExpanded(false); setLoading(false); setAgregandoNota(false)
  }
  if (!queja) return null
  const estado = queja.estado ?? ''
  const canEdit = !!user && (user.rol === 'admin' || user.rol === 'calidad' || user.rol === 'colaborador' && queja.responsable_id === user.id)
  const investigando = estado === 'En Investigación' && canEdit
  const analysis = getQuejaAnalysis(queja)
  const deadline = caseDeadline(queja, runs)
  const notaDevolucion = [...actividad].reverse().find(item => item.tipo === 'nota' && item.descripcion.startsWith(RETURN_NOTE_PREFIX))

  const handleEnviarRevision = async () => {
    if (!investigando) { showError(null, 'Esta queja no está disponible para enviar a revisión.'); return }
    if (!resolucion.trim()) { showError(null, 'Escribí la conclusión antes de enviarla a revisión'); return }
    if (resolucion.length > DOCUMENT_LIMIT) { showError(null, 'La conclusión admite hasta 10.000 caracteres.'); return }
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.resolucion
    setLoading(true)
    let confirmed = false
    try {
      // La revisión se captura al editar: refrescar el expediente nunca fuerza el guardado.
      const updated = await transicionarQueja({ ...queja, revision: resolucionRevision ?? queja.revision }, 'Pendiente de Revisión GC', { resolucion, resolucionFormato })
      confirmed = true
      if (isContextCurrent()) onUpdated(updated, operation.isCurrent)
      if (operation.isCurrent()) {
        showSuccess('Resolución enviada a Gestión de Calidad')
        if (draftVersions.current.resolucion === draftVersion) {
          setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
        }
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, confirmed ? 'La resolución se envió, pero no se pudo actualizar la vista' : 'No se pudo enviar la resolución')
    } finally {
      if (operation.isCurrent()) setLoading(false)
      operation.finish()
    }
  }
  const handleAgregarNota = async () => {
    if (!canEdit || !nota.trim()) return
    if (nota.length > DOCUMENT_LIMIT) { showError(null, 'La nota admite hasta 10.000 caracteres.'); return }
    const operation = scope.start('activity-note')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.nota
    setAgregandoNota(true)
    try {
      await crearActividad.mutateAsync({ quejaId: queja.id, descripcion: nota, usuarioId: user?.id ?? null, isContextCurrent })
      if (operation.isCurrent()) {
        showSuccess('Nota agregada a la actividad')
        if (draftVersions.current.nota === draftVersion) setNota('')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo agregar la nota')
    } finally {
      if (operation.isCurrent()) setAgregandoNota(false)
      operation.finish()
    }
  }
  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto) => adjunto.usuario_id === null ? user?.rol === 'admin' : canEdit
  const plazo = <Badge variant={deadline.variant} title={deadline.vence ? `Fecha límite: ${caseDate(deadline.vence)}` : undefined}>{deadline.label}</Badge>
  const action = investigando ? 'Registrá tus hallazgos y enviá la propuesta a Gestión de Calidad.' : estado === 'Pendiente de Revisión GC' ? 'Gestión de Calidad revisará la propuesta. Si requiere ajustes, volverá a investigación.' : 'El expediente conserva el trabajo y las evidencias registradas.'

  // El desplegable no participa en el flex de las pestañas: al abrirlo a todo
  // el ancho las comprimía a cero y deformaba los controles de asistencia.
  const assistance = <div id={`queja-${queja.id}-asistencia`} data-resolution-assistance role="region" aria-label="Asistencia para la resolución" hidden={!assistanceOpen || !investigando} className="min-w-0 border-b border-qms-border px-4 py-3"><div className="max-h-[45dvh] overflow-y-auto">
                <p className="text-xs text-qms-muted">La sugerencia no se guarda ni se envía. Revisala antes de usarla en la resolución.</p>
                <Button className="mt-3" size="sm" variant="ghost" onClick={handleAnalisisAuto} loading={aiAutoLoading} disabled={!investigando}>Análisis IA</Button>
                {aiResult && <div className="mt-3 space-y-3"><RichTextContent value={aiResult} format="markdown" /><Button size="sm" variant="secondary" disabled={aiResult.length > DOCUMENT_LIMIT || !!resolucion.trim() || !investigando} onClick={() => { draftVersions.current.resolucion++; setResolucion(aiResult); setResolucionFormato('markdown'); if (resolucionRevision === null) setResolucionRevision(queja.revision) }}>Usar en resolución</Button></div>}
                <details className="min-w-0 py-4"><summary className="cursor-pointer text-sm text-qms-muted">Consultar al asistente</summary><p className="mt-3 text-xs text-qms-muted">Solo consulta al proveedor configurado cuando enviás una pregunta.</p>
                  <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">{chat.map(message => <div key={message.id} className={`rounded-card p-3 text-sm ${message.role === 'user' ? 'bg-qms-primary-soft' : 'bg-qms-hover-bg'}`}><p className="mb-1 text-xs font-medium text-qms-muted">{message.role === 'user' ? 'Tu consulta' : 'Asistente'}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p></div>)}</div>
                  <div className="mt-4 flex flex-wrap items-end gap-2"><textarea aria-label="Pregunta al asistente" rows={2} maxLength={DOCUMENT_LIMIT} placeholder="Hacé una pregunta sobre esta queja..." className="ui-textarea min-w-0 flex-[1_1_12rem] resize-none px-3 py-2 text-sm" value={chatInput} onChange={event => setChatInput(event.target.value)} disabled={chatLoading || !investigando} /><Button size="sm" variant="secondary" onClick={handleEnviarIA} loading={chatLoading} disabled={!chatInput.trim() || !investigando}><Send className="size-4" /> Enviar</Button></div>
                </details>
              </div></div>

  return <>
    <Modal open onClose={handleClose} title={`Folio ${queja.folio}`} variant="workspace" expanded={isExpanded} headerActions={<>
      <Button size="icon" variant="ghost" aria-label="Queja anterior" disabled={!onPrevious || navigationLocked} onClick={onPrevious}><ArrowLeft className="size-5" /></Button>
      <Button size="icon" variant="ghost" aria-label="Queja siguiente" disabled={!onNext || navigationLocked} onClick={onNext}><ArrowRight className="size-5" /></Button>
      <Button size="icon" variant="ghost" aria-label={isExpanded ? 'Reducir expediente' : 'Ampliar expediente'} title={isExpanded ? 'Reducir expediente' : 'Ampliar expediente'} onClick={() => setIsExpanded(value => !value)}>{isExpanded ? <Minimize className="size-5" /> : <Maximize className="size-5" />}</Button>
    </>}>
      <CaseWorkspace documentKey={`${queja.id}:${activeTab}`} expanded={isExpanded} cyclePlacement="top" request={<CaseRequestHeader key={queja.id} queja={queja} variant="panel" showReceivedAt={activeTab === 'resolucion'} />} compact={<>
          <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant={queja.estado_color || 'gray'}>{queja.estado_nombre || estado}</Badge>{plazo}</div>
          <CaseCycle queja={queja} audience="investigator" compact line />
        </>} cycle={<CaseCycle queja={queja} audience="investigator" compact line variant="plain" />} action={<CaseSection title="Acción actual" variant="plain"><Badge variant={queja.estado_color || 'gray'}>{queja.estado_nombre || estado}</Badge><p className="mt-4 text-sm leading-relaxed text-qms-muted">{action}</p><div className="mt-5 border-t border-qms-border pt-4"><p className="mb-2 text-xs text-qms-muted">{deadline.stageTitle}</p>{plazo}{plazosError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el calendario. Se conserva el vencimiento registrado.</p>}</div>{investigando && <><Button className="mt-5 w-full" variant="secondary" onClick={() => setActiveTab(activeTab === 'resolucion' ? 'detalle' : 'resolucion')}>{activeTab === 'resolucion' ? 'Volver al análisis' : 'Preparar resolución'}</Button>{(notaDevolucion || actividadLoading || actividadError || notaDevolucionAbierta) && <Button className="mt-2 w-full" variant="ghost" aria-expanded={notaDevolucionAbierta} aria-controls={`queja-${queja.id}-nota-devolucion`} onClick={() => setNotaDevolucionAbierta(open => !open)}>{notaDevolucionAbierta ? 'Ocultar nota de devolución' : 'Ver nota de devolución'}</Button>}{notaDevolucionAbierta && <div id={`queja-${queja.id}-nota-devolucion`} className="mt-3 rounded-card border border-qms-border bg-qms-surface p-3 text-sm">{actividadLoading ? <LoadingSkeleton variant="list" label="Cargando nota de devolución…" framed={false} /> : actividadError ? <div role="alert"><p className="text-xs text-qms-muted">No se pudo cargar la nota.</p><Button size="sm" variant="ghost" onClick={() => refetchActividad()}>Reintentar</Button></div> : notaDevolucion ? <><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-qms-muted"><span>Motivo de devolución</span><time dateTime={notaDevolucion.created_at}>{caseDate(notaDevolucion.created_at)}</time></div><p className="whitespace-pre-wrap break-words leading-relaxed">{notaDevolucion.descripcion.slice(RETURN_NOTE_PREFIX.length).trim()}</p></> : <p className="text-xs text-qms-muted">No hay una nota de devolución registrada.</p>}</div>}</>}</CaseSection>}>
            <div data-resolution-header className="sticky top-0 z-10 flex min-w-0 items-center rounded-t-card border-b border-qms-border bg-qms-surface"><div className="min-w-0 flex-1 [&>[role=tablist]]:border-b-0"><Tabs id={`mis-queja-${queja.id}`} items={tabs} value={activeTab} onChange={value => setActiveTab(value as Tab)} label="Procesar mi queja" /></div>{activeTab === 'resolucion' && investigando && <Button className="mr-2" size="sm" variant="ghost" aria-label="Asistencia para la resolución" title="Asistencia para la resolución" aria-expanded={assistanceOpen} aria-controls={`queja-${queja.id}-asistencia`} onClick={() => setAssistanceOpen(open => !open)}><CircleHelp className="size-4" /><span className="hidden sm:inline">Asistencia</span></Button>}</div>
            <section role="tabpanel" id={`mis-queja-${queja.id}-panel-detalle`} aria-labelledby={`mis-queja-${queja.id}-tab-detalle`} hidden={activeTab !== 'detalle'} className="divide-y divide-qms-border">
              <CaseSection title="Descripción" variant="document" headerActions={<span className="max-w-full break-words text-sm text-qms-muted">Área afectada: {queja.area_afectada || 'Sin indicar'}</span>}><p className="whitespace-pre-wrap break-words text-base leading-relaxed">{queja.descripcion || 'Sin descripción.'}</p></CaseSection>
              {queja.justificacion_procede && <CaseSection title="Evaluación de procedencia" source="Gestión de Calidad" variant="document"><RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} /></CaseSection>}
              {analysis && <CaseSection title="Análisis registrado" source="Gestión interna" variant="document"><RichTextContent value={analysis.value} format={analysis.format} /></CaseSection>}
                <CaseSection title="Archivos del expediente" variant="document">
                  <p className="mb-3 text-xs text-qms-muted">Evidencias del cliente e investigación interna, identificadas por su origen.</p>
                  {adjuntosLoading ? <LoadingSkeleton variant="list" label="Cargando evidencias de análisis…" framed={false} /> : adjuntosError ? <div role="alert"><p className="text-sm text-qms-muted">No se pudieron cargar los archivos.</p><Button size="sm" variant="ghost" onClick={() => refetchAdjuntos()}>Reintentar archivos</Button></div> : adjuntos.length ? <ListaAdjuntos adjuntos={adjuntos} layout="cards" onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} puedeEliminar={puedeEliminarAdjunto} onEliminar={a => setConfirmarEliminacion(a.id)} /> : <p className="text-sm text-qms-muted">Sin evidencias de investigación todavía.</p>}
                  {investigando && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-qms-border pt-3"><label className={`ui-button ui-button-secondary ui-button-sm relative cursor-pointer ${subiendoAdjuntoAnalisis ? 'pointer-events-none opacity-60' : ''}`}><Upload className="size-4" />Adjuntar evidencia<input aria-label="Adjuntar evidencia de investigación" type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={subiendoAdjuntoAnalisis} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) handleSubirAdjuntoAnalisis(file) }} /></label>{subiendoAdjuntoAnalisis && <span role="status" className="inline-flex items-center gap-2 text-xs text-qms-muted"><Spinner size="sm" />Subiendo…</span>}</div>}
                </CaseSection>
                <CaseSection title="Notas de investigación" variant="document">
                  <textarea aria-label="Nueva nota de investigación" rows={4} maxLength={DOCUMENT_LIMIT} placeholder="Registrá un avance o comentario de tu investigación..." className="ui-textarea w-full px-3 py-2 text-sm" value={nota} disabled={!canEdit} onChange={event => { draftVersions.current.nota++; setNota(event.target.value) }} />
                  <div className="mt-3 flex justify-end"><Button size="sm" onClick={handleAgregarNota} disabled={!nota.trim() || !canEdit} loading={agregandoNota}><Send className="size-4" /> Agregar nota</Button></div>
                  <div className="mt-4 border-t border-qms-border pt-4">{actividadLoading ? <LoadingSkeleton variant="list" label="Cargando actividad…" framed={false} /> : actividadError ? <div role="alert"><p className="text-sm text-qms-muted">No se pudo cargar la actividad.</p><Button size="sm" variant="ghost" onClick={() => refetchActividad()}>Reintentar actividad</Button></div> : actividad.length === 0 ? <p className="text-sm text-qms-muted">Sin actividad registrada todavía.</p> : <ol className="space-y-4">{actividad.map(item => <li key={item.id} className="border-l-2 border-qms-border pl-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-qms-muted"><span>{item.tipo}</span><time dateTime={item.created_at}>{caseDate(item.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.descripcion}</p></li>)}</ol>}</div>
                </CaseSection>
              {queja.observaciones && <CaseSection title="Observación anterior" variant="document"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{queja.observaciones}</p></CaseSection>}
            </section>

            <section role="tabpanel" id={`mis-queja-${queja.id}-panel-resolucion`} aria-labelledby={`mis-queja-${queja.id}-tab-resolucion`} hidden={activeTab !== 'resolucion'}>{assistance}<DeferredMount key={queja.id} active={activeTab === 'resolucion'}>
              {investigando ? <>
                <div className="flex h-[max(360px,calc(100dvh-22rem))] min-w-0 flex-col"><RichTextEditor id={`colaborador-resolucion-${queja.id}`} label="Conclusión de la investigación" placeholder="Documentá la conclusión y los hallazgos de tu investigación..." value={resolucion} format={resolucionFormato} onChange={(value, format) => { if (resolucionRevision === null) setResolucionRevision(queja.revision); draftVersions.current.resolucion++; setResolucion(value); setResolucionFormato(format) }} variant="document" layout="fill" maxLength={DOCUMENT_LIMIT} required disabled={loading} className="mis-quejas-resolution-editor" /></div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-qms-border px-4 py-3 sm:px-5"><p className="text-xs text-qms-muted">Se envía a Calidad para revisión; no notifica al cliente.</p><Button onClick={handleEnviarRevision} loading={loading} disabled={!resolucion.trim()}>Enviar a Revisión GC</Button></div>
              </> : <p className="px-4 py-3 text-sm leading-relaxed text-qms-muted sm:px-5">{action}</p>}
              {(queja.resolucion || queja.numero_oficio_resolucion) && <details key={queja.id} data-resolution-history open={!investigando} className="border-t border-qms-border"><summary className="cursor-pointer px-4 py-3 text-sm text-qms-muted sm:px-5">{investigando ? 'Propuesta anterior registrada' : 'Documento registrado'}</summary><CaseSection source={['Resuelto', 'Finalizado', 'No Procede'].includes(estado) ? 'Gestión de Calidad' : 'Responsable'} title={['Resuelto', 'Finalizado', 'No Procede'].includes(estado) ? 'Resolución interna aprobada' : 'Propuesta enviada a Calidad'} variant="document" headerActions={queja.numero_oficio_resolucion && <span className="max-w-full break-words text-sm text-qms-muted">N.º de oficio: {queja.numero_oficio_resolucion}</span>}>{queja.resolucion && <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />}</CaseSection></details>}
            </DeferredMount></section>
      </CaseWorkspace>
    </Modal>
    <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    <ConfirmDialog open={confirmarEliminacion !== null} title="Eliminar adjunto" message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer." confirmLabel="Eliminar" danger loading={eliminandoAdjunto !== null} onConfirm={() => confirmarEliminacion && handleEliminarAdjunto(confirmarEliminacion)} onCancel={() => setConfirmarEliminacion(null)} />
  </>
}

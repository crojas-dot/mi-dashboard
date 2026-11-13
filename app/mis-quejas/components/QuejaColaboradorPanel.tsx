'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleHelp, ClipboardCheck, Eye, FilePenLine, Maximize, Minimize, Pencil, Save, Send } from 'lucide-react'
import Modal from '@/components/Modal'
import QuejaPlazoIndicator from '@/components/quejas/QuejaPlazoIndicator'
import Badge from '@/components/ui/Badge'
import { varianteEstado } from '@/lib/constants/estados'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextContent from '@/components/ui/RichTextContent'
import type { Queja } from '@/lib/types'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import { quejaActividadKey, useQuejaActividad, useCrearQuejaActividad, type QuejaActividad } from '@/lib/queries/useQuejaActividad'
import { actualizarNotaInvestigacion, eliminarNotaInvestigacion } from '@/lib/services/quejaInvestigacionService'
import { esNotaInvestigacion, obtenerDevolucionPendiente, obtenerHistorialDevoluciones } from '@/lib/utils/quejaInvestigacionNotas'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { useQuejaPlazos } from '@/lib/queries/useQuejaSeguimiento'
import { enviarResolucionBorradorRevision, guardarResolucionBorrador } from '@/lib/services/quejaWorkflowService'
import { quejaResolucionDraftKey, useQuejaResolucionDraft, type QuejaResolucionDraft } from '@/lib/queries/useQuejaResolucionDraft'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaAttachmentActions } from '@/hooks/useQuejaAttachmentActions'
import { useQuejaAssistant } from '@/app/mis-quejas/components/useQuejaAssistant'
import { CaseCompletionDate, CaseCycle, CaseProcessHeader, CaseRequestHeader, CaseSection, CaseWorkspace } from '@/app/quejas/components/QuejaExpedientePanels'
import QuejaInvestigacionResumen from '@/app/mis-quejas/components/QuejaInvestigacionResumen'
import QuejaAnalisisPanel from '@/app/mis-quejas/components/QuejaAnalisisPanel'
import QuejaNotasPanel, { QuejaNotasCard } from '@/app/mis-quejas/components/QuejaNotasPanel'
import QuejaAdjuntosInvestigacion, { QuejaAdjuntosCard } from '@/app/mis-quejas/components/QuejaAdjuntosInvestigacion'
import { caseDate, caseDeadline } from '@/app/quejas/components/quejaExpedienteModel'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  onNavigationLockChange?: (locked: boolean) => void
  onPrevious?: () => void
  onNext?: () => void
}
const DOCUMENT_LIMIT = 10000

export default function QuejaColaboradorPanel({ queja, onClose, onUpdated, onNavigationLockChange, onPrevious, onNext }: Props) {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const scope = useEntityRequestGuard(queja?.id ?? null)
  const draftVersions = useRef({ nota: 0, resolucion: 0 })
  const [analisisAbierto, setAnalisisAbierto] = useState(false)
  const [panelNotas, setPanelNotas] = useState(false)
  const [panelAdjuntos, setPanelAdjuntos] = useState(false)
  const resolutionContainer = useRef<HTMLDivElement>(null)
  const resolutionHeaderRef = useRef<HTMLDivElement>(null)
  const resolutionCaret = useRef<{ range: Range; version: number } | null>(null)
  const [resolucion, setResolucion] = useState('')
  const [resolucionFormato, setResolucionFormato] = useState<'plain' | 'markdown'>('plain')
  const [resolucionRevision, setResolucionRevision] = useState<number | null>(null)
  const [borradorVersion, setBorradorVersion] = useState<number | null>(null)
  const [borradorGuardado, setBorradorGuardado] = useState<QuejaResolucionDraft | null>(null)
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)
  const [editandoResolucion, setEditandoResolucion] = useState(true)
  const [nota, setNota] = useState('')
  const [notaEditando, setNotaEditando] = useState<QuejaActividad | null>(null)
  const [notaEdicion, setNotaEdicion] = useState('')
  const [notaMenu, setNotaMenu] = useState<string | null>(null)
  const [notaEliminar, setNotaEliminar] = useState<string | null>(null)
  const [operandoNota, setOperandoNota] = useState(false)
  const [assistanceOpen, setAssistanceOpen] = useState(false)
  const [verMotivoDevolucion, setVerMotivoDevolucion] = useState(false)
  const [errorResolucion, setErrorResolucion] = useState<string | null>(null)
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
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: refetchActividad } = useQuejaActividad(quejaId)
  const crearActividad = useCrearQuejaActividad()
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: refetchAdjuntos } = useQuejaAdjuntos(quejaId)
  const { data: runs = [], error: plazosError } = useQuejaPlazos(quejaId)
  const estado = queja?.estado ?? ''
  const canEdit = !!queja && !!user && (user.rol === 'admin' || user.rol === 'calidad' || user.rol === 'colaborador' && queja.responsable_id === user.id)
  const investigando = estado === 'En Investigación' && canEdit
  const { data: borradorRemoto, isFetching: cargandoBorrador, error: errorBorrador, refetch: recargarBorrador } = useQuejaResolucionDraft(quejaId, investigando)
  const resolutionDirty = borradorGuardado ? resolucion !== borradorGuardado.contenido || resolucionFormato !== borradorGuardado.formato : !!resolucion.trim()
  const resolutionSaved = !!borradorGuardado && !resolutionDirty
  const resolutionPending = loading || guardandoResolucion || investigando && borradorVersion === null || subiendoAdjuntoAnalisis || !!eliminandoAdjunto || aiAutoLoading || chatLoading
  const navigationLocked = analisisAbierto || panelNotas || panelAdjuntos || resolutionPending || agregandoNota || operandoNota || resolutionDirty || !!nota.trim() || !!notaEditando || !!aiResult.trim()
  useEffect(() => {
    onNavigationLockChange?.(!!queja && navigationLocked)
    return () => onNavigationLockChange?.(false)
  }, [queja, navigationLocked, onNavigationLockChange])
  // La barra de formato se fija justo debajo del encabezado real del editor.
  // Su altura puede variar cuando cambian el ancho, el idioma o los controles.
  useLayoutEffect(() => {
    if (!investigando) return
    const container = resolutionContainer.current
    const header = resolutionHeaderRef.current
    if (!container || !header) return
    const syncHeaderHeight = () => container.style.setProperty('--qms-resolution-header-height', `${header.offsetHeight}px`)
    syncHeaderHeight()
    const observer = new ResizeObserver(syncHeaderHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [quejaId, investigando])

  const handleClose = useCallback(() => {
    scope.invalidate()
    resolutionCaret.current = null
    setIsExpanded(false)
    setAnalisisAbierto(false)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setNotaMenu(null); setNotaEliminar(null)
    setAssistanceOpen(false)
    onNavigationLockChange?.(false)
    onClose()
  }, [scope, onClose, onNavigationLockChange])
  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  const [prevInvestigando, setPrevInvestigando] = useState(investigando)
  if (prevInvestigando !== investigando) {
    setPrevInvestigando(investigando)
    setAssistanceOpen(false)
    if (investigando) {
      setBorradorVersion(null); setBorradorGuardado(null)
      setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
      setEditandoResolucion(true)
    }
  }
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
    setBorradorVersion(null); setBorradorGuardado(null); setGuardandoResolucion(false)
    setEditandoResolucion(true)
    setNotaEditando(null); setNotaEdicion(''); setNotaMenu(null); setNotaEliminar(null); setOperandoNota(false)
    setAnalisisAbierto(false)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setNota(''); setAssistanceOpen(false); setIsExpanded(false); setLoading(false); setAgregandoNota(false)
  }
  if (!queja) return null
  // La primera lectura hidrata esta visita; un refetch no sobrescribe lo escrito
  // ni actualiza silenciosamente la versión que se comparará al guardar/enviar.
  if (investigando && borradorVersion === null && !cargandoBorrador && !errorBorrador && borradorRemoto !== undefined) {
    setBorradorVersion(borradorRemoto?.version ?? 0)
    setBorradorGuardado(borradorRemoto)
    if (borradorRemoto) {
      setResolucion(borradorRemoto.contenido); setResolucionFormato(borradorRemoto.formato)
      setResolucionRevision(queja.revision)
      setEditandoResolucion(false)
    }
  }
  const deadline = caseDeadline(queja, runs)
  const devolucion = obtenerDevolucionPendiente(estado, actividad)
  const devoluciones = devolucion ? obtenerHistorialDevoluciones(actividad) : []
  const notasInvestigacion = actividad.filter(esNotaInvestigacion)
  const reenviarRevision = investigando && !!devolucion

  const handleGuardarResolucion = async () => {
    if (!investigando || resolutionPending || borradorVersion === null || !resolutionDirty) return
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.resolucion
    setGuardandoResolucion(true)
    try {
      const saved = await guardarResolucionBorrador({ ...queja, revision: resolucionRevision ?? queja.revision }, borradorVersion, resolucion, resolucionFormato)
      if (isContextCurrent()) queryClient.setQueryData(quejaResolucionDraftKey(queja.id), saved)
      if (operation.isCurrent()) {
        setBorradorVersion(saved.version); setBorradorGuardado(saved)
        if (draftVersions.current.resolucion === draftVersion) setEditandoResolucion(false)
        showSuccess('Borrador guardado en el expediente')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo guardar el borrador de resolución')
    } finally {
      // El flag local se libera siempre: el scope decide si la respuesta sigue vigente.
      setGuardandoResolucion(false)
      operation.finish()
    }
  }
  const handleCancelarEdicionResolucion = () => {
    if (resolutionPending) return
    draftVersions.current.resolucion++
    resolutionCaret.current = null
    setResolucion(borradorGuardado?.contenido ?? '')
    setResolucionFormato(borradorGuardado?.formato ?? 'plain')
    setEditandoResolucion(false)
    setAssistanceOpen(false)
    setErrorResolucion(null)
  }
  const puedeModificarNota = (item: QuejaActividad) => investigando && item.usuario_id === user?.id && esNotaInvestigacion(item)
  const handleMutarNota = async (item: QuejaActividad, eliminar = false) => {
    if (!puedeModificarNota(item) || operandoNota) return
    const operation = scope.start('investigation-note')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setOperandoNota(true)
    try {
      if (eliminar) await eliminarNotaInvestigacion(item)
      else await actualizarNotaInvestigacion(item, notaEdicion)
      if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: quejaActividadKey(queja.id) })
      if (operation.isCurrent()) {
        if (!eliminar) { setNotaEditando(null); setNotaEdicion('') }
        setNotaEliminar(null); setNotaMenu(null)
        showSuccess(eliminar ? 'Nota eliminada' : 'Nota actualizada')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, eliminar ? 'No se pudo eliminar la nota' : 'No se pudo actualizar la nota')
    } finally {
      if (operation.isCurrent()) setOperandoNota(false)
      operation.finish()
    }
  }
  const alternarMenuNota = (id: string) => {
    setNotaMenu(current => current === id ? null : id)
    setNotaEliminar(null)
  }
  const iniciarEdicionNota = (item: QuejaActividad) => {
    setNotaMenu(null); setNotaEliminar(null)
    setNotaEditando(item)
    setNotaEdicion(item.descripcion)
  }
  const cancelarEdicionNota = () => { setNotaEditando(null); setNotaEdicion('') }
  const confirmarEliminarNota = () => {
    const item = notasInvestigacion.find(nota => nota.id === notaEliminar)
    return item ? handleMutarNota(item, true) : undefined
  }

  const handleEnviarRevision = async () => {
    if (resolutionPending || borradorVersion === null) return
    if (!investigando) { showError(null, 'Esta queja no está disponible para enviar a revisión.'); return }
    if (!resolucion.trim()) { showError(null, 'Escribí la conclusión antes de enviarla a revisión'); return }
    if (resolucion.length > DOCUMENT_LIMIT) { showError(null, 'La conclusión admite hasta 10.000 caracteres.'); return }
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.resolucion
    setErrorResolucion(null)
    setLoading(true)
    let confirmed = false
    try {
      // La revisión se captura al editar: refrescar el expediente nunca fuerza el guardado.
      const updated = await enviarResolucionBorradorRevision({ ...queja, revision: resolucionRevision ?? queja.revision }, borradorVersion, resolucion, resolucionFormato)
      confirmed = true
      if (isContextCurrent()) {
        queryClient.setQueryData(quejaResolucionDraftKey(queja.id), null)
        onUpdated(updated, operation.isCurrent)
      }
      if (operation.isCurrent()) {
        showSuccess('Resolución enviada a Gestión de Calidad')
        if (draftVersions.current.resolucion === draftVersion) {
          setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
          setBorradorVersion(0); setBorradorGuardado(null)
          setAssistanceOpen(false)
        }
      }
    } catch (error) {
      const mensaje = confirmed ? 'La resolución se envió, pero no se pudo actualizar la vista' : 'No se pudo enviar la resolución'
      const detalle = error instanceof Error ? error.message : typeof error === 'string' ? error : (error as { message?: string })?.message ?? mensaje
      setErrorResolucion(detalle)
      if (operation.isCurrent()) showError(error, mensaje)
    } finally {
      // El flag local se libera siempre: el scope decide si la respuesta sigue vigente.
      setLoading(false)
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
  const adjuntosAnalisis = adjuntos.filter(adjunto => !!adjunto.usuario_id)
  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto) => investigando && !!adjunto.usuario_id && canEdit
  const agregarAdjuntosAnalisis = async (files: File[]) => {
    if (!investigando || resolutionPending) return
    // El servicio usa un candado por archivo, así que los soltados juntos se suben en orden.
    for (const file of files) await handleSubirAdjuntoAnalisis(file)
  }
  const capturarPuntoResolucion = () => {
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    resolutionCaret.current = range && resolutionContainer.current?.contains(range.commonAncestorContainer) ? { range: range.cloneRange(), version: draftVersions.current.resolucion } : null
  }
  const restaurarPuntoResolucion = () => {
    const caret = resolutionCaret.current
    if (caret) requestAnimationFrame(() => {
      if (caret.version !== draftVersions.current.resolucion || !resolutionContainer.current?.contains(caret.range.commonAncestorContainer)) return
      resolutionContainer.current.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
      const selection = window.getSelection()
      selection?.removeAllRanges(); selection?.addRange(caret.range)
    })
  }
  const abrirAnalisis = () => {
    capturarPuntoResolucion()
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setAnalisisAbierto(true)
  }
  const cerrarAnalisis = () => {
    setAnalisisAbierto(false)
    restaurarPuntoResolucion()
  }
  const abrirNotas = () => {
    capturarPuntoResolucion()
    setPanelAdjuntos(false)
    setAnalisisAbierto(false)
    setNotaMenu(null); setNotaEliminar(null)
    setPanelNotas(true)
  }
  const cerrarNotas = () => {
    setPanelNotas(false)
    setNotaMenu(null); setNotaEliminar(null)
    restaurarPuntoResolucion()
  }
  const abrirAdjuntos = () => {
    capturarPuntoResolucion()
    setAnalisisAbierto(false)
    setPanelNotas(false)
    setPanelAdjuntos(true)
  }
  const cerrarAdjuntos = () => {
    setPanelAdjuntos(false)
    restaurarPuntoResolucion()
  }
  const prepararResolucion = () => {
    setEditandoResolucion(true)
    cerrarAnalisis()
    requestAnimationFrame(() => {
      resolutionContainer.current?.scrollIntoView({ block: 'start' })
      resolutionContainer.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
    })
  }
  const plazo = <QuejaPlazoIndicator deadline={deadline} />
  const action = investigando ? null : estado === 'Pendiente de Revisión GC' ? 'Gestión de Calidad revisará la propuesta. Si requiere ajustes, volverá a investigación.' : 'El expediente conserva el trabajo y las evidencias registradas.'
  const tieneDocumentoRegistrado = !!(queja.resolucion || queja.numero_oficio_resolucion)
  const documentoAprobado = ['Resuelto', 'Finalizado', 'No Procede'].includes(estado)
  // La ayuda se despliega fuera de la cabecera para no comprimir sus controles.
  const assistance = <div id={`queja-${queja.id}-asistencia`} data-resolution-assistance role="region" aria-label="Asistencia para la resolución" hidden={!assistanceOpen || !investigando || !editandoResolucion} className="min-w-0 shrink-0 border-b border-qms-border px-4 py-3"><div className="max-h-[30dvh] overflow-y-auto overscroll-contain">
                <p className="text-xs text-qms-muted">La sugerencia no se guarda ni se envía. Revisala antes de usarla en la resolución.</p>
                <Button className="mt-3" size="sm" variant="ghost" onClick={handleAnalisisAuto} loading={aiAutoLoading} disabled={!investigando}>Análisis IA</Button>
                {aiResult && <div className="mt-3 space-y-3"><RichTextContent value={aiResult} format="markdown" /><Button size="sm" variant="secondary" disabled={aiResult.length > DOCUMENT_LIMIT || !!resolucion.trim() || !investigando} onClick={() => { draftVersions.current.resolucion++; setResolucion(aiResult); setResolucionFormato('markdown'); if (resolucionRevision === null) setResolucionRevision(queja.revision) }}>Usar en resolución</Button></div>}
                <details className="min-w-0 py-4"><summary className="cursor-pointer text-sm text-qms-muted">Consultar al asistente</summary><p className="mt-3 text-xs text-qms-muted">Solo consulta al proveedor configurado cuando enviás una pregunta.</p>
                  <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">{chat.map(message => <div key={message.id} className={`rounded-card p-3 text-sm ${message.role === 'user' ? 'bg-qms-primary-soft' : 'bg-qms-hover-bg'}`}><p className="mb-1 text-xs font-medium text-qms-muted">{message.role === 'user' ? 'Tu consulta' : 'Asistente'}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p></div>)}</div>
                  <div className="mt-4 flex flex-wrap items-end gap-2"><textarea aria-label="Pregunta al asistente" rows={2} maxLength={DOCUMENT_LIMIT} placeholder="Hacé una pregunta sobre esta queja..." className="ui-textarea min-w-0 flex-[1_1_12rem] resize-none px-3 py-2 text-sm" value={chatInput} onChange={event => setChatInput(event.target.value)} disabled={chatLoading || !investigando} /><Button size="sm" variant="secondary" onClick={handleEnviarIA} loading={chatLoading} disabled={!chatInput.trim() || !investigando}><Send className="size-4" /> Enviar</Button></div>
                </details>
              </div></div>

  return <>
    <Modal open onClose={analisisAbierto ? cerrarAnalisis : panelNotas ? cerrarNotas : panelAdjuntos ? cerrarAdjuntos : handleClose} title={`Folio ${queja.folio}`} variant="workspace" expanded={isExpanded}
      headerCenter={<div className={isExpanded ? 'mx-auto w-full max-w-3xl' : 'w-full'}><CaseProcessHeader queja={queja} /></div>} headerActions={<>
      <Button size="icon" variant="ghost" aria-label="Queja anterior" disabled={!onPrevious || navigationLocked} onClick={onPrevious}><ArrowLeft className="size-5" /></Button>
      <Button size="icon" variant="ghost" aria-label="Queja siguiente" disabled={!onNext || navigationLocked} onClick={onNext}><ArrowRight className="size-5" /></Button>
      <Button size="icon" variant="ghost" aria-label={isExpanded ? 'Reducir expediente' : 'Ampliar expediente'} title={isExpanded ? 'Reducir expediente' : 'Ampliar expediente'} onClick={() => setIsExpanded(value => !value)}>{isExpanded ? <Minimize className="size-5" /> : <Maximize className="size-5" />}</Button>
    </>}>
      <CaseWorkspace documentKey={queja.id} expanded={isExpanded} cyclePlacement="header" presentation="reference" documentStyle="cards" readingLayout
        request={<CaseRequestHeader key={queja.id} queja={queja} variant={isExpanded ? 'panel' : 'details'} reference />}
        requestFooter={<div className="space-y-4">
          <QuejaAdjuntosCard adjuntos={adjuntosAnalisis} loading={adjuntosLoading} error={!!adjuntosError}
            onOpen={abrirAdjuntos} />
          <QuejaNotasCard notas={notasInvestigacion} loading={actividadLoading} error={!!actividadError} onOpen={abrirNotas} />
        </div>}
        compact={<CaseCycle queja={queja} process currentOnly />} cycle={<CaseCycle queja={queja} process />}
        action={<div className="space-y-4"><section className="min-w-0 rounded-card border border-qms-border bg-qms-surface p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck aria-hidden="true" className="size-4 text-qms-primary" />Acción actual</h3>
          <Badge variant={queja.estado_color || varianteEstado('quejas', estado)}>{queja.estado_nombre || estado}</Badge>
          <CaseCompletionDate queja={queja} />
          <div className="mt-3" title={deadline.stageTitle}>{plazo}{plazosError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el calendario. Se conserva el vencimiento registrado.</p>}</div>
          {action && <p className="mt-3 text-xs leading-relaxed text-qms-muted">{action}</p>}
          <div className="mt-4 space-y-2">
            <Button aria-label="Ver caso completo" className="w-full border-qms-brand-red! bg-qms-brand-red! hover:border-qms-brand-red! hover:bg-qms-surface! hover:text-qms-brand-red!" size="sm" onClick={abrirAnalisis}><Eye aria-hidden="true" className="size-4 shrink-0" />Ver caso completo</Button>
            {investigando && <Button size="sm" className="w-full min-w-0 whitespace-normal" onClick={handleEnviarRevision} loading={loading} disabled={!resolucion.trim() || resolutionPending}>{reenviarRevision && loading ? null : <Send aria-hidden="true" className="size-4 shrink-0" />}{reenviarRevision ? 'Reenviar a Revisión GC' : 'Enviar a Revisión GC'}</Button>}
          </div>
          {errorResolucion && <div role="alert" className="rounded-card border border-qms-border bg-qms-surface p-3 text-sm text-qms-danger">{errorResolucion}</div>}
        </section>{reenviarRevision && <QuejaInvestigacionResumen devolucion={devolucion} devoluciones={devoluciones} open={verMotivoDevolucion} onOpenChange={setVerMotivoDevolucion} />}</div>}>
        {investigando ? <div ref={resolutionContainer} data-resolution-inline className="min-w-0 scroll-mt-4 overflow-visible rounded-card border border-qms-border bg-qms-surface shadow-sm">
          <div ref={resolutionHeaderRef} data-resolution-header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-t-card border-b border-qms-border bg-qms-surface px-5 py-4 sm:px-8"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-button bg-qms-primary-soft text-qms-primary"><FilePenLine className="size-5" /></span><div><h3 className="text-base font-semibold">Resolución</h3><p className="mt-0.5 text-xs text-qms-muted">{editandoResolucion ? 'Redactá la propuesta para revisión de Calidad.' : borradorGuardado ? 'Propuesta guardada. Editá para continuar.' : 'Sin propuesta guardada. Editá para comenzar.'}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2">{editandoResolucion
            ? <><Button data-resolution-cancel size="sm" variant="secondary" className="px-2! sm:px-3!" onClick={handleCancelarEdicionResolucion} disabled={resolutionPending}>Cancelar</Button><Button data-resolution-save size="sm" className="px-2! sm:px-3!" variant={resolutionDirty ? 'primary' : 'secondary'} onClick={handleGuardarResolucion} loading={guardandoResolucion} loadingLabel="Guardando…" disabled={!resolutionDirty || resolutionPending}>{resolutionSaved ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <Save aria-hidden="true" className="size-4 shrink-0" />}Guardar</Button></>
            : <Button data-resolution-edit size="sm" className="px-2! sm:px-3!" variant="secondary" title={borradorGuardado ? `Guardado el ${caseDate(borradorGuardado.updated_at)}` : 'Editar resolución'} disabled={resolutionPending} onClick={() => setEditandoResolucion(true)}><Pencil aria-hidden="true" className="size-4 shrink-0" />Editar</Button>}{editandoResolucion && <Button size="sm" className="px-2! sm:px-3!" variant="secondary" aria-label="Asistencia para la resolución" title="Asistencia para la resolución" aria-expanded={assistanceOpen} aria-controls={`queja-${queja.id}-asistencia`} disabled={resolutionPending} onClick={() => setAssistanceOpen(open => !open)}><CircleHelp className="size-4" />Asistencia</Button>}</div><span role="status" className="sr-only">{guardandoResolucion ? 'Guardando borrador…' : borradorVersion === null ? 'Cargando borrador…' : resolutionSaved ? 'Borrador guardado' : resolutionDirty ? 'Cambios sin guardar' : 'Sin contenido todavía'}</span></div>
          {assistance}
          {errorBorrador && borradorVersion === null && <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-qms-border px-5 py-2 text-sm text-qms-muted sm:px-8"><span>No se pudo cargar el borrador guardado.</span><Button size="sm" variant="ghost" loading={cargandoBorrador} onClick={() => { void recargarBorrador() }}>Reintentar borrador</Button></div>}
          <div className="min-w-0"><RichTextEditor id={`colaborador-resolucion-${queja.id}`} label="Resolución" placeholder="Documentá la conclusión y los hallazgos de tu investigación..." value={resolucion} format={resolucionFormato} onChange={(value, format) => { if (resolucionRevision === null) setResolucionRevision(queja.revision); draftVersions.current.resolucion++; setResolucion(value); setResolucionFormato(format) }} variant="document" layout="content" minHeight={540} maxLength={DOCUMENT_LIMIT} required readOnly={!editandoResolucion} disabled={loading || guardandoResolucion || borradorVersion === null} className="mis-quejas-resolution-editor" /></div>
        </div> : <CaseSection title={tieneDocumentoRegistrado ? documentoAprobado ? 'Resolución interna aprobada' : 'Propuesta enviada a Calidad' : 'Expediente'} source={tieneDocumentoRegistrado ? documentoAprobado ? 'Gestión de Calidad' : 'Responsable' : undefined} variant="panel"><div data-reading-copy>{queja.resolucion && <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />}
          {queja.numero_oficio_resolucion && <p className="mt-3 break-words text-sm text-qms-muted">N.º de oficio: {queja.numero_oficio_resolucion}</p>}</div>
        </CaseSection>}
      </CaseWorkspace>
      <QuejaAdjuntosInvestigacion open={panelAdjuntos} folio={queja.folio} onClose={cerrarAdjuntos}
        adjuntos={adjuntosAnalisis} loading={adjuntosLoading} error={!!adjuntosError}
        onRetry={() => { void refetchAdjuntos() }} canUpload={investigando} uploadDisabled={resolutionPending}
        uploading={subiendoAdjuntoAnalisis} canDelete={adjunto => !resolutionPending && puedeEliminarAdjunto(adjunto)}
        onFiles={files => { void agregarAdjuntosAnalisis(files) }}
        onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        onDelete={adjunto => setConfirmarEliminacion(adjunto.id)} />
      <QuejaNotasPanel open={panelNotas} folio={queja.folio} onClose={cerrarNotas} notas={notasInvestigacion} loading={actividadLoading} error={!!actividadError} onRetry={() => { void refetchActividad() }} canEdit={canEdit} nota={nota} maxLength={DOCUMENT_LIMIT} saving={agregandoNota} onChange={value => { draftVersions.current.nota++; setNota(value) }} onAdd={handleAgregarNota}
        puedeModificar={puedeModificarNota} menuId={notaMenu} editingId={notaEditando?.id ?? null} editValue={notaEdicion} deletingId={notaEliminar} operating={operandoNota}
        onToggleMenu={alternarMenuNota} onEdit={iniciarEdicionNota} onEditChange={setNotaEdicion} onCancelEdit={cancelarEdicionNota}
        onSaveEdit={() => notaEditando ? handleMutarNota(notaEditando) : undefined} onRequestDelete={setNotaEliminar} onCancelDelete={() => setNotaEliminar(null)} onConfirmDelete={confirmarEliminarNota} />
      <QuejaAnalisisPanel queja={queja} open={analisisAbierto} onClose={cerrarAnalisis}
        onPrepararResolucion={investigando ? prepararResolucion : undefined} devolucion={devolucion}
        adjuntos={adjuntos} adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError} onRetryAdjuntos={() => { void refetchAdjuntos() }} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        actividad={actividad} actividadLoading={actividadLoading} actividadError={!!actividadError} onRetryActividad={() => { void refetchActividad() }} />
    </Modal>
    <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    <ConfirmDialog open={confirmarEliminacion !== null} title="Eliminar adjunto" message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer." confirmLabel="Eliminar" danger loading={eliminandoAdjunto !== null} onConfirm={() => confirmarEliminacion && handleEliminarAdjunto(confirmarEliminacion)} onCancel={() => setConfirmarEliminacion(null)} />
  </>
}

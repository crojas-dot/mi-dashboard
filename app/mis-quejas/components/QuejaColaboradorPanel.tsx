'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, Eye, FilePenLine, History, Maximize, Minimize, Pencil, Save, Send, WandSparkles } from 'lucide-react'
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
import { CaseCompletionDate, CaseCycle, CaseProcessHeader, CaseSidebarShortcut, CaseWorkspaceNavigation, CaseRequestHeader, CaseSection, CaseWorkspace } from '@/app/quejas/components/QuejaExpedientePanels'
import QuejaInvestigacionResumen from '@/app/mis-quejas/components/QuejaInvestigacionResumen'
import { CaseTriageSummary, CaseTriageNextStep, CaseTriageExcerpt, CaseTriageAttachments, CaseTriageFooter } from '@/app/quejas/components/CaseTriageSummary'
import { useQuejaDevoluciones } from '@/lib/queries/useQuejaDevoluciones'
import QuejaAnalisisPanel, { QuejaTimeline } from '@/app/mis-quejas/components/QuejaAnalisisPanel'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import AreaAfectada from '@/components/quejas/AreaAfectada'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import QuejaNotasPanel, { QuejaNotasCard } from '@/app/mis-quejas/components/QuejaNotasPanel'
import QuejaAdjuntosInvestigacion, { QuejaAdjuntosCard } from '@/app/mis-quejas/components/QuejaAdjuntosInvestigacion'
import { caseDate, caseDeadline, getCaseProcessCycle, type CaseTriageNextStepData } from '@/app/quejas/components/quejaExpedienteModel'
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
type CaseViewStage = 'analysis' | 'investigation' | 'quality_review'

function currentStageFromStatus(status?: string): CaseViewStage {
  switch (status) {
    case 'En Investigación': return 'investigation'
    case 'Pendiente de Revisión GC':
    case 'Resuelto':
    case 'Finalizado': return 'quality_review'
    default: return 'analysis'
  }
}

export default function QuejaColaboradorPanel({ queja, onClose, onUpdated, onNavigationLockChange, onPrevious, onNext }: Props) {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const scope = useEntityRequestGuard(queja?.id ?? null)
  const draftVersions = useRef({ nota: 0, resolucion: 0 })
  const [analisisAbierto, setAnalisisAbierto] = useState(false)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [stageView, setStageView] = useState<CaseViewStage>(() => currentStageFromStatus(queja?.estado))
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [panelNotas, setPanelNotas] = useState(false)
  const [panelAdjuntos, setPanelAdjuntos] = useState(false)
  const resolutionContainer = useRef<HTMLDivElement>(null)
  const resolutionCaret = useRef<{ range: Range; version: number } | null>(null)
  const [resolucion, setResolucion] = useState('')
  const [resolucionFormato, setResolucionFormato] = useState<'plain' | 'markdown'>('plain')
  const [resolucionRevision, setResolucionRevision] = useState<number | null>(null)
  const [borradorVersion, setBorradorVersion] = useState<number | null>(null)
  const [borradorGuardado, setBorradorGuardado] = useState<QuejaResolucionDraft | null>(null)
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)
  const [editandoResolucion, setEditandoResolucion] = useState(true)
  const [resolutionOverlay, setResolutionOverlay] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [nota, setNota] = useState('')
  const [notaEditando, setNotaEditando] = useState<QuejaActividad | null>(null)
  const [notaEdicion, setNotaEdicion] = useState('')
  const [notaMenu, setNotaMenu] = useState<string | null>(null)
  const [notaEliminar, setNotaEliminar] = useState<string | null>(null)
  const [operandoNota, setOperandoNota] = useState(false)
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
  const { aiAutoLoading, aiResult, setAiResult, handleAnalisisAuto } = useQuejaAssistant(queja?.id ?? null, scope)
  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: refetchActividad } = useQuejaActividad(quejaId)
  const crearActividad = useCrearQuejaActividad()
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: refetchAdjuntos } = useQuejaAdjuntos(quejaId)
  const { data: runs = [], error: plazosError } = useQuejaPlazos(quejaId)
  const estado = queja?.estado ?? ''
  const canEdit = !!queja && !!user && (user.rol === 'admin' || user.rol === 'calidad' || user.rol === 'colaborador' && queja.responsable_id === user.id)
  const investigando = estado === 'En Investigación' && canEdit
  const { data: devolucionesPersistidas = [] } = useQuejaDevoluciones(quejaId, investigando)
  const { data: borradorRemoto, isFetching: cargandoBorrador, error: errorBorrador, refetch: recargarBorrador } = useQuejaResolucionDraft(quejaId, investigando)
  const resolutionDirty = borradorGuardado ? resolucion !== borradorGuardado.contenido || resolucionFormato !== borradorGuardado.formato : !!resolucion.trim()
  const resolutionSaved = !!borradorGuardado && !resolutionDirty
  const resolutionPending = loading || guardandoResolucion || investigando && borradorVersion === null || subiendoAdjuntoAnalisis || !!eliminandoAdjunto || aiAutoLoading
  const navigationLocked = historialAbierto || analisisAbierto || panelNotas || panelAdjuntos || resolutionPending || agregandoNota || operandoNota || resolutionDirty || !!nota.trim() || !!notaEditando || !!aiResult.trim()
  useEffect(() => {
    onNavigationLockChange?.(!!queja && navigationLocked)
    return () => onNavigationLockChange?.(false)
  }, [queja, navigationLocked, onNavigationLockChange])
  // El editor ampliado conserva el nodo, la anchura y el borde inferior original.
  const expandirResolucion = () => {
    const card = resolutionContainer.current
    if (!card) return
    const bounds = card.getBoundingClientRect()
    const dialogBounds = card.closest('dialog')?.getBoundingClientRect()
    const top = Math.max(8, (dialogBounds?.top ?? 0) + 8)
    const bottom = Math.min(bounds.bottom, (dialogBounds?.bottom ?? window.innerHeight) - 8, window.innerHeight - 8)
    if (bottom - top < bounds.height) return
    setResolutionOverlay({ top, left: bounds.left, width: bounds.width, height: bottom - top })
  }
  const contraerResolucion = () => setResolutionOverlay(null)
  useEffect(() => {
    if (!resolutionOverlay) return
    const onResize = () => setResolutionOverlay(null)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [resolutionOverlay])

  const handleClose = useCallback(() => {
    scope.invalidate()
    resolutionCaret.current = null
    setResolutionOverlay(null)
    setIsExpanded(false)
    setAnalisisAbierto(false)
    setHistorialAbierto(false)
    setStageView(currentStageFromStatus(queja?.estado))
    setEditorAbierto(false)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setNotaMenu(null); setNotaEliminar(null)
    setAiResult('')
    onNavigationLockChange?.(false)
    onClose()
  }, [scope, onClose, onNavigationLockChange, setAiResult, queja?.estado])
  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  const [prevInvestigando, setPrevInvestigando] = useState(investigando)
  const [prevEstado, setPrevEstado] = useState(estado)
  if (prevInvestigando !== investigando) {
    setPrevInvestigando(investigando)
    setResolutionOverlay(null)
    setStageView(currentStageFromStatus(estado))
    setEditorAbierto(false)
    if (investigando) {
      setBorradorVersion(null); setBorradorGuardado(null)
      setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
      setEditandoResolucion(true)
    }
  }
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setResolutionOverlay(null)
    setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
    setBorradorVersion(null); setBorradorGuardado(null); setGuardandoResolucion(false)
    setEditandoResolucion(true)
    setNotaEditando(null); setNotaEdicion(''); setNotaMenu(null); setNotaEliminar(null); setOperandoNota(false)
    setAnalisisAbierto(false)
    setHistorialAbierto(false)
    setStageView(currentStageFromStatus(estado))
    setEditorAbierto(false)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setNota(''); setIsExpanded(false); setLoading(false); setAgregandoNota(false)
  }
  if (prevEstado !== estado) {
    setPrevEstado(estado)
    setStageView(currentStageFromStatus(estado))
    setEditorAbierto(false)
    setResolutionOverlay(null)
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
  const devoluciones = devolucion ? (devolucionesPersistidas.length ? devolucionesPersistidas : obtenerHistorialDevoluciones(actividad)) : []
  const notasInvestigacion = actividad.filter(esNotaInvestigacion)
  const reenviarRevision = investigando && !!devolucion
  // El ciclo muestra el estado real; consultar una etapa no modifica el workflow.
  const cicloProceso = getCaseProcessCycle(queja, {
    steps: [
      { id: 'analysis', label: 'Análisis', current: false, completed: false },
      { id: 'investigation', label: 'Investigación', current: false, completed: false },
      { id: 'quality_review', label: 'Revisión de GC', current: false, completed: false },
    ],
  })

  const etapaActual = currentStageFromStatus(estado)
  const etapaConsultada = stageView === etapaActual ? null : stageView
  const cambiarEtapa = (stage: string) => {
    if (navigationLocked || !cicloProceso.steps.some(step => step.id === stage)) return
    setResolutionOverlay(null)
    setStageView(stage as CaseViewStage)
    if (stage !== 'investigation') setEditorAbierto(false)
  }
  const analisisRegistrado = getQuejaAnalysis(queja)
  const adjuntosCliente = adjuntos.filter(adjunto => !adjunto.usuario_id)

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
        setAiResult('')
        if (draftVersions.current.resolucion === draftVersion) { setEditandoResolucion(false); setResolutionOverlay(null) }
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
    setResolutionOverlay(null)
    setAiResult('')
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
          setAiResult('')
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
  // Durante la investigación, «Mis adjuntos» lista la evidencia propia del
  // responsable; los adjuntos de Calidad (revisión/devolución) no son su trabajo.
  const adjuntosInvestigacion = adjuntos.filter(adjunto => adjunto.usuario_id === user?.id)
  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto) => investigando && adjunto.usuario_id === user?.id && canEdit
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
  const abrirEtapaActual = () => {
    setResolutionOverlay(null)
    setStageView(currentStageFromStatus(estado))
    setEditorAbierto(false)
    setIsExpanded(true)
  }
  const abrirVistaAnalisis = () => {
    setResolutionOverlay(null)
    setStageView('analysis')
    setEditorAbierto(false)
    setIsExpanded(true)
  }
  const prepararResolucion = () => {
    if (!investigando || resolutionPending) return
    setResolutionOverlay(null)
    setStageView('investigation')
    setEditorAbierto(true)
    setIsExpanded(true)
    setEditandoResolucion(true)
    cerrarAnalisis()
    // Primero presentar showModal y el editor existente; después restaurar foco.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Abrir el editor no debe desplazar el scroll exterior y ocultar su margen superior.
      const card = resolutionContainer.current
      const scrollport = card?.closest<HTMLElement>('[data-case-scroll]')
      if (scrollport) scrollport.scrollTop = 0
      card?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
    }))
  }
  const plazo = <QuejaPlazoIndicator deadline={deadline} />
  const action = investigando ? null : estado === 'Pendiente de Revisión GC' ? 'Gestión de Calidad revisará la propuesta. Si requiere ajustes, volverá a investigación.' : 'El expediente conserva el trabajo y las evidencias registradas.'
  const tieneDocumentoRegistrado = !!(queja.resolucion || queja.numero_oficio_resolucion)
  const documentoAprobado = ['Resuelto', 'Finalizado', 'No Procede'].includes(estado)
  const triageStep: CaseTriageNextStepData = investigando
    ? reenviarRevision && devolucion ? {
        title: 'Corrección requerida',
        description: 'Consulta la devolución y los antecedentes antes de corregir la resolución.',
        ctaLabel: 'Revisar investigación', icon: 'warning', tone: 'amber',
      } : resolutionDirty ? {
        title: 'Cambios sin guardar',
        description: 'Tienes cambios locales pendientes. Revísalos y guárdalos antes de enviar la propuesta.',
        ctaLabel: 'Continuar editando', icon: 'edit', tone: 'amber',
      } : borradorGuardado ? {
        title: 'Borrador guardado',
        description: `Tienes una propuesta guardada el ${caseDate(borradorGuardado.updated_at)}. Revísala o termínala.`,
        ctaLabel: 'Ver investigación', icon: 'saved', tone: 'blue',
      } : {
        title: 'Investigación en curso',
        description: 'Consulta el avance y los antecedentes antes de preparar la resolución.',
        ctaLabel: 'Ver investigación', icon: 'edit', tone: 'blue',
      }
    : estado === 'Pendiente de Revisión GC' ? {
        title: 'En revisión de Calidad',
        description: 'La propuesta fue enviada. Consulta el expediente mientras Calidad revisa el caso.',
        ctaLabel: 'Ver expediente completo', icon: 'review', tone: 'amber',
      } : documentoAprobado ? {
        title: 'Expediente cerrado',
        description: 'Consulta el resultado, los documentos y el seguimiento de este caso.',
        ctaLabel: 'Ver expediente de cierre completo', icon: 'archive', tone: 'green',
      } : {
        title: 'Consultar expediente',
        description: 'Revisa el estado y los antecedentes de este caso antes de continuar.',
        ctaLabel: 'Ver expediente completo', icon: 'file', tone: 'blue',
      }
  const compactTriage = <CaseTriageSummary queja={queja} runs={runs} plazoError={!!plazosError}
    responsable={queja.responsable_id === user?.id ? user?.nombre : undefined}
    primaryAction={<CaseTriageNextStep step={triageStep}
      onOpen={investigando && resolutionDirty ? prepararResolucion : abrirEtapaActual}
      disabled={investigando && resolutionPending} />}
    footer={<CaseTriageFooter title="Historial y observaciones" count={!actividadLoading && !actividadError ? actividad.length : undefined}
      onOpen={() => setHistorialAbierto(true)} />}>
    <div className="space-y-4">
      {reenviarRevision && devolucion && <section data-case-triage-return
        className="space-y-1.5 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2.5 text-amber-900">
        <h3 className="text-xs font-semibold">Observación de Calidad</h3>
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{devolucion.motivo}</p>
      </section>}
      {investigando ? <section data-case-triage-resolution className="space-y-3">
        <h3 className="text-sm font-semibold text-qms-dark">Estado de la resolución</h3>
        {resolutionDirty ? <Badge variant="amber">Cambios sin guardar</Badge>
          : borradorGuardado ? <Badge variant="green">Borrador guardado</Badge>
          : <Badge variant="neutral">{borradorVersion === null ? 'Comprobando borrador' : 'Sin borrador'}</Badge>}
        {borradorGuardado && <p className="text-xs text-qms-muted">Guardado: {caseDate(borradorGuardado.updated_at)}</p>}
        {(resolutionDirty || borradorGuardado) && <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-qms-muted">
          {resolucion || 'El borrador no contiene texto todavía.'}
        </p>}
        {errorBorrador && borradorVersion === null && <p role="alert" className="text-sm text-qms-danger">No se pudo cargar el borrador.
          <Button size="sm" variant="link" onClick={() => { void recargarBorrador() }}>Reintentar</Button>
        </p>}
      </section> : <CaseTriageExcerpt title={tieneDocumentoRegistrado ? 'Resultado registrado' : 'Resumen del expediente'}
        text={queja.resolucion || queja.descripcion || 'Sin información registrada.'} />}
      <CaseTriageExcerpt title="Antecedentes del cliente" text={queja.descripcion || 'Sin descripción registrada.'} />
      <CaseTriageAttachments files={adjuntosInvestigacion} onPreview={setPreviewAdjunto}
        loading={adjuntosLoading} error={!!adjuntosError} />
      <div className="space-y-2">
        <Button size="sm" variant="secondary" className="w-full" onClick={abrirVistaAnalisis}>Ver análisis completo</Button>
      </div>
    </div>
  </CaseTriageSummary>

  return <>
    <Modal open onClose={historialAbierto ? () => setHistorialAbierto(false) : analisisAbierto ? cerrarAnalisis : panelNotas ? cerrarNotas : panelAdjuntos ? cerrarAdjuntos : handleClose}
      onEscape={() => {
        if (historialAbierto) { setHistorialAbierto(false); return }
        if (analisisAbierto) { cerrarAnalisis(); return }
        if (panelNotas) { cerrarNotas(); return }
        if (panelAdjuntos) { cerrarAdjuntos(); return }
        if (isExpanded) {
          setResolutionOverlay(null)
          setStageView(currentStageFromStatus(estado))
          setEditorAbierto(false)
          setIsExpanded(false)
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-case-triage-expand]')?.focus({ preventScroll: true }))
          return
        }
        if (resolutionDirty || !!nota.trim()) {
          showError(null, 'Hay cambios sin guardar. Abrí el editor para guardarlos o descartarlos antes de salir.')
          return
        }
        const row = document.querySelector<HTMLElement>('.ui-case-row[aria-selected="true"]')
        handleClose()
        requestAnimationFrame(() => { if (row?.isConnected) row.focus({ preventScroll: true }) })
      }}
      title={`Folio ${queja.folio}`} variant="workspace" expanded={isExpanded}
      headerCenter={<div className="w-full min-w-0"><CaseProcessHeader queja={queja} steps={cicloProceso.steps} selectedStage={isExpanded ? etapaConsultada : null} onStageChange={isExpanded ? cambiarEtapa : undefined} disabled={navigationLocked} /></div>}
      headerActions={<CaseWorkspaceNavigation expanded={isExpanded} onToggleExpanded={() => { setResolutionOverlay(null); setStageView(currentStageFromStatus(estado)); setEditorAbierto(false); setIsExpanded(value => !value) }}
        onPrevious={onPrevious} onNext={onNext} disabled={navigationLocked} />}>
      <CaseWorkspace documentKey={queja.id + ':' + stageView} expanded={isExpanded} compactContent={compactTriage} cyclePlacement="header" presentation="reference" documentStyle="cards" readingLayout
        request={<CaseRequestHeader key={queja.id} queja={queja} variant={isExpanded ? 'panel' : 'details'} reference />}
        requestFooter={stageView === 'investigation' && editorAbierto ? <div className="space-y-4">
          <QuejaAdjuntosCard adjuntos={adjuntosInvestigacion} loading={adjuntosLoading} error={!!adjuntosError}
            onOpen={abrirAdjuntos} />
          <QuejaNotasCard notas={notasInvestigacion} loading={actividadLoading} error={!!actividadError} onOpen={abrirNotas} />
        </div> : null}
        compact={<CaseCycle queja={queja} process currentOnly steps={cicloProceso.steps} />} cycle={<CaseCycle queja={queja} process steps={cicloProceso.steps} selectedStage={isExpanded ? etapaConsultada : null} onStageChange={isExpanded ? cambiarEtapa : undefined} disabled={navigationLocked} />}
        action={<div className="space-y-4"><section className="min-w-0 rounded-card border border-qms-border bg-qms-surface p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck aria-hidden="true" className="size-4 text-qms-primary" />{stageView === etapaActual ? 'Etapa actual' : 'Consulta del expediente'}</h3>
          <Badge variant={queja.estado_color || varianteEstado('quejas', estado)}>{queja.estado_nombre || estado}</Badge>
          <CaseCompletionDate queja={queja} />
          <div className="mt-3" title={deadline.stageTitle}>{plazo}{plazosError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el calendario. Se conserva el vencimiento registrado.</p>}</div>
          {action && <p className="mt-3 text-xs leading-relaxed text-qms-muted">{action}</p>}
          <div className="mt-4 space-y-2">
            {stageView === 'analysis' && investigando && <Button size="sm" variant="primary" className="min-h-11 w-full min-w-0 justify-between whitespace-normal" onClick={prepararResolucion} disabled={resolutionPending}><span className="flex items-center gap-2"><FilePenLine aria-hidden="true" className="size-4 shrink-0" />Preparar resolución</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Button>}
            {stageView === 'investigation' && investigando && !editorAbierto && <Button size="sm" variant="primary" className="min-h-11 w-full min-w-0 justify-between whitespace-normal" onClick={prepararResolucion} disabled={resolutionPending}><span className="flex items-center gap-2"><FilePenLine aria-hidden="true" className="size-4 shrink-0" />Preparar resolución</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Button>}
            {stageView === 'investigation' && investigando && editorAbierto && <Button size="sm" className="w-full min-w-0 whitespace-normal" onClick={handleEnviarRevision} loading={loading} disabled={!resolucion.trim() || resolutionPending}>{reenviarRevision && loading ? null : <Send aria-hidden="true" className="size-4 shrink-0" />}{reenviarRevision ? 'Reenviar a Revisión GC' : 'Enviar a Revisión GC'}</Button>}
            {stageView !== 'investigation' && !investigando && <p className="text-sm leading-relaxed text-qms-muted">Esta vista es solo de consulta; no modifica el estado de la queja.</p>}
          </div>
          {errorResolucion && <div role="alert" className="rounded-card border border-qms-border bg-qms-surface p-3 text-sm text-qms-danger">{errorResolucion}</div>}
        </section><CaseSidebarShortcut title="Historial y observaciones" description={actividadLoading ? 'Consultando movimientos…' : actividadError ? 'No se pudo consultar el historial.' : actividad.length ? 'Consulta las decisiones, cambios y notas registrados por fecha.' : 'Sin movimientos registrados todavía.'}
          actionLabel="Ver historial" icon={<History className="size-4 shrink-0 text-qms-primary" />} count={!actividadLoading && !actividadError ? actividad.length : undefined} onClick={() => setHistorialAbierto(true)} />
        {reenviarRevision && <QuejaInvestigacionResumen devolucion={devoluciones[0] ?? devolucion} devoluciones={devoluciones} folio={queja.folio}
          archivos={adjuntos} onPreview={setPreviewAdjunto} onEditor={prepararResolucion}
          open={verMotivoDevolucion} onOpenChange={setVerMotivoDevolucion} />}</div>}>
        {stageView === 'analysis' ? <div data-case-stage-readonly data-case-stage="analysis" className="min-w-0 space-y-4">
          <section data-quality-review className="min-w-0 rounded-card border border-qms-warning/50 bg-soft-amber-bg p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-button border border-qms-warning/50 bg-soft-amber-bg text-sm font-semibold text-soft-amber-text">GC</span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-qms-dark">Procedencia de Calidad</h3>
                  <p className="mt-1 text-xs text-qms-muted">Evaluación registrada · Solo lectura</p>
                </div>
              </div>
              {investigando && <Button size="sm" variant="secondary" onClick={prepararResolucion} disabled={resolutionPending}>Ir a investigación</Button>}
            </div>
            {queja.justificacion_procede ? <RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} />
              : <p className="text-sm text-qms-muted">No hay justificación registrada de Calidad.</p>}
          </section>
          <CaseSection variant="panel" source="Cliente" title="Descripción de la queja"
            headerActions={<Button size="sm" variant="secondary" onClick={abrirAnalisis}><Eye aria-hidden="true" className="size-4" />Ver análisis completo</Button>}>
            <div className="mb-4"><AreaAfectada area={queja.area_afectada} /></div>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-qms-dark">{queja.descripcion || 'Sin descripción registrada.'}</p>
          </CaseSection>
          <CaseSection variant="panel" title={`Adjuntos del cliente (${adjuntosCliente.length})`}>
            {adjuntosLoading ? <p className="text-sm text-qms-muted">Consultando adjuntos…</p>
              : adjuntosError ? <p role="alert" className="text-sm text-qms-muted">No se pudieron cargar los archivos.<Button size="sm" variant="link" onClick={() => { void refetchAdjuntos() }}>Reintentar</Button></p>
              : adjuntosCliente.length ? <ListaAdjuntos adjuntos={adjuntosCliente} layout="rows" hideGroupTitle onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} />
              : <p className="text-sm text-qms-muted">El cliente no adjuntó archivos.</p>}
          </CaseSection>
          {devolucion && <CaseSection variant="panel" source="Gestión de Calidad" title="Observación de devolución">
            <p className="mb-2 text-xs text-qms-muted">{caseDate(devolucion.fecha)}</p>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{devolucion.motivo}</p>
          </CaseSection>}
          {analisisRegistrado && <CaseSection variant="panel" title="Análisis registrado">
            <RichTextContent value={analisisRegistrado.value} format={analisisRegistrado.format} />
          </CaseSection>}
        </div>
        : stageView === 'quality_review' ? <div data-case-stage-readonly data-case-stage="quality_review" className="min-w-0 space-y-4">
          <CaseSection variant="panel" title={<span className="flex flex-wrap items-center gap-2">Revisión de GC <span className="rounded-button bg-qms-neutral-soft px-2 py-0.5 text-xs font-medium text-qms-muted">Solo lectura</span></span>}>
            {estado === 'Pendiente de Revisión GC'
              ? <p className="text-base leading-relaxed text-qms-muted">Tu propuesta fue enviada a Gestión de Calidad. Está pendiente de revisión; por ahora no tenés acciones por realizar.</p>
              : ['Resuelto', 'Finalizado'].includes(estado)
                ? <p className="text-base leading-relaxed text-qms-dark">Gestión de Calidad aprobó tu resolución. Tu participación en esta queja ha concluido.</p>
                : devolucion
                  ? <div className="space-y-3">
                    <p className="text-base font-medium text-soft-amber-text">Calidad solicitó correcciones a la propuesta.</p>
                    <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{devolucion.motivo}</p>
                    <Button size="sm" variant="primary" onClick={() => cambiarEtapa('investigation')}>Volver a Investigación</Button>
                  </div>
                  : <p className="text-base leading-relaxed text-qms-muted">La revisión de GC comenzará después de que enviés tu propuesta.</p>}
          </CaseSection>
          {queja.resolucion && <CaseSection variant="panel" title={['Resuelto', 'Finalizado'].includes(estado) ? 'Propuesta aprobada' : 'Propuesta enviada'}>
            <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />
          </CaseSection>}
        </div>
        : stageView === 'investigation' && (!investigando || !editorAbierto) ? <div data-case-stage-overview data-case-stage="investigation" className="min-w-0 space-y-4">
          <CaseSection variant="panel" source="Responsable" title={<span className="flex flex-wrap items-center gap-2">Estado de la resolución <span className="rounded-button bg-qms-neutral-soft px-2 py-0.5 text-xs font-medium text-qms-muted">{investigando ? 'Etapa actual' : 'Solo lectura'}</span></span>} headerActions={investigando ? <Button size="sm" variant="secondary" onClick={prepararResolucion} disabled={resolutionPending}>Preparar resolución</Button> : undefined}>
            {borradorGuardado && investigando
              ? <><p className="mb-3 text-sm text-qms-muted">Borrador guardado el {caseDate(borradorGuardado.updated_at)}</p><RichTextContent value={resolucion} format={resolucionFormato} /></>
              : queja.resolucion ? <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />
              : <p className="text-sm leading-relaxed text-qms-muted">La resolución aún no está registrada. Podés consultar los antecedentes antes de prepararla.</p>}
          </CaseSection>
          {devolucion && <CaseSection variant="panel" source="Gestión de Calidad" title="Devolución pendiente">
            <p className="mb-2 text-xs text-qms-muted">{caseDate(devolucion.fecha)}</p>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{devolucion.motivo}</p>
          </CaseSection>}
          <section data-quality-review className="rounded-card border border-qms-warning/50 bg-soft-amber-bg p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-base font-semibold text-qms-dark">Procedencia de Calidad</h3>
            {queja.justificacion_procede ? <RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} />
              : <p className="text-sm text-qms-muted">No hay justificación registrada.</p>}
          </section>
          <CaseSection variant="panel" source="Cliente" title="Antecedentes de la queja">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{queja.descripcion || 'Sin descripción registrada.'}</p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={abrirVistaAnalisis}>Consultar análisis completo</Button>
          </CaseSection>
        </div>
        : investigando && editorAbierto ? <div data-resolution-shell className="relative h-[clamp(360px,calc(100dvh-110px),700px)] min-w-0">
          <div ref={resolutionContainer} data-resolution-inline data-resolution-expanded={resolutionOverlay ? 'true' : undefined}
            style={resolutionOverlay ?? undefined}
            className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface shadow-sm ${resolutionOverlay ? 'fixed z-[60] shadow-xl' : 'relative'}`}>
          {errorBorrador && borradorVersion === null && <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-qms-border px-5 py-2 text-sm text-qms-muted sm:px-8"><span>No se pudo cargar el borrador guardado.</span><Button size="sm" variant="ghost" loading={cargandoBorrador} onClick={() => { void recargarBorrador() }}>Reintentar borrador</Button></div>}
          {!editandoResolucion && <div data-resolution-saved-toolbar className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-qms-border bg-qms-surface px-4 py-2 sm:px-5">
            <span className="text-sm font-medium text-qms-muted">Borrador guardado</span>
            <Button data-resolution-edit size="sm" variant="secondary"
              title={borradorGuardado ? `Guardado el ${caseDate(borradorGuardado.updated_at)}` : 'Editar resolución'}
              disabled={resolutionPending} onClick={() => { setResolutionOverlay(null); setEditandoResolucion(true) }}>
              <Pencil aria-hidden="true" className="size-4 shrink-0" />Editar
            </Button>
          </div>}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col"><RichTextEditor id={`colaborador-resolucion-${queja.id}`} label="Resolución"
            placeholder="Documentá la conclusión y los hallazgos de tu investigación..."
            value={resolucion} format={resolucionFormato}
            onChange={(value, format) => { if (resolucionRevision === null) setResolucionRevision(queja.revision); draftVersions.current.resolucion++; setResolucion(value); setResolucionFormato(format) }}
            variant="document" layout="fill" minHeight={540} maxLength={DOCUMENT_LIMIT} required
            showFormattingHint={false} readOnly={!editandoResolucion} disabled={loading || guardandoResolucion || borradorVersion === null}
            toolbarActions={editandoResolucion ? <div data-resolution-toolbar-actions className="flex shrink-0 items-center gap-3">
              <Button size="sm" variant="secondary" data-resolution-assist
                className="shrink-0 border-qms-primary/25 bg-qms-primary-soft text-qms-primary hover:bg-qms-hover-bg"
                aria-label="Asistencia para la resolución" title="Generar análisis IA"
                onClick={() => {
                   const version = draftVersions.current.resolucion
                   return handleAnalisisAuto(result => {
                     if (version !== draftVersions.current.resolucion) return
                     const contenido = resolucion.trim() ? `${resolucion}\n\n${result}` : result
                     if (contenido.length > DOCUMENT_LIMIT) {
                       showError(null, 'El análisis supera el máximo de caracteres del editor.')
                       return
                     }
                     draftVersions.current.resolucion++
                     setResolucion(contenido)
                     setResolucionFormato('markdown')
                     if (resolucionRevision === null) setResolucionRevision(queja.revision)
                   })
                 }} loading={aiAutoLoading} loadingLabel="Analizando…"
                disabled={resolutionPending}>
                <WandSparkles aria-hidden="true" className="size-4" />Asistencia IA
              </Button>
              <span data-resolution-expand-separator aria-hidden="true" className="h-7 w-px shrink-0 bg-qms-border" />
              <Button size="icon" variant="secondary" data-resolution-expand
                aria-label={resolutionOverlay ? 'Contraer editor' : 'Expandir editor verticalmente'}
                aria-pressed={!!resolutionOverlay}
                title={resolutionOverlay ? 'Contraer editor' : 'Expandir editor verticalmente'}
                onClick={resolutionOverlay ? contraerResolucion : expandirResolucion}
                className="h-11 w-11 shrink-0 border-qms-border text-qms-primary hover:bg-qms-primary-soft">
                {resolutionOverlay ? <Minimize aria-hidden="true" className="size-5" /> : <Maximize aria-hidden="true" className="size-5" />}
              </Button>
            </div> : undefined}
            className="mis-quejas-resolution-editor [&_[data-rich-text-toolbar]]:bg-[#f2f7fd]" /></div>
          <div data-resolution-footer className="sticky bottom-0 z-20 flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-3 border-t border-qms-border bg-qms-surface px-5 py-3 sm:px-8">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-button bg-qms-primary-soft text-qms-primary"><FilePenLine className="size-4" /></span>
              <span className="text-sm font-semibold text-qms-dark">Resolución</span>
              <span aria-live="polite" className={`text-xs ${resolutionDirty ? 'text-qms-warning-text' : 'text-qms-muted'}`}>
                {guardandoResolucion ? 'Guardando…' : borradorVersion === null ? 'Cargando borrador…' : resolutionDirty ? 'Cambios sin guardar' : resolutionSaved ? 'Borrador guardado' : 'Sin cambios'}
              </span>
            </div>
            {editandoResolucion && <div className="flex min-w-0 items-center justify-end gap-2">
              <Button data-resolution-cancel size="sm" variant="secondary" onClick={handleCancelarEdicionResolucion} disabled={resolutionPending}>Cancelar</Button>
              <Button data-resolution-save size="sm" variant="primary"
                className="disabled:border-qms-primary! disabled:bg-qms-primary! disabled:text-white! disabled:opacity-100!"
                title={!resolutionDirty ? 'Sin cambios pendientes de guardar' : undefined}
                onClick={handleGuardarResolucion} loading={guardandoResolucion} loadingLabel="Guardando…" disabled={!resolutionDirty || resolutionPending}>
                <Save aria-hidden="true" className="size-4 shrink-0" />Guardar
              </Button>
            </div>}
          </div>
          </div>
        </div> : <CaseSection title={tieneDocumentoRegistrado ? documentoAprobado ? 'Resolución interna aprobada' : 'Propuesta enviada a Calidad' : 'Expediente'} source={tieneDocumentoRegistrado ? documentoAprobado ? 'Gestión de Calidad' : 'Responsable' : undefined} variant="panel"><div data-reading-copy>{queja.resolucion && <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />}
          {queja.numero_oficio_resolucion && <p className="mt-3 break-words text-sm text-qms-muted">N.º de oficio: {queja.numero_oficio_resolucion}</p>}</div>
        </CaseSection>}
      </CaseWorkspace>
      <QuejaAdjuntosInvestigacion open={panelAdjuntos} folio={queja.folio} onClose={cerrarAdjuntos}
        adjuntos={adjuntosInvestigacion} loading={adjuntosLoading} error={!!adjuntosError}
        onRetry={() => { void refetchAdjuntos() }} canUpload={investigando} uploadDisabled={resolutionPending}
        uploading={subiendoAdjuntoAnalisis} canDelete={adjunto => !resolutionPending && puedeEliminarAdjunto(adjunto)}
        onFiles={files => { void agregarAdjuntosAnalisis(files) }}
        onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        onDelete={adjunto => setConfirmarEliminacion(adjunto.id)} />
      <QuejaNotasPanel open={panelNotas} folio={queja.folio} currentUser={user ? { id: user.id } : undefined} onClose={cerrarNotas} notas={notasInvestigacion} loading={actividadLoading} error={!!actividadError} onRetry={() => { void refetchActividad() }} canEdit={canEdit} nota={nota} maxLength={DOCUMENT_LIMIT} saving={agregandoNota} onChange={value => { draftVersions.current.nota++; setNota(value) }} onAdd={handleAgregarNota}
        puedeModificar={puedeModificarNota} menuId={notaMenu} editingId={notaEditando?.id ?? null} editValue={notaEdicion} deletingId={notaEliminar} operating={operandoNota}
        onToggleMenu={alternarMenuNota} onEdit={iniciarEdicionNota} onEditChange={setNotaEdicion} onCancelEdit={cancelarEdicionNota}
        onSaveEdit={() => notaEditando ? handleMutarNota(notaEditando) : undefined} onRequestDelete={setNotaEliminar} onCancelDelete={() => setNotaEliminar(null)} onConfirmDelete={confirmarEliminarNota} />
      <Modal open={historialAbierto} onClose={() => setHistorialAbierto(false)} title="Historial y observaciones" titleSuffix={queja.folio} variant="document" size="mail" height="fill"
        footer={<div className="flex justify-end"><Button variant="secondary" onClick={() => setHistorialAbierto(false)}>Cerrar</Button></div>}>
        <div data-case-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
            <QuejaTimeline actividad={actividad} loading={actividadLoading} error={!!actividadError}
              onRetry={() => { void refetchActividad() }} resolveAuthor={event => event.usuario_id === user?.id ? user?.nombre : undefined} />
          </div>
        </div>
      </Modal>
      <QuejaAnalisisPanel queja={queja} open={analisisAbierto} onClose={cerrarAnalisis}
        onPrepararResolucion={investigando ? prepararResolucion : undefined} devolucion={devolucion}
        adjuntos={adjuntos} adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError} onRetryAdjuntos={() => { void refetchAdjuntos() }} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        actividad={actividad} actividadLoading={actividadLoading} actividadError={!!actividadError} onRetryActividad={() => { void refetchActividad() }}
        resolveAuthor={event => event.usuario_id === user?.id ? user?.nombre : undefined} />
    </Modal>
    <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    <ConfirmDialog open={confirmarEliminacion !== null} title="Eliminar adjunto" message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer." confirmLabel="Eliminar" danger loading={eliminandoAdjunto !== null} onConfirm={() => confirmarEliminacion && handleEliminarAdjunto(confirmarEliminacion)} onCancel={() => setConfirmarEliminacion(null)} />
  </>
}

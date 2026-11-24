'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, FilePenLine, Maximize, Minimize, Pencil, Save, Send, WandSparkles } from 'lucide-react'
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
import { useQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { esNotaInvestigacion, NOTA_APROBACION_GC, obtenerDevolucionPendiente, obtenerHistorialDevoluciones } from '@/lib/utils/quejaInvestigacionNotas'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { useQuejaPlazos } from '@/lib/queries/useQuejaSeguimiento'
import { enviarResolucionBorradorRevision, guardarResolucionBorrador } from '@/lib/services/quejaWorkflowService'
import { quejaResolucionDraftKey, useQuejaResolucionDraft, type QuejaResolucionDraft } from '@/lib/queries/useQuejaResolucionDraft'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaNotas } from '@/hooks/useQuejaNotas'
import { useQuejaAttachmentActions } from '@/hooks/useQuejaAttachmentActions'
import { useQuejaAssistant } from '@/app/mis-quejas/components/useQuejaAssistant'
import { CaseWorkspaceNavigation, CaseReadOnlyHeader, CaseSection, CaseWorkspace } from '@/app/quejas/components/QuejaExpedientePanels'
import QuejaCierreResumen from '@/app/quejas/components/QuejaCierreResumen'
import QuejaInvestigacionResumen from '@/app/mis-quejas/components/QuejaInvestigacionResumen'
import { CaseTriageSummary, CaseTriageNextStep, CaseTriageFooter } from '@/app/quejas/components/CaseTriageSummary'
import { useQuejaDevoluciones } from '@/lib/queries/useQuejaDevoluciones'
import { useQuejaInvestigationAssignment } from '@/lib/queries/useQuejaInvestigationAssignment'
import QuejaAnalisisPanel from '@/app/mis-quejas/components/QuejaAnalisisPanel'
import QuejaNotasPanel from '@/components/quejas/QuejaNotasPanel'
import QuejaAdjuntosInvestigacion, { QuejaAdjuntosCard } from '@/app/mis-quejas/components/QuejaAdjuntosInvestigacion'
import QuejaClienteDropdown from '@/components/quejas/QuejaClienteDropdown'
import { caseDate, caseDeadline, type CaseTriageNextStepData } from '@/app/quejas/components/quejaExpedienteModel'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { adjuntosMisQuejas, cicloMisQuejas, type EtapaMisQuejas } from './etapasResponsable'
import { MisQuejasBreadcrumb } from './MisQuejasEtapas'

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
  const draftVersions = useRef({ resolucion: 0 })
  const [vistaEtapa, setVistaEtapa] = useState<EtapaMisQuejas | null>(null)
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
  const [verMotivoDevolucion, setVerMotivoDevolucion] = useState(false)
  const [errorResolucion, setErrorResolucion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [editorVisitado, setEditorVisitado] = useState(false)
  const {
    previewAdjunto, setPreviewAdjunto, subiendoAdjunto: subiendoAdjuntoAnalisis,
    eliminandoAdjunto, confirmarEliminacion, setConfirmarEliminacion,
    handleSubirAdjuntos, handleEliminarAdjunto, handleDescargarAdjunto,
  } = useQuejaAttachmentActions(queja?.id ?? null, scope)
  const { aiAutoLoading, aiResult, setAiResult, handleAnalisisAuto } = useQuejaAssistant(queja?.id ?? null, scope)
  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: refetchActividad } = useQuejaActividad(quejaId)
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: refetchAdjuntos } = useQuejaAdjuntos(quejaId)
  const { data: runs = [], isPending: plazosPending, isFetching: plazosFetching, error: plazosError } = useQuejaPlazos(quejaId)
  const estado = queja?.estado ?? ''
  const investigando = estado === 'En Investigación' && !!user && queja?.responsable_id === user.id
    && ['admin', 'calidad', 'colaborador'].includes(user.rol)
  const posiblesAdjuntosPropios = !!user && adjuntos.some(a => a.usuario_id === user.id)
  const asignacion = useQuejaInvestigationAssignment(quejaId, true)
  const devolucionesQuery = useQuejaDevoluciones(quejaId, estado === 'En Investigación' || posiblesAdjuntosPropios)
  const devolucionesPersistidas = devolucionesQuery.data ?? []
  const devolucion = obtenerDevolucionPendiente(estado, actividad)
  const ciclo = cicloMisQuejas(estado, !!devolucion)
  const etapa = vistaEtapa && ciclo.etapas.some(paso => paso.id === vistaEtapa && paso.disponible) ? vistaEtapa : ciclo.actual
  const editable = investigando && etapa === 'resolucion'
  const notas = useQuejaNotas({ id: quejaId, usuario: user?.id, scope, puedeAgregar: editable, puedeEditar: editable })
  const { data: borradorRemoto, isFetching: cargandoBorrador, error: errorBorrador, refetch: recargarBorrador } = useQuejaResolucionDraft(quejaId, investigando)
  const resolutionDirty = borradorGuardado ? resolucion !== borradorGuardado.contenido || resolucionFormato !== borradorGuardado.formato : !!resolucion.trim()
  const resolutionSaved = !!borradorGuardado && !resolutionDirty
  const resolutionPending = loading || guardandoResolucion || investigando && borradorVersion === null || subiendoAdjuntoAnalisis || !!eliminandoAdjunto || aiAutoLoading
  const navigationLocked = panelNotas || panelAdjuntos || resolutionPending || notas.pending
    || investigando && (resolutionDirty || notas.dirty || !!aiResult.trim())
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
    setVistaEtapa(null)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setAiResult('')
    onNavigationLockChange?.(false)
    onClose()
  }, [scope, onClose, onNavigationLockChange, setAiResult])
  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  const [prevEstado, setPrevEstado] = useState(estado)
  if (prevEstado !== estado) {
    setPrevEstado(estado)
    setVistaEtapa(null)
    setVerMotivoDevolucion(false)
  }
  const [prevInvestigando, setPrevInvestigando] = useState(investigando)
  if (prevInvestigando !== investigando) {
    setPrevInvestigando(investigando)
    setResolutionOverlay(null)
    if (investigando) {
      setBorradorVersion(null); setBorradorGuardado(null)
      setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
      setEditandoResolucion(true)
    }
  }
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setEditorVisitado(false)
    setResolutionOverlay(null)
    setResolucion(''); setResolucionFormato('plain'); setResolucionRevision(null)
    setBorradorVersion(null); setBorradorGuardado(null); setGuardandoResolucion(false)
    setEditandoResolucion(true)
    setVistaEtapa(null)
    setPanelNotas(false)
    setPanelAdjuntos(false)
    setIsExpanded(false); setLoading(false)
  }
  if (!queja) return null
  if (isExpanded && editable && !editorVisitado) setEditorVisitado(true)
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
  const deadline = caseDeadline(queja, runs, Date.now(), plazosPending || plazosFetching)
  const devoluciones = devolucion ? (devolucionesPersistidas.length ? devolucionesPersistidas : obtenerHistorialDevoluciones(actividad)) : []
  const notasInvestigacion = actividad.filter(esNotaInvestigacion)
  const reenviarRevision = investigando && !!devolucion

  const handleGuardarResolucion = async () => {
    if (!editable || resolutionPending || borradorVersion === null || !resolutionDirty) return
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
  const handleEnviarRevision = async () => {
    if (resolutionPending || borradorVersion === null) return
    if (!editable) { showError(null, 'Esta solicitud no está disponible para enviar a revisión.'); return }
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
  const calidadIds = new Set(devolucionesPersistidas.flatMap(item => item.adjuntoIds))
  const oficioApertura = asignacion.data?.oficio_adjunto_id
  if (oficioApertura) calidadIds.add(oficioApertura)
  const inicioInvestigacion = runs.filter(run => run.stage_id === 'quejas.investigation').at(-1)?.started_at
    ?? asignacion.data?.updated_at
  const archivos = adjuntosMisQuejas(adjuntos, queja.responsable_id === user?.id ? user?.id : undefined, calidadIds, inicioInvestigacion)
  const archivosCargando = !!(adjuntosLoading || asignacion.isLoading || devolucionesQuery.isLoading)
  const archivosError = !!(adjuntosError || asignacion.error || devolucionesQuery.error)
  const recargarArchivos = () => {
    void refetchAdjuntos()
    if (asignacion.error) void asignacion.refetch()
    if (devolucionesQuery.error) void devolucionesQuery.refetch()
  }
  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto) => editable && !archivosCargando && !archivosError
    && archivos.propios.some(propio => propio.id === adjunto.id)
  const eliminarAdjuntoPropio = () => {
    const adjunto = archivos.propios.find(propio => propio.id === confirmarEliminacion)
    if (adjunto && puedeEliminarAdjunto(adjunto)) void handleEliminarAdjunto(adjunto.id)
  }
  const agregarAdjuntos = (files: File[]) => {
    if (editable && !resolutionPending) return handleSubirAdjuntos(files)
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
  const cambiarEtapa = (destino: EtapaMisQuejas) => {
    if (destino === etapa || !ciclo.etapas.some(paso => paso.id === destino && paso.disponible)) return
    setResolutionOverlay(null)
    setVistaEtapa(destino === ciclo.actual ? null : destino)
  }
  const abrirNotas = () => {
    capturarPuntoResolucion()
    setPanelAdjuntos(false)
    notas.closeMenu()
    setPanelNotas(true)
  }
  const cerrarNotas = () => {
    notas.closeMenu()
    setPanelNotas(false)
    restaurarPuntoResolucion()
  }
  const abrirAdjuntos = () => {
    capturarPuntoResolucion()
    setPanelNotas(false)
    setPanelAdjuntos(true)
  }
  const cerrarAdjuntos = () => {
    setPanelAdjuntos(false)
    restaurarPuntoResolucion()
  }
  const prepararResolucion = () => {
    if (!investigando || resolutionPending) return
    setResolutionOverlay(null)
    setIsExpanded(true)
    setEditandoResolucion(true)
    setVistaEtapa(null)
    // Primero presentar showModal y el editor existente; después restaurar foco.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Abrir el editor no debe desplazar el scroll exterior y ocultar su margen superior.
      const card = resolutionContainer.current
      const scrollports = card?.closest('[data-case-frame]')?.querySelectorAll<HTMLElement>('[data-case-scroll]')
      scrollports?.forEach(scrollport => { scrollport.scrollTop = 0 })
      card?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
    }))
  }
  const badgeEstado = ciclo.aprobada ? 'Aprobada por Calidad' : queja.estado_nombre || estado
  const variante = ciclo.aprobada ? 'green' : queja.estado_color || varianteEstado('quejas', estado)
  const aprobacion = ciclo.aprobada ? actividad.findLast(item => item.descripcion === NOTA_APROBACION_GC) : undefined
  const historica = etapa !== ciclo.actual
  const proximaEtapa = etapa === 'analisis' && ciclo.etapas[1].disponible ? 'resolucion'
    : etapa === 'resolucion' && !editable && ciclo.etapas[2].disponible ? 'revision'
    : etapa === 'revision' && historica ? 'resolucion' : null
  const irProximaEtapa = proximaEtapa && <Button size="sm" variant="primary"
    className="w-full min-w-0 whitespace-normal" onClick={() => cambiarEtapa(proximaEtapa)}>
    {proximaEtapa === 'revision' ? 'Ir a Revisión de Calidad' : etapa === 'revision' ? 'Volver a Resolución' : 'Ir a Resolución'}
    <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
  </Button>
  const analisis = <QuejaAnalisisPanel queja={queja} asignacion={asignacion.data} adjuntosCliente={archivos.cliente} adjuntosCalidad={archivos.antecedentes}
    adjuntosLoading={archivosCargando} adjuntosError={archivosError} onRetryAdjuntos={recargarArchivos}
    onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} />
  const cuerpoLectura = etapa === 'analisis' ? analisis : etapa === 'revision'
    ? <QuejaCierreResumen queja={queja} adjuntos={adjuntos} adjuntosLoading={archivosCargando} adjuntosError={archivosError}
        onRetryAdjuntos={recargarArchivos} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        actividad={actividad} actividadLoading={actividadLoading} actividadError={!!actividadError} responsable={user?.nombre}
        resolveAuthor={id => id === user?.id ? user?.nombre : undefined} expanded={isExpanded}
        revisionResponsable={{ estado: ciclo.aprobada ? 'Aprobada' : devolucion ? 'Devuelta' : 'Pendiente',
          fecha: ciclo.aprobada ? aprobacion?.created_at : devolucion?.fecha, motivo: devolucion?.motivo,
          propios: archivos.propios, antecedentes: archivos.antecedentes, analisis }} />
    : !editable && <CaseSection title="Propuesta de resolución" variant="document" source="Responsable">
          {queja.resolucion ? <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />
            : <p className="text-sm text-qms-muted">Sin propuesta registrada.</p>}
        </CaseSection>
  const lectura = cuerpoLectura && <div data-case-stage-readonly={historica ? true : undefined}
    className={isExpanded ? 'min-w-0 bg-qms-surface @min-[1100px]:mx-auto @min-[1100px]:w-full @min-[1100px]:max-w-[210mm] @min-[1100px]:min-h-[calc(100dvh-70px)] @min-[1100px]:border @min-[1100px]:border-qms-border @min-[1100px]:shadow-sm' : 'min-w-0 overflow-hidden rounded-card border border-qms-border bg-qms-surface'}>
    {historica && <CaseReadOnlyHeader etapa={ciclo.etapas.find(paso => paso.id === etapa)?.label ?? etapa} onReturn={() => cambiarEtapa(ciclo.actual)} />}
    {cuerpoLectura}
  </div>
  const cardAdjuntos = <QuejaAdjuntosCard adjuntos={archivos.propios} loading={archivosCargando}
    error={archivosError} onOpen={abrirAdjuntos} />
  const avisoDevolucion = editable && devolucion && <QuejaInvestigacionResumen devolucion={devoluciones[0] ?? devolucion}
    devoluciones={devoluciones} folio={queja.folio} archivos={archivos.antecedentes} onPreview={setPreviewAdjunto}
    onEditor={prepararResolucion} open={verMotivoDevolucion} onOpenChange={setVerMotivoDevolucion} />

  const triageStep: CaseTriageNextStepData = reenviarRevision ? {
    title: 'Corrección requerida',
    description: 'Calidad devolvió la propuesta para corregirla.',
    ctaLabel: 'Corregir en editor', icon: 'warning', tone: 'amber',
  } : resolutionDirty ? {
    title: 'Cambios sin guardar',
    description: 'Podés continuar con el borrador que estabas editando.',
    ctaLabel: 'Continuar editando', icon: 'edit', tone: 'amber',
  } : borradorGuardado ? {
    title: 'Borrador guardado',
    description: 'Guardado el ' + caseDate(borradorGuardado.updated_at),
    ctaLabel: 'Abrir editor para modificar', icon: 'saved', tone: 'blue',
  } : {
    title: 'Redactar resolución',
    description: 'Prepara la propuesta para Gestión de Calidad.',
    ctaLabel: 'Abrir editor para redactar', icon: 'edit', tone: 'blue',
  }
  const compactTriage = !isExpanded && <CaseTriageSummary key={etapa} queja={{ ...queja, estado_nombre: badgeEstado, estado_color: variante }}
    runs={runs} plazoError={!!plazosError} plazoLoading={plazosPending || plazosFetching} responsable={queja.responsable_id === user?.id ? user?.nombre : undefined}
    primaryAction={editable
      ? <CaseTriageNextStep step={triageStep} onOpen={prepararResolucion} disabled={resolutionPending} />
      : irProximaEtapa && <div className="ml-auto w-full sm:max-w-64">{irProximaEtapa}</div>}
    footer={<CaseTriageFooter title="Historial y notas" count={!actividadLoading && !actividadError ? notasInvestigacion.length : undefined}
      onOpen={abrirNotas} />}>
    {lectura}
    {etapa === 'resolucion' && cardAdjuntos}
    {avisoDevolucion}
    {editable && errorBorrador && borradorVersion === null && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-qms-danger">
      No se pudo cargar el borrador.<Button size="sm" variant="link" onClick={() => { void recargarBorrador() }}>Reintentar</Button>
    </div>}
  </CaseTriageSummary>
  const cicloMostrado = <MisQuejasBreadcrumb ciclo={ciclo} etapa={etapa} onChange={cambiarEtapa} compact />
  const cicloEncabezado = <MisQuejasBreadcrumb ciclo={ciclo} etapa={etapa} onChange={cambiarEtapa} />

  return <>
    <Modal open onClose={panelNotas ? cerrarNotas : panelAdjuntos ? cerrarAdjuntos : handleClose}
      onEscape={() => {
        if (panelNotas) { cerrarNotas(); return }
        if (panelAdjuntos) { cerrarAdjuntos(); return }
        if (isExpanded) {
          setResolutionOverlay(null)
          setIsExpanded(false)
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-case-triage-expand]')?.focus({ preventScroll: true }))
          return
        }
        if (investigando && (resolutionDirty || notas.dirty)) {
          showError(null, 'Hay cambios sin guardar. Abrí el editor para guardarlos o descartarlos antes de salir.')
          return
        }
        const row = document.querySelector<HTMLElement>('.ui-case-row[aria-selected="true"]')
        handleClose()
        requestAnimationFrame(() => { if (row?.isConnected) row.focus({ preventScroll: true }) })
      }}
      title={`Folio ${queja.folio}`} variant="workspace" expanded={isExpanded} headerTone="case-notion"
      headerSubtitle={<QuejaClienteDropdown key={queja.id} queja={queja} prominent notionStyle />}
      headerCenter={<div className={isExpanded ? 'mx-auto w-full max-w-3xl' : 'w-full'}><div className="hidden @min-[1100px]/workspace:block">{isExpanded ? cicloEncabezado : cicloMostrado}</div></div>}
      headerActions={<CaseWorkspaceNavigation expanded={isExpanded} onToggleExpanded={() => { setResolutionOverlay(null); setIsExpanded(value => !value) }}
        onPrevious={onPrevious} onNext={onNext} disabled={navigationLocked} />}>
      <CaseWorkspace documentKey={queja.id + ':' + etapa} expanded={isExpanded} compactContent={compactTriage || undefined}
        cyclePlacement="header" presentation="reference" documentStyle="sheet" readingLayout qualityTwoColumn qualitySideGutters preserveEditorWidth notionStyle
        requestFooter={isExpanded && <div className="space-y-2">
          {etapa === 'resolucion' && <button type="button" data-investigation-files-card aria-label="Ver mis adjuntos" onClick={abrirAdjuntos}
            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-qms-border bg-white px-3 text-left text-sm font-medium text-qms-dark transition-colors hover:border-qms-primary/50 hover:text-qms-primary">
            <span>Mis adjuntos <span className="ml-1 rounded bg-qms-hover-bg px-1.5 py-0.5 text-xs">{!archivosCargando && !archivosError ? archivos.propios.length : '—'}</span></span>
            <span className="text-xs text-qms-primary">Ver ›</span>
          </button>}
          <button type="button" data-investigation-notes-card onClick={abrirNotas}
            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-qms-border bg-white px-3 text-left text-sm font-medium text-qms-dark transition-colors hover:border-qms-primary/50 hover:text-qms-primary">
            <span>Historial y notas <span className="ml-1 rounded bg-qms-hover-bg px-1.5 py-0.5 text-xs">{!actividadLoading && !actividadError ? notasInvestigacion.length : '—'}</span></span>
            <span className="text-xs text-qms-primary">Ver ›</span>
          </button>
        </div>}
        compact={cicloMostrado} cycle={cicloMostrado}
        action={isExpanded && <div className="space-y-4"><section className="min-w-0">
          <p className="mb-3 text-xs font-semibold tracking-[0.06em] text-qms-muted">ACCIONES DEL RESPONSABLE</p>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck aria-hidden="true" className="size-4 text-qms-primary" />{historica ? 'Etapa actual' : 'Acción actual'}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={variante}>{badgeEstado}</Badge>
          </div>
          {ciclo.aprobada && aprobacion && <p className="mt-2 text-sm text-qms-muted">
            Revisión finalizada el <time dateTime={aprobacion.created_at}>{caseDate(aprobacion.created_at)}</time>
          </p>}
          {editable && <div className="mt-3" title={deadline.stageTitle}><QuejaPlazoIndicator deadline={deadline} />
            {plazosError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el calendario. Se conserva el vencimiento registrado.</p>}
          </div>}
          {(irProximaEtapa || editable) && <div className="mt-4 space-y-2">
            {irProximaEtapa}
            {editable && <Button size="sm" className="w-full min-w-0 whitespace-normal" onClick={handleEnviarRevision}
              loading={loading} disabled={!resolucion.trim() || resolutionPending}>
              {reenviarRevision && loading ? null : <Send aria-hidden="true" className="size-4 shrink-0" />}{reenviarRevision ? 'Reenviar a Revisión GC' : 'Enviar a Revisión GC'}
            </Button>}
          </div>}
          {editable && errorResolucion && <div data-case-resolution-error className="mt-3 min-w-0 border-t border-qms-border pt-2"><p role="alert" className="text-sm font-medium text-qms-danger">Incidencia en la resolución</p><details className="mt-1 min-w-0"><summary className="w-fit cursor-pointer text-xs font-medium text-qms-primary">Ver motivo</summary><p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-qms-muted [overflow-wrap:anywhere]">{errorResolucion}</p></details></div>}
        </section></div>}>
        <div data-mis-quejas-reading-column className={`mx-auto min-h-[calc(100dvh-70px)] w-full min-w-0 max-w-[960px] bg-qms-background px-4 pt-3 pb-5 sm:px-6 sm:pt-4 sm:pb-6 lg:px-8 ${isExpanded && !editable ? '@min-[1100px]:pt-6' : ''}`}>
        {isExpanded && lectura}
        {isExpanded && avisoDevolucion && <div className="mt-5">{avisoDevolucion}</div>}
        {investigando && editorVisitado && <div data-resolution-shell hidden={etapa !== 'resolucion'} className="relative h-[clamp(420px,calc(100dvh-95px),820px)] min-w-0">
          <div ref={resolutionContainer} data-resolution-inline data-resolution-expanded={resolutionOverlay ? 'true' : undefined}
            style={resolutionOverlay ?? undefined}
            className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-qms-border bg-white shadow-sm ${resolutionOverlay ? 'fixed z-[60] shadow-xl' : 'relative'}`}>
          {errorBorrador && borradorVersion === null && <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-qms-border px-5 py-2 text-sm text-qms-muted sm:px-8"><span>No se pudo cargar el borrador guardado.</span><Button size="sm" variant="ghost" loading={cargandoBorrador} onClick={() => { void recargarBorrador() }}>Reintentar borrador</Button></div>}
          {!editandoResolucion && <div data-resolution-saved-toolbar className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#D3DAE4] bg-[#EFF1F4] px-4 py-2 sm:px-5">
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
            className="mis-quejas-resolution-editor [&_[data-rich-text-toolbar]]:bg-[#EFF1F4]" /></div>
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
        </div>}
        </div>
      </CaseWorkspace>
      <QuejaAdjuntosInvestigacion open={panelAdjuntos} folio={queja.folio} onClose={cerrarAdjuntos}
        adjuntos={archivos.propios} loading={archivosCargando} error={archivosError}
        onRetry={recargarArchivos} canUpload={editable} uploadDisabled={resolutionPending}
        uploading={subiendoAdjuntoAnalisis} canDelete={adjunto => !resolutionPending && puedeEliminarAdjunto(adjunto)}
        onFiles={files => { void agregarAdjuntos(files) }}
        onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
        onDelete={adjunto => setConfirmarEliminacion(adjunto.id)} />
      <QuejaNotasPanel open={panelNotas} quejaId={queja.id} fechaIngreso={queja.fecha} folio={queja.folio} currentUser={user ? { id: user.id } : undefined} onClose={cerrarNotas}
        notas={notasInvestigacion} loading={actividadLoading} error={!!actividadError}
        onRetry={() => { void refetchActividad() }} {...notas.campos} />
    </Modal>
    <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    <ConfirmDialog open={confirmarEliminacion !== null} title="Eliminar adjunto" message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer." confirmLabel="Eliminar" danger loading={eliminandoAdjunto !== null} onConfirm={eliminarAdjuntoPropio} onCancel={() => setConfirmarEliminacion(null)} />
  </>
}

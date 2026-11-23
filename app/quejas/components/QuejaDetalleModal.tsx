'use client'

import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRespuestaCliente, respuestaClienteKey } from '@/lib/queries/useQuejaRespuestaCliente'
import { fetchQuejaInforme, quejaInformeKey } from '@/lib/queries/useQuejaInforme'
import Modal from '@/components/Modal'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import Tabs from '@/components/ui/Tabs'

import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextContent from '@/components/ui/RichTextContent'
import AreaQuejaControl from '@/app/quejas/components/AreaQuejaControl'
import QuejaPublicacionPanel from '@/app/quejas/components/QuejaPublicacionPanel'
import QuejaInformeModal from '@/app/quejas/components/QuejaInformeModal'
import QuejaRespuestaClienteModal from '@/app/quejas/components/QuejaRespuestaClienteModal'
import QuejaNotasPanel from '@/components/quejas/QuejaNotasPanel'
import QuejaAdjuntosInvestigacion, { QuejaAdjuntosCard } from '@/app/mis-quejas/components/QuejaAdjuntosInvestigacion'
import QuejaCierreResumen from '@/app/quejas/components/QuejaCierreResumen'
import QuejaInvestigacionAsignacion from '@/app/quejas/components/QuejaInvestigacionAsignacion'
import { CaseTriageSummary, CaseTriageNextStep, CaseTriageExcerpt, CaseTriageAttachments, CaseTriageFooter } from '@/app/quejas/components/CaseTriageSummary'
import type { Queja } from '@/lib/types'
import { errorMsg, showError, showSuccess } from '@/lib/services/errorToast'
import { useUsuarios, type Usuario } from '@/lib/queries/useUsuarios'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import {
  actualizarDetallesQueja,
  actualizarRegistroQueja,

  derivarQuejaASACP,
  subirAdjuntoQueja,
  transicionarQueja,
  iniciarInvestigacionQueja,
  esOficioPublicableQueja,
  resolverQuejaConDocumento,
  revisarResolucionQueja,
  reabrirQuejaFinalizada,
  type RegistroQuejaInput,
  type PublicacionQuejaInput,
} from '@/lib/services/quejaWorkflowService'
import { useAuthStore } from '@/lib/store/auth-store'
import { REGISTRO_QUEJA_LIMITES } from '@/lib/constants/quejas'
import { ArrowRight, Upload, RotateCcw, FileText, Paperclip, Eye, Info } from 'lucide-react'
import { useQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { useQuejaInvestigationAssignment } from '@/lib/queries/useQuejaInvestigationAssignment'
import { useQuejaPlazos, useQuejaCorreos, useReintentarQuejaCorreo } from '@/lib/queries/useQuejaSeguimiento'
import { usePublicacionQuejasDisponible } from '@/lib/queries/useQuejaPublicacion'
import { CASE_ACTIONS, caseDeadline, getCaseProcessCycle, getCaseTriageNextStep } from '@/app/quejas/components/quejaExpedienteModel'
import { CaseSection, CaseReadOnlyHeader, CaseCycle, CaseProcessHeader, CaseWorkspaceNavigation, CaseAction, CaseFinalMailStatus, CaseWorkspace } from '@/app/quejas/components/QuejaExpedientePanels'
import ResponsablePicker from '@/app/quejas/components/ResponsablePicker'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import QuejaClienteDropdown from '@/components/quejas/QuejaClienteDropdown'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaAttachmentActions } from '@/hooks/useQuejaAttachmentActions'
import { useQuejaNotas } from '@/hooks/useQuejaNotas'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import { puedeDerivarEnRevisionGC } from '@/lib/utils/quejaSacp'
import { esNotaInvestigacion } from '@/lib/utils/quejaInvestigacionNotas'


interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  onPrevious?: () => void
  onNext?: () => void
  onNavigationLockChange?: (locked: boolean) => void
}

export default function QuejaDetalleModal({ queja, onClose, onUpdated, onPrevious, onNext, onNavigationLockChange }: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [readOnlyStage, setReadOnlyStage] = useState<string | null>(null)
  const [activityOpen, setActivityOpen] = useState(false)
  const [misAdjuntosOpen, setMisAdjuntosOpen] = useState(false)
  const [informeOpen, setInformeOpen] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [subiendoSoporte, setSubiendoSoporte] = useState(false)
  const [motivoDevolucion, setMotivoDevolucion] = useState('')
  const [confirmarSACP, setConfirmarSACP] = useState(false)
  const [sacpCreadaEnVisita, setSacpCreadaEnVisita] = useState(false)
  const [adjuntosDevolucion, setAdjuntosDevolucion] = useState<QuejaAdjunto[]>([])
  const [errorAdjuntoDevolucion, setErrorAdjuntoDevolucion] = useState('')
  const inputDevolucionRef = useRef<HTMLInputElement>(null)
  const [respuestaCase, setRespuestaCase] = useState<Queja | null>(null)
  const [respuestaNoProcede, setRespuestaNoProcede] = useState(false)

  const [decisionProcedencia, setDecisionProcedencia] = useState<'procede' | 'no_procede' | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const [justificacionFormato, setJustificacionFormato] = useState<'plain' | 'markdown'>('plain')
  const [responsableSeleccionado, setResponsableSeleccionado] = useState<Usuario | null>(null)
  const [responsableError, setResponsableError] = useState(false)
  const [responsableOpenRequest, setResponsableOpenRequest] = useState(0)
  const [oficioApertura, setOficioApertura] = useState<QuejaAdjunto | null>(null)
  const [subiendoOficioApertura, setSubiendoOficioApertura] = useState(false)
  const [errorOficioApertura, setErrorOficioApertura] = useState('')
  const inputOficioAperturaRef = useRef<HTMLInputElement>(null)
  const [resolucionAbierta, setResolucionAbierta] = useState(false)
  const [resolucion, setResolucion] = useState('')
  const [resolucionFormato, setResolucionFormato] = useState<'plain' | 'markdown'>('plain')
  const [oficioWorkflow, setOficioWorkflow] = useState('')
  const [respuestaPublica, setRespuestaPublica] = useState('')
  const [oficioAdjuntoId, setOficioAdjuntoId] = useState('')
  const [documentTab, setDocumentTab] = useState<'interno' | 'cliente'>('interno')
  const [publicacionError, setPublicacionError] = useState<string | null>(null)
  const [workflowRevision, setWorkflowRevision] = useState<number | null>(null)
  const [registroDraft, setRegistroDraft] = useState<RegistroQuejaInput | null>(null)
  const [guardandoRegistro, setGuardandoRegistro] = useState(false)
  const [loading, setLoading] = useState(false)
  const [derivando, setDerivando] = useState(false)
  const [reaperturaAbierta, setReaperturaAbierta] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')
  const [reabriendo, setReabriendo] = useState(false)
  const draftVersions = useRef({ workflow: 0 })
  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: refetchActividad } = useQuejaActividad(quejaId, !!queja)
  const { data: runs = [], error: plazosError } = useQuejaPlazos(quejaId)
  const investigationActive = queja?.estado === 'En Investigación'
  const { data: asignacion, isLoading: asignacionLoading, error: asignacionError } = useQuejaInvestigationAssignment(quejaId, investigationActive)
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: refetchAdjuntos } = useQuejaAdjuntos(quejaId)
  const { data: usuarios = [], isLoading: usuariosLoading, error: usuariosError } = useUsuarios({ estado: 'activo' }, !!queja)
  const user = useAuthStore((s) => s.user)
  const accessIdentity = useAuthStore((s) => s.accessIdentity)
  const scope = useEntityRequestGuard(queja?.id ?? null)
  const {
    previewAdjunto, setPreviewAdjunto, subiendoAdjunto, eliminandoAdjunto,
    confirmarEliminacion, setConfirmarEliminacion,
    handleSubirAdjunto, handleSubirAdjuntos, handleEliminarAdjunto, handleDescargarAdjunto,
  } = useQuejaAttachmentActions(queja?.id ?? null, scope)

  const responsables = useMemo(
    () => (usuarios as Usuario[]).filter((u) => u.rol === 'admin' || u.rol === 'calidad' || u.rol === 'colaborador'),
    [usuarios],
  )
  const estadoActual = queja?.estado ?? ''
  const analysis = queja ? getQuejaAnalysis(queja) : null
  const esStaff = user?.rol === 'admin' || user?.rol === 'calidad'
  const notas = useQuejaNotas({ id: quejaId, usuario: user?.id, scope,
    puedeAgregar: esStaff && !readOnlyStage && !!queja && !['Finalizado', 'No Procede'].includes(estadoActual),
    puedeEditar: esStaff && !readOnlyStage && investigationActive,
  })
  const puedeEditarArea = esStaff && estadoActual === 'Recibido'
  const [prevPuedeEditarArea, setPrevPuedeEditarArea] = useState(puedeEditarArea)
  if (prevPuedeEditarArea !== puedeEditarArea) {
    setPrevPuedeEditarArea(puedeEditarArea)
    if (!puedeEditarArea) setRegistroDraft(null)
  }
  const publicacion = usePublicacionQuejasDisponible(esStaff && !!queja)
  useEffect(() => {
    if (!esStaff || !quejaId || !['Recibido', 'Pendiente de Revisión GC', 'Resuelto', 'No Procede'].includes(estadoActual)) return
    // Calentar ambos recursos al entrar al expediente, no al pulsar Responder.
    // El informe puede tardar; el editor no necesita esperar ese resultado.
    void queryClient.prefetchQuery({
      queryKey: respuestaClienteKey(quejaId),
      queryFn: ({ signal }) => fetchRespuestaCliente(quejaId, signal),
      staleTime: 30_000,
    })
    void queryClient.prefetchQuery({
      queryKey: quejaInformeKey(quejaId),
      queryFn: ({ signal }) => fetchQuejaInforme(quejaId, signal),
      staleTime: 30_000,
    })
  }, [quejaId, estadoActual, esStaff, queryClient])
  const finalizada = ['Finalizado', 'No Procede'].includes(estadoActual)
  const reintentarCorreo = useReintentarQuejaCorreo(quejaId, accessIdentity ?? undefined)
  const { data: correos = [], isLoading: correosLoading, error: correosError, refetch: refetchCorreos } = useQuejaCorreos(quejaId, esStaff && expanded,
    reintentarCorreo.isSuccess ? reintentarCorreo.variables : undefined)

  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    if (!queja || !prevQuejaId) setExpanded(false)

    setDecisionProcedencia(null)
    setReadOnlyStage(null)
    setActivityOpen(false)
    setMisAdjuntosOpen(false)
    setInformeOpen(false)
    setDecisionOpen(false)
    setReviewOpen(false)
    setSubiendoSoporte(false)
    setMotivoDevolucion('')
    setConfirmarSACP(false)
    setSacpCreadaEnVisita(false)
    setAdjuntosDevolucion([])
    setErrorAdjuntoDevolucion('')
    setRespuestaCase(null)
    setRespuestaNoProcede(false)
    setJustificacion('')
    setJustificacionFormato('plain')
    setResponsableSeleccionado(null)
    setResponsableError(false)
    setResponsableOpenRequest(0)
    setOficioApertura(null)
    setSubiendoOficioApertura(false)
    setErrorOficioApertura('')
    setResolucionAbierta(false)
    setResolucion('')
    setResolucionFormato('plain')
    setOficioWorkflow('')
    setRespuestaPublica('')
    setOficioAdjuntoId('')
    setDocumentTab('interno')
    setPublicacionError(null)
    setWorkflowRevision(null)
    setRegistroDraft(null)
    setGuardandoRegistro(false)
    setReaperturaAbierta(false)
    setMotivoReapertura('')
    setLoading(false)
    setDerivando(false)
    setReabriendo(false)
  }

  const navigationDisabled = informeOpen || !!respuestaCase || activityOpen || misAdjuntosOpen || notas.pending
    || notas.dirty && notas.campos.canEdit || subiendoOficioApertura || loading || reabriendo || derivando || guardandoRegistro || !!registroDraft || decisionOpen || resolucionAbierta || reviewOpen || subiendoSoporte || reaperturaAbierta || subiendoAdjunto || eliminandoAdjunto != null
  useEffect(() => {
    // La tabla permanece operativa, pero no puede descartar una edición/subida en curso.
    onNavigationLockChange?.(!!queja && navigationDisabled)
  }, [onNavigationLockChange, queja, navigationDisabled])

  if (!queja) return null

  const responsableActual = responsables.find((u) => u.id === queja.responsable_id)
  const investigationDeadline = caseDeadline(queja, runs)
  const investigationActionDetail = investigationDeadline.business && investigationDeadline.duration
    ? `El responsable tiene ${investigationDeadline.duration} días hábiles para recopilar evidencias y enviar su resolución. El caso pasará a «Revisión GC» cuando la envíe.`
    : 'El responsable dispone del plazo registrado en el expediente para recopilar evidencias y enviar su resolución. El caso pasará a «Revisión GC» cuando la envíe.'
  const responsableValue = responsableSeleccionado ? responsables.find(u => u.id === responsableSeleccionado.id) ?? null : responsableActual ?? null
  const workflowQueja = { ...queja, revision: workflowRevision ?? queja.revision }
  const workflowPending = loading || reabriendo || derivando || guardandoRegistro || subiendoAdjunto || subiendoSoporte || subiendoOficioApertura || eliminandoAdjunto != null
  const publicacionDisponible = publicacion.data === true
  const publicacionVerificada = !publicacion.isLoading && !publicacion.error && typeof publicacion.data === 'boolean'
  const oficiosPublicables = adjuntos.filter(adjunto => esOficioPublicableQueja(adjunto, queja.id))

  const resetPublicacion = () => {
    setRespuestaPublica(''); setOficioAdjuntoId(''); setPublicacionError(null); setDocumentTab('interno')
  }

  const prepararPublicacion = (estado: PublicacionQuejaInput['estado'], value?: string | null,
    format?: 'plain' | 'markdown'): PublicacionQuejaInput | 'legacy' | null => {
    if (!esStaff) { showError(null, 'La comunicación final debe aprobarla Gestión de Calidad.'); return null }
    if (!publicacionVerificada) { showError(null, 'Comprobá la publicación de la respuesta antes de guardar.'); return null }
    // Solo false confirmado conserva el contrato anterior. Un error de red nunca
    // convierte la publicación obligatoria en una transición legacy.
    if (!publicacionDisponible) return 'legacy'
    const archivo = oficiosPublicables.find(adjunto => adjunto.id === oficioAdjuntoId) ?? null
    const error = !respuestaPublica.trim() || respuestaPublica.trim().length > 10000
      ? 'Escribí la respuesta al cliente, de hasta 10.000 caracteres.'
      : !oficioWorkflow.trim() ? 'Registrá el número del oficio emitido por ECA.'
        : !archivo ? 'Seleccioná o adjuntá el oficio definitivo de este expediente.' : null
    if (error) { setPublicacionError(error); setDocumentTab('cliente'); showError(null, error); return null }
    return { estado, respuestaPublica, numeroOficio: oficioWorkflow, adjunto: archivo, resolucion: value, resolucionFormato: format }
  }

  const beginWorkflowDraft = () => {
    draftVersions.current.workflow++
    // Reabrir un editor conserva la revisión del borrador que aún no se guardó.
    if (workflowRevision !== null) return
    setWorkflowRevision(queja.revision)
    setOficioWorkflow(queja.numero_oficio_resolucion ?? '')
  }

  const handleClose = () => {
    if (informeOpen || respuestaCase) return
    setExpanded(false)
    scope.invalidate()
    onClose()
  }

  // El servicio recibe la revisión capturada; ningún fallo autoriza buscar otra para reintentar.
  const runCaseUpdate = async (
    write: () => Promise<Queja>,
    successMessage: string,
    errorMessage: string,
    onCurrentDraft?: (updated: Queja) => void,
    setPending = setLoading,
  ) => {
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.workflow
    setPending(true)
    let confirmed = false
    try {
      const updated = await write()
      confirmed = true
      if (isContextCurrent()) onUpdated(updated, operation.isCurrent)
      if (operation.isCurrent()) {
        showSuccess(successMessage)
        if (draftVersions.current.workflow === draftVersion) {
          onCurrentDraft?.(updated)
          setWorkflowRevision(null)
        }
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, confirmed
        ? 'La solicitud se guardó, pero no se pudo actualizar la vista'
        : errorMessage)
    } finally {
      if (operation.isCurrent()) setPending(false)
      operation.finish()
    }
  }

  const handleGuardarNoProcede = async () => {
    if (workflowPending) return
    if (!justificacion.trim()) {
      showError(null, 'La justificación / resolución es obligatoria para marcar como No Procede')
      return
    }
    // El documento interno (justificación) ya ES la respuesta al cliente al declarar
    // No Procede: se comparte la fuente, sin redactar un texto paralelo en el panel.
    if (!respuestaPublica.trim()) setRespuestaPublica(justificacion)
    const publication = prepararPublicacion('No Procede', justificacion, justificacionFormato)
    if (!publication) return
    if (!oficioWorkflow.trim()) { showError(null, 'Registrá el número del oficio explicativo antes de marcar como No Procede'); return }
    await runCaseUpdate(
      () => publication === 'legacy'
        ? transicionarQueja(workflowQueja, 'No Procede', { resolucion: justificacion, resolucionFormato: justificacionFormato, numeroOficio: oficioWorkflow })
        : resolverQuejaConDocumento(workflowQueja, publication),
      'Solicitud marcada como No Procede', 'No se pudo marcar la solicitud como No Procede',
      () => { setDecisionOpen(false); setDecisionProcedencia(null); setJustificacion(''); resetPublicacion() },
    )
  }

  const handleGuardarProcede = async () => {
    if (workflowPending) return
    const responsable = responsableValue
    if (!responsable) {
      setResponsableError(true)
      setResponsableOpenRequest(request => request + 1)
      showError(null, 'Debés asignar un responsable antes de guardar.')
      return
    }
    if (!justificacion.trim()) {
      showError(null, 'La justificación es obligatoria para iniciar la investigación')
      return
    }
    if (errorOficioApertura) {
      showError(null, 'Revisá el error del oficio de apertura o continuá sin ese archivo.')
      return
    }
    await runCaseUpdate(
      () => iniciarInvestigacionQueja(workflowQueja, {
        justificacion, formato: justificacionFormato, responsableId: responsable.id,
        oficioAdjuntoId: oficioApertura?.id,
      }),
      'Queja asignada a investigación.', 'No se pudo iniciar la investigación',
      () => {
        setDecisionOpen(false); setDecisionProcedencia(null); setJustificacion('')
        setResponsableSeleccionado(null)
        setOficioApertura(null); setErrorOficioApertura('')
      },
    )
  }

  const subirOficioApertura = async (file: File) => {
    if (!decisionOpen || decisionProcedencia !== 'procede' || workflowPending) return
    const operation = scope.start('investigation-office-upload')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setSubiendoOficioApertura(true)
    setErrorOficioApertura('')
    try {
      const adjunto = await subirAdjuntoQueja(queja.id, file)
      if (isContextCurrent()) void refetchAdjuntos()
      if (operation.isCurrent()) {
        draftVersions.current.workflow++
        setOficioApertura(adjunto)
      }
    } catch (error) {
      if (operation.isCurrent()) {
        setErrorOficioApertura(errorMsg(error, 'No se pudo adjuntar el documento.'))
        showError(error, 'No se pudo adjuntar el documento.')
      }
    } finally {
      if (operation.isCurrent()) setSubiendoOficioApertura(false)
      operation.finish()
    }
  }

  const handleConfirmarResolucion = async () => {
    if (workflowPending) return
    if (!resolucion.trim()) {
      showError(null, 'Escribí el análisis / resolución final antes de resolver la solicitud')
      return
    }
    // La resolución interna ES la respuesta al cliente al publicarla: se comparte la
    // fuente desde el editor, sin redactar un texto paralelo en el panel de publicación.
    if (!respuestaPublica.trim()) setRespuestaPublica(resolucion)
    const publication = prepararPublicacion('Resuelto', resolucion, resolucionFormato)
    if (!publication) return
    if (!oficioWorkflow.trim()) { showError(null, 'Registrá el número del oficio de resolución antes de resolver'); return }
    await runCaseUpdate(
      () => publication === 'legacy'
        ? transicionarQueja(workflowQueja, 'Resuelto', { resolucion, resolucionFormato, numeroOficio: oficioWorkflow })
        : resolverQuejaConDocumento(workflowQueja, publication),
      'Solicitud resuelta', 'No se pudo resolver la solicitud',
      () => { setResolucionAbierta(false); setResolucion(''); resetPublicacion() },
    )
  }

  const handleSeleccionarResponsable = async (usuario: Usuario | null) => {
    draftVersions.current.workflow++
    setResponsableError(false)
    setResponsableOpenRequest(0)
    setResponsableSeleccionado(usuario)
    if (!usuario || estadoActual === 'Recibido' || usuario.id === queja.responsable_id) return
    await runCaseUpdate(
      () => actualizarDetallesQueja({ quejaId: queja.id, revision: queja.revision, responsableId: usuario.id }),
      'Responsable asignado', 'No se pudo asignar el responsable',
    )
  }

  const handleReabrir = async () => {
    if (workflowPending || estadoActual !== 'Finalizado' || !esStaff) return
    if (!motivoReapertura.trim()) {
      showError(null, 'Escribí el motivo antes de reabrir el expediente')
      return
    }
    await runCaseUpdate(
      () => reabrirQuejaFinalizada(workflowQueja, motivoReapertura),
      'Expediente reabierto. Nuevo plazo: 15 días hábiles.', 'No se pudo reabrir el expediente',
      () => { setReaperturaAbierta(false); setMotivoReapertura('') }, setReabriendo,
    )
  }

  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto): boolean => {
    if (adjunto.usuario_id === null) return user?.rol === 'admin'
    return user?.rol === 'admin' || user?.rol === 'calidad' || queja.responsable_id === user?.id
  }

  const handleAprobarResolucion = () => {
    if (workflowPending) return
    beginWorkflowDraft()
    return runCaseUpdate(
      () => revisarResolucionQueja(workflowQueja, 'approved'),
      'Resolución aprobada. Prepará la respuesta al cliente.', 'No se pudo aprobar la resolución',
      () => { setReviewOpen(false); setReadOnlyStage(null); setRespuestaCase(null) },
    )
  }

  const handleEditarRegistro = () => {
    if (!puedeEditarArea) return
    draftVersions.current.workflow++
    // El RPC actualiza los tres campos juntos: editar el área conserva oficio y
    // observaciones históricas desde el mismo snapshot y su revisión esperada.
    setRegistroDraft({ quejaId: queja.id, revision: queja.revision, area: queja.area_afectada ?? '', numeroOficio: queja.numero_oficio_resolucion ?? '', observaciones: queja.observaciones ?? '' })
  }
  const handleGuardarRegistro = (nextDraft?: RegistroQuejaInput) => {
    if (!registroDraft || !puedeEditarArea) return
    const captured = { ...registroDraft, area: nextDraft?.area ?? registroDraft.area }
    return runCaseUpdate(() => actualizarRegistroQueja(captured), 'Área afectada guardada', 'No se pudo guardar el área afectada', () => setRegistroDraft(null), setGuardandoRegistro)
  }

  const subirSoporteDevolucion = async (file: File) => {
    const operation = scope.start('quality-return-upload')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setSubiendoSoporte(true)
    setErrorAdjuntoDevolucion('')
    try {
      const adjunto = await subirAdjuntoQueja(queja.id, file)
      if (isContextCurrent()) void refetchAdjuntos()
      if (operation.isCurrent()) {
        setAdjuntosDevolucion(current => current.some(item => item.id === adjunto.id) ? current : [...current, adjunto])
      }
    } catch (error) {
      if (operation.isCurrent()) {
        setErrorAdjuntoDevolucion(errorMsg(error, 'No se pudo subir el soporte.'))
        showError(error, 'No se pudo subir el soporte.')
      }
    } finally {
      if (operation.isCurrent()) setSubiendoSoporte(false)
      operation.finish()
    }
  }

  const handleDevolverInvestigacion = () => {
    if (!motivoDevolucion.trim()) { showError(null, 'Escribí el motivo de devolución.'); return }
    return runCaseUpdate(() => revisarResolucionQueja(workflowQueja, 'returned', motivoDevolucion, adjuntosDevolucion.map(file => file.id)),
      'Solicitud devuelta a investigación', 'No se pudo devolver la solicitud',
      () => { setReviewOpen(false); setMotivoDevolucion(''); setAdjuntosDevolucion([]); setErrorAdjuntoDevolucion(''); void refetchActividad() })
  }

  const handleDerivarSACP = async () => {
    if (!puedeDerivarEnRevisionGC(queja.estado, queja.derivado_sacp_id, queja.resolucion) || !esStaff || workflowPending || editing) return
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setDerivando(true)
    let confirmed = false
    try {
      const { accion, queja: actualizada } = await derivarQuejaASACP(queja.id)
      confirmed = true
      if (isContextCurrent()) onUpdated(actualizada ?? undefined, operation.isCurrent)
      if (operation.isCurrent()) {
        setConfirmarSACP(false)
        setSacpCreadaEnVisita(true)
        setWorkflowRevision(null)
        showSuccess('Acción SACP ' + (accion.folio || 'registrada') + ' vinculada al expediente.')
        if (!actualizada) {
          showError(null, 'La acción se creó, pero no se pudo actualizar la revisión del expediente. Reabrí el expediente antes de continuar.')
          onClose()
        }
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, confirmed
        ? 'La derivación se guardó, pero no se pudo actualizar la vista'
        : 'No se pudo derivar a SACP')
    } finally {
      if (operation.isCurrent()) setDerivando(false)
      operation.finish()
    }
  }

  const action = CASE_ACTIONS[estadoActual]
  // El responsable propone desde Mis Quejas; la comunicación final exige Calidad.
  const canAct = esStaff
  const editing = !!respuestaCase || !!registroDraft || decisionOpen || resolucionAbierta || reviewOpen || reaperturaAbierta
  const openEvaluationDecision = (choice: 'procede' | 'no_procede') => {
    if (estadoActual !== 'Recibido' || readOnlyStage || !canAct || workflowPending || editing || registroDraft) return
    if (choice === 'no_procede' && !publicacionVerificada) return
    beginWorkflowDraft()
    setResponsableError(false)
    setResponsableOpenRequest(0)
    draftVersions.current.workflow++
    // No Procede con publicación habilitada conserva el editor oficial de respuesta existente.
    if (choice === 'no_procede' && publicacionDisponible) {
      setRespuestaNoProcede(true)
      setRespuestaCase(workflowQueja)
      setDecisionOpen(false)
      return
    }
    setDecisionProcedencia(choice)
    setDecisionOpen(true)
  }
  const openAction = () => {
    if (!canAct || workflowPending || registroDraft) return
    if (estadoActual === 'Resuelto') { setRespuestaCase(queja); return }
    beginWorkflowDraft()
    if (estadoActual === 'Recibido') { setResponsableError(false); setResponsableOpenRequest(0); setDecisionOpen(true) }
    if (estadoActual === 'En Investigación') setResolucionAbierta(true)
  }
  const closeEditor = () => {
    if (workflowPending) return
    draftVersions.current.workflow++
    setDecisionOpen(false); setResolucionAbierta(false); setReviewOpen(false); setReaperturaAbierta(false)
    // Cerrar conserva el borrador; solo un guardado confirmado lo limpia.
  }
  const volverAElegirDecision = () => {
    if (workflowPending) return
    draftVersions.current.workflow++
    setResponsableError(false)
    setResponsableOpenRequest(0)
    setDocumentTab('interno')
    // Cancelar vuelve a la elección sin cerrar el documento ni perder el borrador.
    setDecisionProcedencia(null)
  }
  const adjuntosCliente = adjuntos.filter(archivo => !archivo.usuario_id)
  const archivosVisibles = estadoActual === 'Recibido' ? adjuntosCliente : adjuntos
  const misAdjuntos = adjuntos.filter(file => !!user && file.usuario_id === user.id)
  const administrarAdjuntos = esStaff && !readOnlyStage && estadoActual === 'Recibido'
  const cardMisAdjuntos = administrarAdjuntos && <QuejaAdjuntosCard adjuntos={misAdjuntos} loading={adjuntosLoading}
    error={!!adjuntosError} onOpen={() => setMisAdjuntosOpen(true)} />
  const notasManuales = actividad.filter(esNotaInvestigacion)
  const cerrarActividad = () => { notas.closeMenu(); setActivityOpen(false) }
  const soloLecturaFiles = (items: QuejaAdjunto[]) => adjuntosLoading
    ? <LoadingSkeleton variant="list" label="Cargando adjuntos…" framed={false} />
    : adjuntosError ? <p role="alert" className="text-sm text-qms-muted">No se pudieron cargar los archivos.</p>
    : items.length ? <ListaAdjuntos layout="cards" adjuntos={items} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} />
    : <p className="text-sm text-qms-muted">Sin archivos registrados.</p>
  const files = <div className="space-y-3">
    {adjuntosLoading ? <LoadingSkeleton variant="list" label="Cargando evidencias…" framed={false} /> : adjuntosError ? <p role="alert" className="text-sm text-qms-danger">No se pudieron cargar las evidencias. <Button size="sm" variant="link" onClick={() => refetchAdjuntos()}>Reintentar</Button></p> : !archivosVisibles.length ? <p className="text-sm text-qms-muted">Sin archivos adjuntos.</p> : <ListaAdjuntos layout="cards" adjuntos={archivosVisibles} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} puedeEliminar={puedeEliminarAdjunto} onEliminar={a => setConfirmarEliminacion(a.id)} />}
    {!readOnlyStage && (estadoActual === 'En Investigación' || esStaff && publicacionDisponible && ['Pendiente de Revisión GC', 'Resuelto'].includes(estadoActual)) && <div className="flex flex-wrap items-center gap-2"><label className="ui-button ui-button-secondary ui-button-sm cursor-pointer"><Upload className="size-4" /> Subir archivo<input type="file" className="sr-only" disabled={workflowPending || editing} aria-label="Subir evidencia" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleSubirAdjunto(file) }} /></label>{subiendoAdjunto && <span role="status" className="text-sm text-qms-muted">Subiendo…</span>}</div>}
  </div>
  const editorOpen = decisionOpen || resolucionAbierta || reviewOpen || reaperturaAbierta
  const qualityReview = estadoActual === 'Pendiente de Revisión GC'
  const puedeDerivarSACP = esStaff && !sacpCreadaEnVisita && puedeDerivarEnRevisionGC(estadoActual, queja.derivado_sacp_id, queja.resolucion)
  const areaControl = <AreaQuejaControl quejaId={queja.id} area={queja.area_afectada ?? ''} draft={puedeEditarArea ? registroDraft : null} onEdit={puedeEditarArea ? handleEditarRegistro : undefined} onSave={handleGuardarRegistro} onCancel={() => { draftVersions.current.workflow++; setRegistroDraft(null) }} saving={guardandoRegistro} disabled={workflowPending && !guardandoRegistro || editorOpen} />
  const requestDocument = <section data-case-client-document className="min-w-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
    <div className="mx-auto w-full max-w-[72ch]">
      <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-qms-dark sm:text-[30px]">Descripción del cliente</h2>
      <div data-case-reading-copy className="mt-6"><p data-case-reading-text className="whitespace-pre-wrap break-words text-base leading-relaxed">{queja.descripcion || 'Sin descripción registrada.'}</p></div>
      <div className="mt-7 border-t border-qms-border pt-4">
        <h3 className="mb-3 text-[17px] font-semibold text-qms-primary">Adjuntos del cliente · {adjuntosCliente.length}</h3>
        {estadoActual === 'Recibido' ? files : soloLecturaFiles(adjuntosCliente)}
      </div>
    </div>
  </section>
  const investigationDocument = (queja.resolucion || analysis || queja.numero_oficio_resolucion) && <CaseSection variant="document" source={['Resuelto', 'Finalizado', 'No Procede'].includes(estadoActual) ? 'Gestión de Calidad' : 'Responsable'} title={estadoActual === 'Pendiente de Revisión GC' ? 'Propuesta del responsable' : 'Documento interno de investigación'}><div data-case-reading-copy>{analysis && <div className="mb-5"><h4 className="mb-2 text-sm font-medium text-qms-muted">Análisis</h4><div data-case-reading-text><RichTextContent value={analysis.value} format={analysis.format} /></div></div>}{queja.resolucion && <div><h4 className="mb-2 text-sm font-medium text-qms-muted">Resolución</h4><div data-case-reading-text><RichTextContent value={queja.resolucion} format={queja.resolucion_formato} /></div></div>}{queja.numero_oficio_resolucion && <dl className="mt-4 border-t border-qms-border pt-3 text-sm"><dt className="text-qms-muted">{estadoActual === 'No Procede' ? 'N.º de oficio explicativo' : 'N.º de oficio de resolución'}</dt><dd className="mt-1 break-words">{queja.numero_oficio_resolucion}</dd></dl>}</div></CaseSection>
  const workflowTitle = decisionOpen ? 'Decisión de procedencia' : resolucionAbierta ? 'Resolución de Calidad' : reviewOpen ? 'Devolver a investigación' : 'Reabrir expediente'
  const terminalDocument = decisionOpen && decisionProcedencia === 'no_procede' || resolucionAbierta
  const clienteTab = terminalDocument && publicacionDisponible && documentTab === 'cliente'
  const publicationPanel = <QuejaPublicacionPanel id={queja.id} respuesta={respuestaPublica}
    onRespuestaChange={value => { draftVersions.current.workflow++; setRespuestaPublica(value); setPublicacionError(null) }}
    oficio={oficioWorkflow} onOficioChange={value => { draftVersions.current.workflow++; setOficioWorkflow(value); setPublicacionError(null) }}
    adjuntos={oficiosPublicables} adjuntoId={oficioAdjuntoId} onAdjuntoChange={value => { draftVersions.current.workflow++; setOficioAdjuntoId(value); setPublicacionError(null) }}
    archivosLoading={adjuntosLoading} archivosError={!!adjuntosError} onReintentar={() => { void refetchAdjuntos() }}
    onSubir={file => { if (esStaff && !workflowPending) void handleSubirAdjunto(file) }}
    subiendo={subiendoAdjunto} disabled={workflowPending} error={publicacionError} />

  // Los estados y el vencimiento pertenecen al panel de acciones, no al encabezado
  // del flujo. El panel lateral conserva sus detalles en todas las etapas.
  // Mantener un alto mínimo común y dejar que los botones crezcan si el texto envuelve.
  const reviewButtonClass = 'min-h-12 w-full min-w-0 max-w-full whitespace-normal px-2 text-center text-sm leading-snug'
  const workflowActions = !readOnlyStage && canAct && estadoActual !== 'En Investigación' && action?.action && (qualityReview ? <>
    <Button size="sm" className={reviewButtonClass} onClick={handleAprobarResolucion} loading={loading} disabled={workflowPending || editing}>Aprobar y continuar</Button>
    <Button size="sm" variant="secondary" className={reviewButtonClass} onClick={() => { beginWorkflowDraft(); setAdjuntosDevolucion([]); setErrorAdjuntoDevolucion(''); setReviewOpen(true) }} disabled={workflowPending || editing}>Devolver a investigación</Button>
    {puedeDerivarSACP && <Button size="sm" variant="secondary" className={reviewButtonClass} onClick={() => setConfirmarSACP(true)} disabled={workflowPending || editing}>Derivar a SACP</Button>}
  </> : estadoActual === 'Recibido' ? <div data-case-evaluation-choices className="flex min-w-0 flex-col gap-2">
    <button type="button" onClick={() => openEvaluationDecision('procede')}
      disabled={workflowPending || editing}
      className="group flex h-12 w-full min-w-0 items-center gap-2.5 rounded-lg border border-qms-border bg-white px-3.5 text-left text-sm font-semibold text-qms-dark transition-colors hover:border-qms-primary hover:bg-qms-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed disabled:opacity-50">
      <span className="min-w-0 flex-1">Procede</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-qms-muted transition-colors group-hover:text-qms-primary" />
    </button>
    <button type="button" onClick={() => openEvaluationDecision('no_procede')}
      disabled={workflowPending || editing || !publicacionVerificada}
      className="group flex h-12 w-full min-w-0 items-center gap-2.5 rounded-lg border border-qms-border bg-white px-3.5 text-left text-sm font-semibold text-qms-dark transition-colors hover:border-qms-primary hover:bg-qms-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed disabled:opacity-50">
      <span className="min-w-0 flex-1">No procede</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-qms-muted transition-colors group-hover:text-qms-primary" />
    </button>
  </div> : <Button size="sm" className="min-h-10 w-full min-w-0" onClick={openAction} loading={loading} disabled={workflowPending || editing}>{action.action}</Button>)

  const processSteps = getCaseProcessCycle(queja).steps
  const currentProcessStage = processSteps.find(step => step.current)?.id
    ?? (['Resuelto', 'Finalizado', 'No Procede'].includes(estadoActual) ? 'finished' : null)
  const historicalTitle = processSteps.find(step => step.id === readOnlyStage)?.label ?? 'Etapa seleccionada'
  const toggleProcessStage = (stage: string) => {
    if (navigationDisabled) return
    setReadOnlyStage(current => current === stage || stage === currentProcessStage ? null : stage)
  }
  const readOnlyDocument = readOnlyStage && <div data-case-stage-readonly className="min-w-0">
    <CaseReadOnlyHeader etapa={historicalTitle} onReturn={() => setReadOnlyStage(null)} />
    {readOnlyStage === 'evaluation' && <CaseSection variant="document" title="Solicitud del cliente">
      <p data-case-reading-text className="whitespace-pre-wrap break-words text-base leading-relaxed">{queja.descripcion || 'Sin descripción registrada.'}</p>
      <div className="mt-5 border-t border-qms-border pt-4"><h4 className="mb-3 text-sm font-medium">Adjuntos del cliente · {adjuntosCliente.length}</h4>{soloLecturaFiles(adjuntosCliente)}</div>

    </CaseSection>}
    {readOnlyStage === 'investigation' && <CaseSection variant="document" title="Investigación">
      {analysis && <div className="mb-5"><h4 className="mb-2 text-sm font-medium">Análisis registrado</h4><div data-case-reading-text><RichTextContent value={analysis.value} format={analysis.format} /></div></div>}
      {queja.resolucion ? <div data-case-reading-text><RichTextContent value={queja.resolucion} format={queja.resolucion_formato} /></div> : <p className="text-sm text-qms-muted">Aún no hay propuesta registrada.</p>}
      <div className="mt-5 border-t border-qms-border pt-4"><h4 className="mb-3 text-sm font-medium">Archivos internos</h4>{soloLecturaFiles(adjuntos.filter(item => !!item.usuario_id))}</div>

    </CaseSection>}
    {readOnlyStage === 'quality_review' && <>
      <CaseSection variant="document" title="Propuesta del responsable">
        {queja.resolucion ? <div data-case-reading-text><RichTextContent value={queja.resolucion} format={queja.resolucion_formato} /></div> : <p className="text-sm text-qms-muted">Todavía no hay una propuesta enviada para revisar.</p>}
      </CaseSection>
      <CaseSection variant="document" title="Adjuntos de la investigación">
        {soloLecturaFiles(adjuntos.filter(item => !!item.usuario_id))}
      </CaseSection>
    </>}
    {readOnlyStage === 'finished' && (['Resuelto', 'Finalizado'].includes(estadoActual)
      ? <QuejaCierreResumen key={queja.id + ':consulta'} queja={queja} adjuntos={adjuntos}
          adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError} onRetryAdjuntos={() => { void refetchAdjuntos() }}
          onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} actividad={actividad}
          actividadLoading={actividadLoading} actividadError={!!actividadError} responsable={responsableActual?.nombre}
          resolveAuthor={id => usuarios.find(u => u.id === id)?.nombre} expanded={expanded} />
      : <CaseSection variant="document" title="Cierre"><p className="text-sm text-qms-muted">Esta etapa todavía no tiene una resolución aprobada para consultar.</p></CaseSection>)}
  </div>

  const compactTriage = <CaseTriageSummary queja={queja} runs={runs} plazoError={!!plazosError}
    responsable={responsableActual?.nombre}
    primaryAction={<CaseTriageNextStep
      step={getCaseTriageNextStep(estadoActual, { responsable: responsableActual?.nombre, canPublish: esStaff })}
      onOpen={() => { setReadOnlyStage(null); setExpanded(true) }} />}
    footer={<CaseTriageFooter title="Historial y notas" count={!actividadLoading && !actividadError ? notasManuales.length : undefined}
      onOpen={() => setActivityOpen(true)} />}>
    <div className="space-y-4">
      {['Resuelto', 'Finalizado', 'No Procede'].includes(estadoActual)
        ? <QuejaCierreResumen key={queja.id + ':compact'} queja={queja}
            adjuntos={adjuntos} adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError}
            onRetryAdjuntos={() => { void refetchAdjuntos() }} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
            actividad={actividad} actividadLoading={actividadLoading} actividadError={!!actividadError}
            responsable={responsableActual?.nombre} resolveAuthor={id => usuarios.find(u => u.id === id)?.nombre}
            expanded={false} />
        : qualityReview ? <>
            <CaseTriageExcerpt title="Propuesta para revisión" text={queja.resolucion || 'Todavía no hay propuesta registrada.'} />
            <CaseTriageAttachments files={adjuntos.filter(item => !!item.usuario_id)} onPreview={setPreviewAdjunto}
              loading={adjuntosLoading} error={!!adjuntosError} />
          </> : estadoActual === 'En Investigación'
          ? <div data-investigation-triage-status className="space-y-2">
              <CaseTriageExcerpt title="Estado de la investigación"
                text={asignacionLoading ? 'Consultando detalles de asignación…'
                  : `Investigador asignado: ${responsableActual?.nombre || 'Por asignar'}. ${asignacion?.instrucciones?.trim() || queja.justificacion_procede || 'En espera de la propuesta del investigador.'}`} />
            </div>
          : <>
              <CaseTriageExcerpt title="Solicitud del cliente" text={queja.descripcion || 'Sin descripción registrada.'} />
              <CaseTriageAttachments files={adjuntosCliente} onPreview={setPreviewAdjunto}
                loading={adjuntosLoading} error={!!adjuntosError} />
              {!expanded && cardMisAdjuntos}
            </>}
    </div>
  </CaseTriageSummary>

  return <>
    <Modal open={!!queja} onClose={handleClose}
      onEscape={() => {
        if (expanded) {
          setReadOnlyStage(null); setExpanded(false)
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-case-triage-expand]')?.focus({ preventScroll: true }))
          return
        }
        if (navigationDisabled) {
          showError(null, 'Hay una edición u operación pendiente. Guardá o cancelá los cambios antes de cerrar el expediente.')
          return
        }
        const row = document.querySelector<HTMLElement>('.ui-case-row[aria-selected="true"]')
        handleClose()
        requestAnimationFrame(() => { if (row?.isConnected) row.focus({ preventScroll: true }) })
      }}
      title={'Folio ' + queja.folio} variant="workspace" expanded={expanded} headerTone="case-notion"
      headerSubtitle={<QuejaClienteDropdown key={queja.id} queja={queja} prominent notionStyle />}
      headerCenter={<div className={expanded ? 'mx-auto w-full max-w-3xl' : 'w-full'}><CaseProcessHeader chevrons queja={queja} selectedStage={expanded ? readOnlyStage : null} onStageChange={expanded ? toggleProcessStage : undefined} disabled={navigationDisabled} /></div>}
      headerActions={<CaseWorkspaceNavigation expanded={expanded} onToggleExpanded={() => { if (expanded) setReadOnlyStage(null); setExpanded(!expanded) }}
        onPrevious={onPrevious} onNext={onNext} disabled={navigationDisabled} />}>
      <CaseWorkspace documentKey={queja.id + (readOnlyStage ? ':read:' + readOnlyStage : qualityReview ? ':review' : ':detail')} expanded={expanded} compactContent={compactTriage} presentation="reference" cyclePlacement="header" readingLayout qualityTwoColumn qualitySideGutters notionStyle
        requestFooter={<div className="space-y-2">
          {!readOnlyStage && esStaff && estadoActual === 'Resuelto' && <div data-close-report-shortcut className="min-w-0">
            <Button size="sm" variant="secondary" className="min-h-11 w-full min-w-0 justify-center border border-qms-primary/20 bg-qms-primary-soft text-qms-primary hover:bg-qms-primary/10"
              disabled={navigationDisabled || adjuntosLoading || !!adjuntosError} onClick={() => setInformeOpen(true)}>
              <FileText aria-hidden="true" className="size-4" />Generar expediente
            </Button>
          </div>}
          {expanded && administrarAdjuntos && <button type="button" onClick={() => setMisAdjuntosOpen(true)}
            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-qms-border bg-white px-3 text-left text-sm font-medium text-qms-dark transition-colors hover:border-qms-primary/50 hover:text-qms-primary">
            <span>Mis adjuntos <span className="ml-1 rounded bg-qms-hover-bg px-1.5 py-0.5 text-xs">{misAdjuntos.length}</span></span>
            <span className="text-xs text-qms-primary">Ver ›</span>
          </button>}
          <button type="button" onClick={() => setActivityOpen(true)}
            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-qms-border bg-white px-3 text-left text-sm font-medium text-qms-dark transition-colors hover:border-qms-primary/50 hover:text-qms-primary">
            <span>Historial y notas <span className="ml-1 rounded bg-qms-hover-bg px-1.5 py-0.5 text-xs">{!actividadLoading && !actividadError ? notasManuales.length : '—'}</span></span>
            <span className="text-xs text-qms-primary">Ver ›</span>
          </button>
        </div>}
        compact={<CaseCycle queja={queja} process chevrons compact />}
        cycle={<CaseCycle queja={queja} process chevrons compact selectedStage={expanded ? readOnlyStage : null} onStageChange={expanded ? toggleProcessStage : undefined} disabled={navigationDisabled} />}
        action={<CaseAction queja={queja} runs={runs} plazoError={!!plazosError} presentation="reference" responsable={responsableActual?.nombre}
          actionTitle={readOnlyStage ? 'Vista de consulta' : estadoActual === 'En Investigación' ? 'Esperar propuesta del investigador' : undefined}
          actionDetail={readOnlyStage ? 'Los cambios de etapa no se realizan desde esta vista de lectura.' : estadoActual === 'En Investigación' ? investigationActionDetail : undefined}>
          {!readOnlyStage && estadoActual === 'Recibido' && <div data-case-evaluation-fields className="flex min-w-0 flex-col gap-2.5">
            <div className="min-w-0 [&>div]:ml-0 [&>div]:w-full [&>div]:max-w-none [&>div>button]:min-h-10 [&>div>button]:rounded-lg [&>div>button]:border [&>div>button]:border-qms-border [&>div>button]:bg-white [&>div>button]:px-3">{areaControl}</div>
            <p className="mt-1 text-sm font-semibold text-qms-dark">Resultado de la evaluación</p>
            {workflowActions}
          </div>}
          {estadoActual !== 'Recibido' && workflowActions}
          {esStaff && <CaseFinalMailStatus messages={correos} finalizada={finalizada} loading={correosLoading} error={!!correosError} compact={expanded}
            onRetry={() => { void refetchCorreos() }} onRetrySend={id => reintentarCorreo.mutate(id)}
            retry={{ id: reintentarCorreo.variables, pending: reintentarCorreo.isPending, error: reintentarCorreo.error?.message, succeeded: reintentarCorreo.isSuccess }} />}
          {esStaff && !readOnlyStage && estadoActual === 'Finalizado' && <Button type="button" size="sm" variant="secondary"
            className="min-h-10 w-full" disabled={workflowPending || editing}
            onClick={() => { beginWorkflowDraft(); setReaperturaAbierta(true) }}><RotateCcw aria-hidden="true" className="size-4" />Reabrir expediente</Button>}
        </CaseAction>}>
            {readOnlyStage ? readOnlyDocument : qualityReview ? <>
              <CaseSection variant="document" source="Responsable" title="Propuesta del responsable">
                <div data-case-reading-copy>{queja.resolucion ? <div data-case-reading-text><RichTextContent value={queja.resolucion} format={queja.resolucion_formato} /></div> : <p className="text-sm text-qms-muted">No hay una propuesta registrada para revisar.</p>}</div>
              </CaseSection>
              <CaseSection variant="document" title="Adjuntos de la investigación">
                {soloLecturaFiles(adjuntos.filter(item => !!item.usuario_id))}
              </CaseSection>
            </> : ['Resuelto', 'Finalizado', 'No Procede'].includes(estadoActual) ? <QuejaCierreResumen key={queja.id} queja={queja}
              adjuntos={adjuntos} adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError}
              onRetryAdjuntos={() => { void refetchAdjuntos() }} onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto}
              actividad={actividad} actividadLoading={actividadLoading} actividadError={!!actividadError}
              responsable={responsableActual?.nombre} resolveAuthor={id => usuarios.find(usuario => usuario.id === id)?.nombre} expanded={expanded} />
            : estadoActual === 'En Investigación' ? <QuejaInvestigacionAsignacion
                responsable={responsableActual?.nombre ?? null}
                justificacionProcede={queja.justificacion_procede} justificacionFormato={queja.justificacion_procede_formato}
                asignacion={asignacion} asignacionLoading={asignacionLoading} asignacionError={!!asignacionError}
                adjuntos={adjuntos} adjuntosLoading={adjuntosLoading} adjuntosError={!!adjuntosError}
                onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} />
            : <>{requestDocument}{estadoActual === 'No Procede' && investigationDocument}</>}
      </CaseWorkspace>
    </Modal>

    <Modal open={editorOpen} onClose={closeEditor} title={workflowTitle + ' · ' + queja.folio} size={reviewOpen ? 'mail' : 'xl'} variant="document" height="fill" dismissOnEscape={!decisionOpen} dismissOnBackdrop={!decisionOpen}
      headerActions={decisionOpen && decisionProcedencia === 'no_procede' ? <Button size="sm" variant="ghost" className="text-sm font-normal text-qms-muted" aria-label="Cambiar decisión: No Procede" title="Cambiar decisión" disabled={workflowPending} onClick={volverAElegirDecision}>No Procede</Button> : undefined}
      footer={decisionOpen && !decisionProcedencia ? undefined : <div className="flex flex-wrap items-center justify-end gap-2">
      {!reviewOpen && <Button variant="ghost" onClick={decisionOpen ? volverAElegirDecision : closeEditor} disabled={workflowPending}>Cancelar</Button>}
      {decisionOpen && decisionProcedencia && <Button variant={decisionProcedencia === 'no_procede' ? 'danger' : 'primary'} disabled={workflowPending || (decisionProcedencia === 'procede' ? usuariosLoading || !!usuariosError : !publicacionVerificada)} onClick={decisionProcedencia === 'procede' ? handleGuardarProcede : handleGuardarNoProcede} loading={loading}>{decisionProcedencia === 'no_procede' && publicacionDisponible ? 'Publicar no procedencia' : 'Guardar'}</Button>}
      {resolucionAbierta && <Button onClick={handleConfirmarResolucion} loading={loading} disabled={workflowPending || !publicacionVerificada}>{publicacionDisponible ? 'Publicar y resolver' : 'Confirmar resolución'}</Button>}
      {reviewOpen && <><Button variant="secondary" onClick={closeEditor} disabled={workflowPending}>Cancelar devolución</Button><Button onClick={handleDevolverInvestigacion} loading={loading} disabled={workflowPending || !motivoDevolucion.trim() || !!errorAdjuntoDevolucion}>Confirmar devolución</Button></>}
      {reaperturaAbierta && <Button onClick={handleReabrir} loading={reabriendo} disabled={workflowPending || !motivoReapertura.trim()}>Reabrir expediente</Button>}
    </div>}>
      <div className="flex min-h-0 flex-1 flex-col bg-qms-surface select-text">
        {terminalDocument && !publicacionVerificada && <div className="shrink-0 border-b border-qms-border px-4 py-2 text-sm text-qms-muted">
          {publicacion.error ? <p role="alert">No se pudo comprobar la publicación. <Button size="sm" variant="link" onClick={() => { void publicacion.refetch() }}>Reintentar</Button></p> : <p role="status">Comprobando comunicación al cliente…</p>}
        </div>}
        {terminalDocument && publicacionDisponible && <Tabs id={`queja-documento-${queja.id}`} label="Documento y comunicación"
          items={[{ id: 'interno', label: 'Documento interno' }, { id: 'cliente', label: 'Respuesta al cliente' }]}
          value={documentTab} onChange={value => setDocumentTab(value === 'cliente' ? 'cliente' : 'interno')} />}
        {clienteTab && <div role="tabpanel" id={`queja-documento-${queja.id}-panel-cliente`} aria-labelledby={`queja-documento-${queja.id}-tab-cliente`} className="flex min-h-0 flex-1 flex-col">{publicationPanel}</div>}
        <div role={terminalDocument && publicacionDisponible ? 'tabpanel' : undefined} id={`queja-documento-${queja.id}-panel-interno`}
          aria-labelledby={terminalDocument && publicacionDisponible ? `queja-documento-${queja.id}-tab-interno` : undefined}
          hidden={clienteTab} className={`${clienteTab ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col`}>
        {decisionOpen && <>
          {!decisionProcedencia && <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8 text-center">
            <div><h3 className="text-base font-semibold text-qms-dark">Seleccioná una decisión</h3><p className="mt-2 text-sm text-qms-muted">Después podés redactar su justificación y guardar.</p></div>
            <div role="group" aria-label="Decisión" className="grid w-full max-w-md grid-cols-2 gap-3">
              <Button variant="primary" className="min-h-11 min-w-0 text-base" disabled={workflowPending} onClick={() => { draftVersions.current.workflow++; setDecisionProcedencia('procede') }}>Procede</Button>
              <Button variant="danger" className="min-h-11 min-w-0 bg-qms-danger! text-base text-white!" disabled={workflowPending || !publicacionVerificada} onClick={() => { draftVersions.current.workflow++; if (publicacionDisponible) { setRespuestaNoProcede(true); setRespuestaCase(workflowQueja); setDecisionOpen(false); } else setDecisionProcedencia('no_procede') }}>No Procede</Button>
            </div>
          </div>}
          {/* Conservar la instancia oculta mantiene borrador, historial y carga del editor. */}
          <div hidden={!decisionProcedencia} className={`${decisionProcedencia ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col`}>
          <RichTextEditor id={'queja-procedencia-' + queja.id} label={decisionProcedencia === 'procede' ? 'Justificación de procedencia' : decisionProcedencia === 'no_procede' ? 'Justificación de no procedencia' : 'Justificación de la decisión'} placeholder={decisionProcedencia === 'procede' ? 'Escribe la justificación de la decisión e instrucciones para el investigador...' : 'Escribí la justificación de la decisión…'} showFormattingHint={decisionProcedencia !== 'procede'} value={justificacion} format={justificacionFormato} variant="document" layout="fill"
            toolbarActions={decisionProcedencia === 'procede' ? <ResponsablePicker
              id={'queja-responsable-' + queja.id} options={responsables} value={responsableValue}
              onSelect={usuario => { void handleSeleccionarResponsable(usuario) }} disabled={workflowPending}
              loading={usuariosLoading} errorMessage={usuariosError ? 'No se pudo cargar el listado de responsables.' : undefined}
              validationMessage={responsableError ? 'Debés asignar un responsable antes de guardar.' : undefined}
              openRequest={responsableOpenRequest} showAvatar /> : undefined}
            autoFocus={!!decisionProcedencia} required disabled={workflowPending || !decisionProcedencia} onChange={(value, format) => { draftVersions.current.workflow++; setJustificacion(value); setJustificacionFormato(format) }} />
          {decisionProcedencia === 'procede' && <section data-assignment-compose
            className="shrink-0 space-y-2 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={workflowPending}
                onClick={() => inputOficioAperturaRef.current?.click()}>
                <Paperclip aria-hidden="true" className="size-4" />{subiendoOficioApertura ? 'Subiendo archivo…' : 'Subir archivo'}
              </Button>
              {misAdjuntos.length > 0 && <Select aria-label="Elegir oficio de Mis adjuntos" wrapperClassName="w-full sm:w-60" value={oficioApertura?.id ?? ''}
                disabled={workflowPending} onChange={event => {
                  draftVersions.current.workflow++
                  setErrorOficioApertura('')
                  setOficioApertura(misAdjuntos.find(item => item.id === event.target.value) ?? null)
                }}>
                <option value="">Elegir de Mis adjuntos</option>
                {misAdjuntos.map(file => <option key={file.id} value={file.id}>{file.nombre}</option>)}
              </Select>}
              <p className="min-w-[15rem] flex-1 text-xs leading-relaxed text-qms-muted">El archivo se almacena en el expediente al subirlo, incluso si cancelás la decisión. Solo se identifica como oficio de apertura al confirmar Procede.</p>
              <input ref={inputOficioAperturaRef} type="file" className="sr-only" aria-label="Seleccionar documento"
                disabled={workflowPending} onChange={event => {
                  const file = event.target.files?.[0]; event.target.value = ''
                  if (file) void subirOficioApertura(file)
                }} />
              {oficioApertura && <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-qms-border bg-qms-hover-bg px-2.5 py-1.5 text-sm">
                <FileText aria-hidden="true" className="size-4 shrink-0 text-qms-primary" />
                <button type="button" className="max-w-52 truncate text-left hover:text-qms-primary"
                  onClick={() => setPreviewAdjunto(oficioApertura)} title={'Previsualizar ' + oficioApertura.nombre}>{oficioApertura.nombre}</button>
                <button type="button" disabled={workflowPending} aria-label="Desvincular oficio de apertura" className="text-xs text-qms-muted hover:text-qms-danger"
                  onClick={() => { draftVersions.current.workflow++; setOficioApertura(null) }}>Quitar</button>
              </div>}
            </div>
            {errorOficioApertura && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-qms-danger">
              <span>{errorOficioApertura}</span>
              <Button type="button" variant="link" size="sm" onClick={() => setErrorOficioApertura('')}>Continuar sin oficio</Button>
            </div>}
          </section>}
          {decisionProcedencia === 'no_procede' && !publicacionDisponible && <div className="h-[108px] shrink-0 overflow-y-auto border-t border-qms-border px-4 py-3"><Field id={'queja-oficio-rechazo-' + queja.id} label="N.º de oficio explicativo"><Input id={'queja-oficio-rechazo-' + queja.id} required maxLength={REGISTRO_QUEJA_LIMITES.oficio} value={oficioWorkflow} disabled={workflowPending} onChange={event => { draftVersions.current.workflow++; setOficioWorkflow(event.target.value) }} /></Field></div>}
          </div>
        </>}
        {resolucionAbierta && <>
          <p className="shrink-0 px-4 py-3 text-sm text-qms-muted">Responsable: {responsableActual?.nombre || 'Sin asignar'}. Registrá la conclusión{publicacionDisponible ? ' interna. La respuesta al cliente se redacta por separado.' : ' y el oficio emitido por ECA.'}</p>
          <RichTextEditor id={'queja-resolucion-' + queja.id} label="Resolución interna de Calidad" placeholder="Escribí la conclusión y sus fundamentos…" value={resolucion} format={resolucionFormato} variant="document" layout="fill" required disabled={workflowPending} onChange={(value, format) => { draftVersions.current.workflow++; setResolucion(value); setResolucionFormato(format) }} />
          {!publicacionDisponible && <div className="h-[108px] shrink-0 overflow-y-auto border-t border-qms-border px-4 py-3"><Field id={'queja-oficio-resolucion-' + queja.id} label="N.º de oficio de resolución"><Input id={'queja-oficio-resolucion-' + queja.id} required maxLength={REGISTRO_QUEJA_LIMITES.oficio} value={oficioWorkflow} disabled={workflowPending} onChange={event => { draftVersions.current.workflow++; setOficioWorkflow(event.target.value) }} /></Field></div>}

        </>}
        {reviewOpen && <div data-quality-return-compose className="flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-surface">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7">
            <div className="mb-5 flex gap-3 rounded-card border border-qms-warning/30 bg-soft-amber-bg p-3 text-sm leading-relaxed text-soft-amber-text">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>El motivo quedará registrado en el historial. Se conserva la propuesta y el plazo original de investigación.</p>
            </div>
            <label htmlFor={'queja-devolucion-' + queja.id} className="mb-3 text-sm font-semibold text-qms-dark">Motivo de devolución <span className="text-qms-danger">*</span></label>
            <textarea id={'queja-devolucion-' + queja.id} required maxLength={10000} rows={8}
              className="min-h-[16rem] w-full flex-1 resize-y border-0 bg-transparent px-2 py-4 text-[16px] leading-relaxed text-[#1f2937] outline-none focus-visible:ring-0 disabled:opacity-60"
              placeholder="Explicá qué debe corregir o ampliar el responsable…" value={motivoDevolucion} disabled={workflowPending}
              onChange={event => { draftVersions.current.workflow++; setMotivoDevolucion(event.target.value) }} />
            <p className="mt-2 text-right text-xs text-qms-muted">{motivoDevolucion.length} / 10.000</p>
          </div>
          <section aria-label="Documentos de soporte" className="shrink-0 border-t border-qms-border bg-qms-hover-bg/30 px-5 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={workflowPending} onClick={() => inputDevolucionRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-button border border-dashed border-qms-border bg-qms-surface px-4 text-sm font-medium text-qms-dark transition-colors hover:border-qms-primary hover:text-qms-primary disabled:opacity-50">
                <Paperclip aria-hidden="true" className="size-4" />{subiendoSoporte ? 'Subiendo…' : 'Adjuntar soporte'}
              </button>
              <input ref={inputDevolucionRef} type="file" aria-label="Adjuntar archivo de soporte" className="sr-only" disabled={workflowPending}
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void subirSoporteDevolucion(file) }} />
              {adjuntosDevolucion.map(file => <div key={file.id} className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-button border border-qms-border bg-qms-surface px-3 py-2 text-sm">
                <FileText aria-hidden="true" className="size-4 shrink-0 text-qms-muted" />
                <span className="max-w-[180px] truncate sm:max-w-[280px]" title={file.nombre}>{file.nombre}</span>
                <button type="button" onClick={() => setPreviewAdjunto(file)} aria-label={'Previsualizar ' + file.nombre} title="Previsualizar"><Eye aria-hidden="true" className="size-4 text-qms-muted hover:text-qms-primary" /></button>
              </div>)}
            </div>
            <p className="mt-2 text-xs text-qms-muted">Los archivos se guardan en el expediente al subirlos, incluso si cancelás la devolución.</p>
            {errorAdjuntoDevolucion && <p role="alert" className="mt-2 text-sm text-qms-danger">{errorAdjuntoDevolucion}</p>}
          </section>
        </div>}
        {reaperturaAbierta && <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain [will-change:transform] p-4">
          <p className="text-base leading-relaxed text-qms-muted">El expediente volverá a <strong>En investigación</strong> y comenzará un nuevo plazo de <strong>15 días hábiles</strong>. El motivo y el ciclo anterior quedarán registrados en el historial.</p><Field id={'queja-reapertura-' + queja.id} label="Motivo de reapertura"><textarea id={'queja-reapertura-' + queja.id} required maxLength={10000} placeholder="Explicá por qué debe reabrirse el expediente..." rows={6} className="ui-textarea w-full px-3 py-2 text-base leading-relaxed" value={motivoReapertura} disabled={workflowPending} onChange={event => { draftVersions.current.workflow++; setMotivoReapertura(event.target.value) }} /></Field>
        </div>}
        </div>
      </div>
    </Modal>

    <QuejaNotasPanel open={activityOpen} quejaId={queja.id} fechaIngreso={queja.fecha} onClose={cerrarActividad} folio={queja.folio}
      currentUser={user ? { id: user.id } : undefined} notas={notasManuales} loading={actividadLoading} error={!!actividadError}
      onRetry={() => { void refetchActividad() }} {...notas.campos} />
    <QuejaAdjuntosInvestigacion open={misAdjuntosOpen} folio={queja.folio} onClose={() => setMisAdjuntosOpen(false)}
      adjuntos={misAdjuntos} loading={adjuntosLoading} error={!!adjuntosError} onRetry={() => { void refetchAdjuntos() }}
      canUpload={administrarAdjuntos} uploading={subiendoAdjunto} uploadDisabled={workflowPending || editing}
      canDelete={file => administrarAdjuntos && !workflowPending && puedeEliminarAdjunto(file)}
      onFiles={files => {
        if (administrarAdjuntos && !workflowPending && !editing) return handleSubirAdjuntos(files)
      }}
      onPreview={setPreviewAdjunto} onDownload={handleDescargarAdjunto} onDelete={file => setConfirmarEliminacion(file.id)} />
    <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    {respuestaCase && esStaff && <QuejaRespuestaClienteModal key={respuestaCase.id + (respuestaNoProcede ? ':rejected' : ':approved')} queja={respuestaCase} noProcede={respuestaNoProcede} autor={user?.nombre ?? 'Gestión de Calidad'} adjuntos={adjuntos} archivosLoading={adjuntosLoading} archivosError={!!adjuntosError}
      onReintentar={() => { void refetchAdjuntos() }} onSubir={handleSubirAdjunto} subiendo={subiendoAdjunto} onUpdated={onUpdated} onClose={completed => { setRespuestaCase(null); if (respuestaNoProcede) { setDecisionProcedencia(null); setDecisionOpen(false) } if (completed) { setWorkflowRevision(null); setDecisionOpen(false); setJustificacion(''); resetPublicacion() } setRespuestaNoProcede(false) }} />}
    {informeOpen && esStaff && <QuejaInformeModal queja={queja} anexos={adjuntos} autor={user?.nombre ?? 'Gestión de Calidad'}
      onClose={() => setInformeOpen(false)} />}
    <ConfirmDialog open={confirmarSACP} title="Derivar a SACP" message="Se creará una acción correctiva vinculada a este expediente. La revisión de Calidad y la respuesta al cliente continuarán su flujo independiente." confirmLabel="Crear acción SACP" loading={derivando} onCancel={() => setConfirmarSACP(false)} onConfirm={() => { void handleDerivarSACP() }} />
    <ConfirmDialog open={confirmarEliminacion !== null} title="Eliminar adjunto" message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer." confirmLabel="Eliminar" danger loading={eliminandoAdjunto !== null} onConfirm={() => confirmarEliminacion && handleEliminarAdjunto(confirmarEliminacion)} onCancel={() => setConfirmarEliminacion(null)} />
  </>
}

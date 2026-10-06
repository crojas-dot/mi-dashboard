'use client'

import ErrorState from '@/components/ui/ErrorState'

import { CFormInput, CButton, CFormLabel, CFormTextarea , CCard, CFormCheck, CSpinner } from '@coreui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import styles from './QuejaDetalleModal.module.css'
import type { Queja } from '@/lib/types'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useUsuarios, type Usuario } from '@/lib/queries/useUsuarios'
import { useQuejaComentarios, useCrearQuejaComentario } from '@/lib/queries/useQuejaComentarios'
import { quejaAdjuntosKey, useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import {
  actualizarDetallesQueja,
  derivarQuejaASACP,
  transicionarQueja,
  subirAdjuntoQueja,
  descargarAdjuntoQueja,
  eliminarAdjuntoQueja,
} from '@/lib/services/quejaWorkflowService'
import { useAuthStore } from '@/lib/store/auth-store'
import { Send, GitBranch, Upload, RotateCcw } from '@/components/ui/icons'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: () => void
  prioridades: { valor: string; color: string }[]
  categorias: { valor: string; color: string }[]
}

const ESTADOS_FLUJO = ['received', 'rejected', 'investigation', 'quality_review', 'resolved', 'finished']

interface BuscadorResponsableProps {
  responsables: Usuario[]
  value: Usuario | null
  onChange: (u: Usuario | null) => void
}

function BuscadorResponsable({ responsables, value, onChange }: BuscadorResponsableProps) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtrados = responsables.filter((u) => u.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
  const texto = abierto ? busqueda : (value?.nombre ?? '')

  return (
    <div ref={ref} className="relative w-full">
      <CFormInput
        type="text"
        className="w-full px-3 py-2"
        placeholder="Buscar responsable..."
        value={texto}
        onChange={(e) => {
          setBusqueda(e.target.value)
          setAbierto(true)
          if (value && e.target.value !== value.nombre) onChange(null)
        }}
        onFocus={() => { setBusqueda(value?.nombre ?? ''); setAbierto(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAbierto(false); setBusqueda(value?.nombre ?? '') } }}
      />
      {abierto && (
        filtrados.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {filtrados.map((u) => (
              <li key={u.id}>
                <CButton color="secondary" variant="outline"
                  type="button"
                  className="w-full px-3 py-2 text-left"
                  onClick={() => { onChange(u); setAbierto(false) }}
                >
                  <span className="block text-sm text-gray-800">{u.nombre}</span>
                  <span className="block text-xs capitalize text-gray-400">{u.rol}</span>
                </CButton>
              </li>
            ))}
          </ul>
        ) : (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
            Sin resultados para «{busqueda}»
          </div>
        )
      )}
    </div>
  )
}

export default function QuejaDetalleModal({ queja, onClose, onUpdated, prioridades }: Props) {
  const [decisionProcedencia, setDecisionProcedencia] = useState<'procede' | 'no_procede' | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const [responsableSeleccionado, setResponsableSeleccionado] = useState<Usuario | null>(null)
  const [resolucionAbierta, setResolucionAbierta] = useState(false)
  const [resolucion, setResolucion] = useState('')
  const [loading, setLoading] = useState(false)
  const [derivando, setDerivando] = useState(false)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [comentarioTipo, setComentarioTipo] = useState<'interno' | 'cliente'>('interno')
  const [visibleCliente, setVisibleCliente] = useState(false)
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false)
  const [reaperturaAbierta, setReaperturaAbierta] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')
  const [reabriendo, setReabriendo] = useState(false)
  const [previewAdjunto, setPreviewAdjunto] = useState<QuejaAdjunto | null>(null)
  const [eliminandoAdjunto, setEliminandoAdjunto] = useState<string | null>(null)
  const [confirmarEliminacion, setConfirmarEliminacion] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<'resumen' | 'gestion'>('resumen')

  const queryClient = useQueryClient()
  const quejaId = queja?.id ?? ''
  const { data: comentarios = [], isLoading: comentariosLoading, error: comentariosError, refetch: retryComentarios } = useQuejaComentarios(quejaId)
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: retryAdjuntos } = useQuejaAdjuntos(quejaId)
  const crearComentario = useCrearQuejaComentario()
  const { data: usuarios = [] } = useUsuarios({ estado: 'activo' }, !!queja)
  const user = useAuthStore((s) => s.user)

  const responsables = useMemo(
    () => (usuarios as Usuario[]).filter((u) => u.rol === 'admin' || u.rol === 'calidad' || u.rol === 'colaborador'),
    [usuarios],
  )
  const estadoActual = queja?.estado_codigo ?? ''
  const esStaff = user?.rol === 'admin' || user?.rol === 'calidad'

  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setDecisionProcedencia(null)
    setJustificacion('')
    setResponsableSeleccionado(null)
    setResolucionAbierta(false)
    setResolucion('')
    setReaperturaAbierta(false)
    setMotivoReapertura('')
    setPreviewAdjunto(null)
    setConfirmarEliminacion(null)
    setEliminandoAdjunto(null)
    setTabActiva('resumen')
  }

  if (!queja) return null

  const responsableActual = responsables.find((u) => u.id === queja.responsable_id)
  const responsableValue = responsableSeleccionado ?? responsableActual ?? null

  const getColor = (items: { valor: string; color: string }[], valor: string) => {
    const found = items.find((i) => i.valor === valor)
    const semantic = ['primary','info','success','warning','danger','secondary'].includes(found?.color ?? '') ? found!.color : 'secondary'
    return `var(--cui-${semantic})`
  }

  // ── Recibido: Decisión de procedencia (solo admin/calidad) ──
  const handleGuardarNoProcede = async () => {
    if (!justificacion.trim()) {
      showError(null, 'La justificación / resolución es obligatoria para marcar como No Procede')
      return
    }
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'rejected', { revision: queja.revision, resolucion: justificacion })
      showSuccess('Queja marcada como No Procede')
      setDecisionProcedencia(null)
      setJustificacion('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo marcar la queja como No Procede')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarProcede = async () => {
    const responsable = responsableValue
    if (!justificacion.trim()) {
      showError(null, 'La justificación es obligatoria para iniciar la investigación')
      return
    }
    if (!responsable) {
      showError(null, 'Seleccioná un responsable antes de iniciar la investigación')
      return
    }
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'investigation', { revision: queja.revision,
        justificacionProcede: justificacion,
        responsableId: responsable.id,
      })
      showSuccess('Queja en investigación. Vencimiento calculado según la configuración vigente.')
      setDecisionProcedencia(null)
      setJustificacion('')
      setResponsableSeleccionado(null)
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo iniciar la investigación')
    } finally {
      setLoading(false)
    }
  }

  // ── En Investigación: Resolver ──
  const handleConfirmarResolucion = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí el análisis / resolución final antes de resolver la queja')
      return
    }
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'resolved', { revision: queja.revision, resolucion })
      showSuccess('Queja resuelta')
      setResolucionAbierta(false)
      setResolucion('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo resolver la queja')
    } finally {
      setLoading(false)
    }
  }

  const handleSeleccionarResponsable = (u: Usuario | null) => {
    setResponsableSeleccionado(u)
    if (!u || estadoActual === 'received' || u.id === queja.responsable_id) return
    actualizarDetallesQueja({ quejaId: queja.id, revision: queja.revision, responsableId: u.id })
      .then(() => { showSuccess('Responsable asignado'); onUpdated() })
      .catch((e) => showError(e as Error, 'No se pudo asignar el responsable'))
  }

  const handleFinalizar = async () => {
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'finished', { revision: queja.revision })
      showSuccess('Queja finalizada')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo finalizar la queja')
    } finally {
      setLoading(false)
    }
  }

  const handleReabrir = async () => {
    if (!motivoReapertura.trim()) {
      showError(null, 'Escribí el motivo antes de reabrir la queja')
      return
    }
    setReabriendo(true)
    try {
      await transicionarQueja(queja.id, 'investigation', { revision: queja.revision, motivoReapertura })
      showSuccess('Queja reabierta. Nuevo plazo calculado según la configuración vigente.')
      setReaperturaAbierta(false)
      setMotivoReapertura('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo reabrir la queja')
    } finally {
      setReabriendo(false)
    }
  }

  const handleSubirAdjunto = async (file: File) => {
    setSubiendoAdjunto(true)
    try {
      await subirAdjuntoQueja(queja.id, file)
      queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(queja.id) })
      showSuccess('Adjunto subido')
    } catch (error) {
      showError(error as Error, 'No se pudo subir el adjunto')
    } finally {
      setSubiendoAdjunto(false)
    }
  }

  const handleDescargarAdjunto = async (adjunto: QuejaAdjunto) => {
    try {
      await descargarAdjuntoQueja(adjunto)
    } catch (error) {
      showError(error as Error, 'No se pudo descargar el adjunto')
    }
  }

  const handleEliminarAdjunto = async (adjuntoId: string) => {
    setEliminandoAdjunto(adjuntoId)
    try {
      await eliminarAdjuntoQueja(adjuntoId)
      queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(queja.id) })
      showSuccess('Adjunto eliminado')
      setConfirmarEliminacion(null)
    } catch (error) {
      showError(error as Error, 'No se pudo eliminar el adjunto')
    } finally {
      setEliminandoAdjunto(null)
    }
  }

  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto): boolean => {
    if (adjunto.usuario_id === null) return user?.rol === 'admin'
    return user?.rol === 'admin' || user?.rol === 'calidad' || queja.responsable_id === user?.id
  }

  const handleAprobarResolucion = async () => {
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'resolved', { revision: queja.revision })
      showSuccess('Resolución aprobada. Queja resuelta.')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo aprobar la resolución')
    } finally {
      setLoading(false)
    }
  }

  const handleDevolverInvestigacion = async () => {
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'investigation', { revision: queja.revision })
      showSuccess('Queja devuelta a investigación')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo devolver la queja')
    } finally {
      setLoading(false)
    }
  }

  const handleDerivarSACP = async () => {
    setDerivando(true)
    try {
      const accion = await derivarQuejaASACP(queja.id)
      showSuccess(`Derivada a SACP como ${accion.folio || 'nueva acción'}`)
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo derivar a SACP')
    } finally {
      setDerivando(false)
    }
  }

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) return
    try {
      await crearComentario.mutateAsync({
        quejaId: queja.id,
        comentario: nuevoComentario,
        tipo: comentarioTipo,
        visibleCliente,
      })
      showSuccess('Comentario agregado')
      setNuevoComentario('')
    } catch (error) {
      showError(error as Error, 'No se pudo agregar el comentario')
    }
  }

  const tabCls = (activa: boolean) => (activa ? `${styles.tab} ${styles.tabActive}` : styles.tab)
const formatFechaCreacion = (fecha: string) => {
  const d = new Date(fecha)
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} • ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

  return (
    <>
      <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
      <Modal
        open={!!queja}
        onClose={onClose}
        title={`Queja ${queja.folio}`}
        width={960}
        hideHeader
        contentClassName="modal-detalle"
        bodyClassName="p-0"
      >
        {/* Cabecera sticky: folio + pestañas (igual que el mockup) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-end gap-6 border-b border-qms-border bg-qms-surface px-12 pt-6">
          <h2 className="shrink-0 whitespace-nowrap text-xl font-semibold leading-tight text-qms-dark" style={{ marginBottom: '0.6rem' }}>{queja.folio.toUpperCase()}</h2>
          <div className="mb-[-1px] flex flex-wrap">
            <button className={tabCls(tabActiva === 'resumen')} type="button" onClick={() => setTabActiva('resumen')}>Resumen y Evidencias</button>
            <button className={tabCls(tabActiva === 'gestion')} type="button" onClick={() => setTabActiva('gestion')}>Gestión Interna</button>
          </div>
        </div>

        <div className="select-text px-12 py-10">
        {tabActiva === 'resumen' ? (
        <>
          {/* ── RESUMEN Y EVIDENCIAS ── */}
          <div className="row mb-8">
            <div className="col-md-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Cliente Solicitante</p>
              <p className="text-[17px] font-semibold text-qms-dark">{queja.cliente_nombre}</p>
            </div>
            <div className="col-md-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Fecha de creación</p>
              <p className="text-[17px] font-semibold text-qms-dark">{formatFechaCreacion(queja.fecha)}</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-4 text-[17px] font-semibold text-qms-dark">Descripción Original</p>
            <div className="whitespace-pre-wrap rounded-md border border-qms-border bg-qms-background p-6 text-base leading-[1.75] text-qms-dark">
              {queja.descripcion || '—'}
            </div>
          </div>

          {/* Evidencias adjuntas: visibles en TODOS los estados (incluye las
              enviadas desde el formulario público, usuario_id NULL). La subida
              interna se mantiene solo en «En Investigación»; el RPC
              registrar_adjunto_queja limita quién puede subir. */}
          <div>
            <p className="mb-4 text-[17px] font-semibold text-qms-dark">
              Evidencias Adjuntas{' '}
              <span className="text-base font-normal text-qms-muted">({adjuntos.length} archivos)</span>
            </p>
            {adjuntosError ? <ErrorState error={adjuntosError} title="No se pudieron cargar las evidencias" onRetry={() => void retryAdjuntos()} /> : adjuntosLoading ? (
              <div className="space-y-2 py-1" role="status" aria-label="Cargando evidencias">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-qms-border/60" />)}
              </div>
            ) : adjuntos.length === 0 ? (
              <p className="text-sm text-qms-muted">
                {estadoActual === 'received'
                  ? 'Sin evidencias todavía. Los archivos enviados desde el formulario público aparecerán aquí.'
                  : 'Sin adjuntos todavía.'}
              </p>
            ) : (
              <ListaAdjuntos
                adjuntos={adjuntos}
                onPreview={(a) => setPreviewAdjunto(a)}
                onDownload={(a) => handleDescargarAdjunto(a)}
                puedeEliminar={puedeEliminarAdjunto}
                onEliminar={(a) => setConfirmarEliminacion(a.id)}
              />
            )}
            {estadoActual === 'investigation' && (
              <div className="mt-3 flex items-center gap-2 pt-1">
                <CFormLabel className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-qms-primary px-3 py-2 text-sm font-medium text-qms-primary transition-colors hover:bg-qms-background">
                  <Upload className="h-3.5 w-3.5" /> Subir archivo
                  <input
                    type="file"
                    className="hidden"
                    disabled={subiendoAdjunto}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) handleSubirAdjunto(f)
                    }}
                  />
                </CFormLabel>
                {subiendoAdjunto && <span className="text-xs text-gray-500">Subiendo...</span>}
              </div>
            )}
          </div>
        </>
        ) : (
        <>
          {/* ── GESTIÓN INTERNA ── */}
          <div className="row mb-8">
            <div className="col-md-4 mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Estado Actual</p>
              <span className="inline-block rounded-sm bg-qms-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.3px] text-white">{queja.estado_nombre}</span>
            </div>
            <div className="col-md-4 mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Categoría</p>
              <p className="text-[17px] font-semibold text-qms-dark">{queja.categoria || '—'}</p>
            </div>
            <div className="col-md-4 mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Prioridad</p>
              {queja.prioridad ? (
                <p className="text-[17px] font-semibold" style={{ color: getColor(prioridades, queja.prioridad) }}>{queja.prioridad}</p>
              ) : (
                <p className="mb-0 text-base font-medium italic text-qms-muted">Sin asignar</p>
              )}
            </div>
          </div>

          {estadoActual !== 'received' && (
            <div className="row mb-8">
              <div className="col-md-6 mb-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Responsable asignado</p>
                <p className="text-[17px] font-semibold text-qms-dark">{responsableActual?.nombre ?? 'Sin asignar'}</p>
              </div>
              {queja.fecha_limite_investigacion && (
                <div className="col-md-6 mb-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-qms-muted">Fecha límite de investigación</p>
                  <p className="text-[17px] font-semibold text-qms-dark">{new Date(queja.fecha_limite_investigacion).toLocaleDateString('es-ES')}</p>
                </div>
              )}
            </div>
          )}

          {/* Análisis / Resolución (oculto en Recibido; en En Investigación solo al presionar Resolver) */}
          {estadoActual !== 'received' && estadoActual !== 'investigation' && (
            <div className="mb-5 rounded-md border border-qms-border bg-qms-surface p-6">
              <p className="mb-4 text-[17px] font-semibold text-qms-dark">Análisis / Resolución</p>
              <CFormTextarea
                placeholder="Escribe el oficio o la resolución requerida para la siguiente transición..."
                rows={3}
                className="w-full px-3 py-2"
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
              />
              {queja.resolucion && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-qms-border bg-qms-surface p-3 text-sm text-qms-dark">{queja.resolucion}</p>
              )}
            </div>
          )}

          {/* Decisión y flujo */}
          {ESTADOS_FLUJO.includes(estadoActual) && (
            <div className="mb-5">
              {/* ── RECIBIDO: solo admin/calidad decide ── */}
              {estadoActual === 'received' && (
                esStaff ? (
                  decisionProcedencia === null ? (
                    <div className="rounded-md border border-qms-border bg-qms-surface p-6">
                      <p className="mb-4 text-lg font-semibold leading-tight text-qms-primary">Decisión de procedencia</p>
                      <p className="mb-4 text-sm leading-[1.75] text-qms-muted">
                        Indique si la queja procede y avanza a la etapa de investigación, o si no procede y se cierra de manera definitiva en el sistema.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setDecisionProcedencia('procede')}>Sí, procede</Button>
                        <Button variant="danger" onClick={() => setDecisionProcedencia('no_procede')}>No procede</Button>
                      </div>
                    </div>
                  ) : decisionProcedencia === 'no_procede' ? (
                    <div className="space-y-3 rounded-md border border-qms-border bg-qms-surface p-6">
                      <p className="text-lg font-semibold leading-tight text-qms-primary">Cierre por «No procede»</p>
                      <p className="text-sm leading-[1.75] text-qms-muted">La queja se cerrará como «No Procede». La justificación / resolución es obligatoria.</p>
                      <CFormTextarea
                        placeholder="Justificación / Resolución (Obligatorio)"
                        rows={4}
                        className="w-full px-3 py-2"
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="danger" onClick={handleGuardarNoProcede} loading={loading}>Guardar</Button>
                        <Button variant="ghost" onClick={() => { setDecisionProcedencia(null); setJustificacion('') }}>Volver</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-md border border-qms-border bg-qms-surface p-6">
                      <p className="text-lg font-semibold leading-tight text-qms-primary">Asignar responsable</p>
                      <p className="text-sm leading-[1.75] text-qms-muted">La justificación es obligatoria. Seleccioná quién investigará la queja; al guardar inicia el plazo configurado para esta etapa.</p>
                      <CFormTextarea
                        placeholder="Justificación (Obligatorio)"
                        rows={3}
                        className="w-full px-3 py-2"
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                      />
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                        <CFormLabel className="shrink-0 font-medium uppercase tracking-wide sm:w-36">Responsable *</CFormLabel>
                        <BuscadorResponsable responsables={responsables} value={responsableValue} onChange={handleSeleccionarResponsable} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={handleGuardarProcede} loading={loading}>Guardar</Button>
                        <Button variant="ghost" onClick={() => { setDecisionProcedencia(null); setJustificacion(''); setResponsableSeleccionado(null) }}>Volver</Button>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-qms-muted">Solo el personal de calidad puede decidir la procedencia de la queja.</p>
                )
              )}

              {/* ── EN INVESTIGACIÓN: adjuntos + resolver ── */}
              {estadoActual === 'investigation' && (
                <>
                  <CCard className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</p>
                      <p className="text-sm font-medium text-gray-900">{responsableActual?.nombre ?? 'Sin asignar'}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">El responsable queda fijo durante la investigación. No se puede modificar.</p>
                  </CCard>

                  {!resolucionAbierta ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => setResolucionAbierta(true)}>Resolver</Button>
                      {!queja.derivado_sacp_id && (
                        <Button variant="secondary" onClick={handleDerivarSACP} loading={derivando}>
                          <GitBranch className="h-3.5 w-3.5" /> Derivar a SACP
                        </Button>
                      )}
                      {queja.derivado_sacp_id && <Badge variant="blue">Derivada a SACP</Badge>}
                    </div>
                  ) : (
                    <>
                      <CFormTextarea
                        placeholder="Análisis / Resolución Final (Obligatorio)"
                        rows={4}
                        className="w-full px-3 py-2"
                        value={resolucion}
                        onChange={(e) => setResolucion(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={handleConfirmarResolucion} loading={loading}>Confirmar resolución</Button>
                        <Button variant="ghost" onClick={() => { setResolucionAbierta(false); setResolucion('') }}>Volver</Button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── PENDIENTE DE REVISIÓN GC (expedientes heredados) ── */}
              {estadoActual === 'quality_review' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm font-semibold text-blue-900 leading-relaxed">Resolución enviada a revisión</p>
                    <p className="text-xs text-blue-900 leading-relaxed mt-0.5">El responsable envió su resolución. Aprobalo para resolver la queja o devolvela a investigación.</p>
                  </div>
                  {queja.resolucion && (
                    <CCard className="p-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resolución del colaborador</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{queja.resolucion}</p>
                    </CCard>
                  )}
                  {esStaff && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={handleAprobarResolucion} loading={loading}>Aprobar resolución</Button>
                      <Button variant="secondary" onClick={handleDevolverInvestigacion} loading={loading}>Devolver a investigación</Button>
                    </div>
                  )}
                </div>
              )}

              {/* ── RESUELTO ── */}
              {estadoActual === 'resolved' && (
                esStaff ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleFinalizar} loading={loading}>Finalizar</Button>
                    <Button variant="secondary" onClick={() => setReaperturaAbierta(true)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reabrir queja
                    </Button>
                    {!queja.derivado_sacp_id && (
                      <Button variant="secondary" onClick={handleDerivarSACP} loading={derivando}>
                        <GitBranch className="h-3.5 w-3.5" /> Derivar a SACP
                      </Button>
                    )}
                    {queja.derivado_sacp_id && <Badge variant="blue">Derivada a SACP</Badge>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">La queja está resuelta. Solo el personal de calidad puede finalizarla o reabrirla.</p>
                )
              )}

              {/* ── FINALIZADO ── */}
              {estadoActual === 'finished' && (
                esStaff ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={() => setReaperturaAbierta(true)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reabrir queja
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Queja finalizada.</p>
                )
              )}

              {(estadoActual === 'rejected' || estadoActual === 'finished') && (
                <p className="text-sm text-gray-500">
                  {estadoActual === 'rejected'
                    ? 'Queja cerrada como No Procede.'
                    : 'Queja finalizada.'}
                  {queja.fecha_cierre && <> Cierre: {new Date(queja.fecha_cierre).toLocaleDateString('es-ES')}.</>}
                </p>
              )}

              {reaperturaAbierta && esStaff && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-900">Reabrir queja</p>
                  <p className="text-xs text-amber-900">La queja volverá a «En Investigación» con el plazo vigente al iniciar la nueva etapa. El motivo es obligatorio y quedará en las notas.</p>
                  <CFormTextarea
                    placeholder="Motivo de la reapertura..."
                    rows={2}
                    className="w-full px-3 py-2"
                    value={motivoReapertura}
                    onChange={(e) => setMotivoReapertura(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleReabrir} loading={reabriendo}>Confirmar reapertura</Button>
                    <Button variant="ghost" onClick={() => setReaperturaAbierta(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comentarios y notas internas */}
          <div className="rounded-md border border-qms-border bg-qms-surface p-6">
            <p className="mb-4 text-[17px] font-semibold text-qms-dark">Comentarios y notas internas</p>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {comentariosError ? <ErrorState error={comentariosError} title="No se pudieron cargar los comentarios" onRetry={() => void retryComentarios()} /> : comentariosLoading ? <div className="flex items-center justify-center py-3" role="status"><CSpinner size="sm" /></div> : comentarios.length === 0 ? (
                <p className="text-sm text-gray-400">Sin comentarios todavía.</p>
              ) : comentarios.map((c) => (
                <CCard key={c.id} className="p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={c.tipo === 'cliente' ? 'blue' : 'gray'}>{c.tipo === 'cliente' ? 'Cliente' : 'Interno'}</Badge>
                    {c.visible_cliente && <Badge variant="green">Visible al quejoso</Badge>}
                    <span className="text-xs text-gray-400">{new Date(c.fecha).toLocaleString('es-ES')}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comentario}</p>
                </CCard>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <CFormTextarea
                placeholder="Nuevo comentario..."
                rows={2}
                className="w-full px-3 py-2"
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <Select className="w-full" value={comentarioTipo} onChange={(e) => setComentarioTipo(e.target.value as 'interno' | 'cliente')}>
                  <option value="interno">Interno</option>
                  <option value="cliente">Cliente</option>
                </Select>
                <CFormLabel className="flex items-center gap-1.5 whitespace-nowrap">
                  <CFormCheck type="checkbox" checked={visibleCliente} onChange={(e) => setVisibleCliente(e.target.checked)} />
                  Visible al quejoso
                </CFormLabel>
                <Button size="sm" onClick={handleAgregarComentario} disabled={!nuevoComentario.trim()}><Send className="h-3 w-3" /> Agregar</Button>
              </div>
            </div>
          </div>
        </>
        )}
        </div>
      </Modal>

    <ConfirmDialog
      open={confirmarEliminacion !== null}
      title="Eliminar adjunto"
      message="¿Seguro que deseas eliminar este adjunto? Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      danger
      loading={eliminandoAdjunto !== null}
      onConfirm={() => confirmarEliminacion && handleEliminarAdjunto(confirmarEliminacion)}
      onCancel={() => setConfirmarEliminacion(null)}
    />
    </>
  )
}

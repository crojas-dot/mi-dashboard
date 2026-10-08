'use client'

import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import type { Queja } from '@/lib/types'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useUsuarios, type Usuario } from '@/lib/queries/useUsuarios'
import { useQuejaComentarios, useCrearQuejaComentario } from '@/lib/queries/useQuejaComentarios'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import {
  actualizarDetallesQueja,
  derivarQuejaASACP,
  transicionarQueja,
} from '@/lib/services/quejaWorkflowService'
import { useAuthStore } from '@/lib/store/auth-store'
import { estadoVariant } from '@/lib/constants/estados'
import { Send, GitBranch, Upload, RotateCcw } from 'lucide-react'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaAttachmentActions } from '@/hooks/useQuejaAttachmentActions'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  prioridades: { valor: string; color: string }[]
  categorias: { valor: string; color: string }[]
}

const colorMap: Record<string, string> = {
  red: '#dc3545', amber: '#e0a800', green: '#198754',
  blue: '#0d6efd', orange: '#fd7e14', purple: '#6f42c1', gray: '#6c757d',
}

const ESTADOS_FLUJO = ['Recibido', 'No Procede', 'En Investigación', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado']

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
      <input
        type="text"
        className="ui-field w-full px-3 py-2 text-sm"
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
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-100"
                  onClick={() => { onChange(u); setAbierto(false) }}
                >
                  <span className="block text-sm text-gray-800">{u.nombre}</span>
                  <span className="block text-xs capitalize text-gray-400">{u.rol}</span>
                </button>
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
  const [reaperturaAbierta, setReaperturaAbierta] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')
  const [reabriendo, setReabriendo] = useState(false)
  const [agregandoComentario, setAgregandoComentario] = useState(false)
  const draftVersions = useRef({ workflow: 0, comentario: 0 })
  const quejaId = queja?.id ?? ''
  const { data: comentarios = [], isLoading: comentariosLoading } = useQuejaComentarios(quejaId)
  const { data: adjuntos = [], isLoading: adjuntosLoading } = useQuejaAdjuntos(quejaId)
  const crearComentario = useCrearQuejaComentario()
  const { data: usuarios = [] } = useUsuarios({ estado: 'activo' }, !!queja)
  const user = useAuthStore((s) => s.user)
  const scope = useEntityRequestGuard(queja?.id ?? null)
  const {
    previewAdjunto, setPreviewAdjunto, subiendoAdjunto, eliminandoAdjunto,
    confirmarEliminacion, setConfirmarEliminacion,
    handleSubirAdjunto, handleEliminarAdjunto, handleDescargarAdjunto,
  } = useQuejaAttachmentActions(queja?.id ?? null, scope)

  const responsables = useMemo(
    () => (usuarios as Usuario[]).filter((u) => u.rol === 'admin' || u.rol === 'calidad' || u.rol === 'colaborador'),
    [usuarios],
  )
  const estadoActual = queja?.estado ?? ''
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
    setLoading(false)
    setDerivando(false)
    setReabriendo(false)
    setAgregandoComentario(false)
    setNuevoComentario('')
    setComentarioTipo('interno')
    setVisibleCliente(false)
  }

  if (!queja) return null

  const responsableActual = responsables.find((u) => u.id === queja.responsable_id)
  const responsableValue = responsableSeleccionado ?? responsableActual ?? null

  const getColor = (items: { valor: string; color: string }[], valor: string) => {
    const found = items.find((i) => i.valor === valor)
    return found ? colorMap[found.color] || '#6c757d' : '#6c757d'
  }

  const handleClose = () => {
    scope.invalidate()
    onClose()
  }

  // El servicio recibe la revisión capturada; ningún fallo autoriza buscar otra para reintentar.
  const runCaseUpdate = async (
    write: () => Promise<Queja>,
    successMessage: string,
    errorMessage: string,
    onCurrentDraft?: () => void,
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
        if (draftVersions.current.workflow === draftVersion) onCurrentDraft?.()
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, confirmed
        ? 'La queja se guardó, pero no se pudo actualizar la vista'
        : errorMessage)
    } finally {
      if (operation.isCurrent()) setPending(false)
      operation.finish()
    }
  }

  const handleGuardarNoProcede = async () => {
    if (!justificacion.trim()) {
      showError(null, 'La justificación / resolución es obligatoria para marcar como No Procede')
      return
    }
    await runCaseUpdate(
      () => transicionarQueja(queja, 'No Procede', { resolucion: justificacion }),
      'Queja marcada como No Procede', 'No se pudo marcar la queja como No Procede',
      () => { setDecisionProcedencia(null); setJustificacion('') },
    )
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
    await runCaseUpdate(
      () => transicionarQueja(queja, 'En Investigación', {
        justificacionProcede: justificacion, responsableId: responsable.id,
      }),
      'Queja en investigación. Plazo: 15 días.', 'No se pudo iniciar la investigación',
      () => { setDecisionProcedencia(null); setJustificacion(''); setResponsableSeleccionado(null) },
    )
  }

  const handleConfirmarResolucion = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí el análisis / resolución final antes de resolver la queja')
      return
    }
    await runCaseUpdate(
      () => transicionarQueja(queja, 'Resuelto', { resolucion }),
      'Queja resuelta', 'No se pudo resolver la queja',
      () => { setResolucionAbierta(false); setResolucion('') },
    )
  }

  const handleSeleccionarResponsable = async (usuario: Usuario | null) => {
    draftVersions.current.workflow++
    setResponsableSeleccionado(usuario)
    if (!usuario || estadoActual === 'Recibido' || usuario.id === queja.responsable_id) return
    await runCaseUpdate(
      () => actualizarDetallesQueja({ quejaId: queja.id, revision: queja.revision, responsableId: usuario.id }),
      'Responsable asignado', 'No se pudo asignar el responsable',
    )
  }

  const handleFinalizar = () => runCaseUpdate(
    () => transicionarQueja(queja, 'Finalizado'),
    'Queja finalizada', 'No se pudo finalizar la queja',
  )

  const handleReabrir = async () => {
    if (!motivoReapertura.trim()) {
      showError(null, 'Escribí el motivo antes de reabrir la queja')
      return
    }
    await runCaseUpdate(
      () => transicionarQueja(queja, 'En Investigación', { motivoReapertura }),
      'Queja reabierta. Nuevo plazo: 15 días.', 'No se pudo reabrir la queja',
      () => { setReaperturaAbierta(false); setMotivoReapertura('') }, setReabriendo,
    )
  }

  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto): boolean => {
    if (adjunto.usuario_id === null) return user?.rol === 'admin'
    return user?.rol === 'admin' || user?.rol === 'calidad' || queja.responsable_id === user?.id
  }

  const handleAprobarResolucion = () => runCaseUpdate(
    () => transicionarQueja(queja, 'Resuelto'),
    'Resolución aprobada. Queja resuelta.', 'No se pudo aprobar la resolución',
  )

  const handleDevolverInvestigacion = () => runCaseUpdate(
    () => transicionarQueja(queja, 'En Investigación'),
    'Queja devuelta a investigación', 'No se pudo devolver la queja',
  )

  const handleDerivarSACP = async () => {
    const operation = scope.start('workflow')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setDerivando(true)
    let confirmed = false
    try {
      const accion = await derivarQuejaASACP(queja.id)
      confirmed = true
      if (isContextCurrent()) onUpdated(undefined, operation.isCurrent)
      if (operation.isCurrent()) showSuccess('Derivada a SACP como ' + (accion.folio || 'nueva acción'))
    } catch (error) {
      if (operation.isCurrent()) showError(error, confirmed
        ? 'La derivación se guardó, pero no se pudo actualizar la vista'
        : 'No se pudo derivar a SACP')
    } finally {
      if (operation.isCurrent()) setDerivando(false)
      operation.finish()
    }
  }

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) return
    const operation = scope.start('case-comment')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    const draftVersion = draftVersions.current.comentario
    setAgregandoComentario(true)
    try {
      await crearComentario.mutateAsync({
        quejaId: queja.id, comentario: nuevoComentario, tipo: comentarioTipo, visibleCliente, isContextCurrent,
      })
      if (operation.isCurrent()) {
        showSuccess('Comentario agregado')
        if (draftVersions.current.comentario === draftVersion) setNuevoComentario('')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo agregar el comentario')
    } finally {
      if (operation.isCurrent()) setAgregandoComentario(false)
      operation.finish()
    }
  }

  return (
    <>
      <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
      <Modal open={!!queja} onClose={handleClose} title={`Queja ${queja.folio}`} size="lg">
      <div className="space-y-5 select-text">
        {/* Sección 1: Datos de la queja */}
        <div className="space-y-6">
          <p className="text-base font-semibold text-gray-800 mb-2">Datos de la queja</p>

          {/* Sub-sección A: Información del Solicitante (solo lectura) */}
          <div className="p-4 border-l-4 border-sky-300">
            <h4 className="text-sm font-medium text-slate-600 mb-3">Información del Solicitante</h4>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Cliente</p>
                <p className="text-sm font-medium text-gray-900">{queja.cliente_nombre}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Fecha de creación</p>
                <p className="text-sm text-gray-900">{new Date(queja.fecha).toLocaleString('es-ES')}</p>
              </div>
              {queja.descripcion && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Descripción original</p>
                  <div className="bg-slate-100 text-slate-700 text-sm p-3 rounded-md leading-relaxed whitespace-pre-wrap">
                    {queja.descripcion}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sub-sección B: Detalles de Gestión Interna */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="text-sm font-medium text-slate-600 mb-3">Detalles de Gestión Interna</h4>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado</p>
                <Badge variant={estadoVariant[estadoActual] || 'gray'}>{estadoActual}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Prioridad</p>
                <p className="text-sm font-medium" style={{ color: getColor(prioridades, queja.prioridad) }}>
                  {queja.prioridad || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Categoría</p>
                <p className="text-sm text-gray-900">{queja.categoria || '—'}</p>
              </div>
              {estadoActual !== 'Recibido' && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Responsable</p>
                  <p className="text-sm text-gray-900">{responsableActual?.nombre ?? 'Sin asignar'}</p>
                </div>
              )}
              {queja.fecha_limite_investigacion && (
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Fecha límite de investigación</p>
                  <p className="text-sm text-gray-900">{new Date(queja.fecha_limite_investigacion).toLocaleDateString('es-ES')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Evidencias adjuntas: visibles en TODOS los estados (incluye las
            enviadas desde el formulario público, usuario_id NULL). La subida
            interna se mantiene solo en «En Investigación»; el RPC
            registrar_adjunto_queja limita quién puede subir. */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-gray-800">Evidencias adjuntas</p>
            <span className="text-xs text-gray-400">{adjuntos.length} archivo(s)</span>
          </div>
          {adjuntosLoading ? (
            <LoadingSkeleton variant="list" label="Cargando evidencias…" framed={false} />
          ) : adjuntos.length === 0 ? (
            <p className="text-sm text-gray-400">
              {estadoActual === 'Recibido'
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
          {estadoActual === 'En Investigación' && (
            <div className="flex items-center gap-2 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
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
              </label>
              {subiendoAdjunto && <span className="text-xs text-gray-500">Subiendo...</span>}
            </div>
          )}
        </div>

        {/* Sección 2: Análisis / Resolución (oculto en Recibido; en En Investigación solo al presionar Resolver) */}
        {estadoActual !== 'Recibido' && estadoActual !== 'En Investigación' && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-base font-semibold text-gray-800 mb-2">Análisis / Resolución</p>
            <textarea
              placeholder="Escribe el oficio o la resolución requerida para la siguiente transición..."
              rows={3}
              className="ui-textarea w-full px-3 py-2 text-sm"
              value={resolucion}
              onChange={(e) => { draftVersions.current.workflow++; setResolucion(e.target.value) }}
            />
            {queja.resolucion && (
              <p className="mt-2 text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">{queja.resolucion}</p>
            )}
          </div>
        )}

        {/* Sección 3: Decisión y flujo */}
        {ESTADOS_FLUJO.includes(estadoActual) && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
            <p className="text-base font-semibold text-gray-800 mb-2">
              {estadoActual === 'Recibido' ? 'Decisión de procedencia' : 'Flujo de atención'}
            </p>

            {/* ── RECIBIDO: solo admin/calidad decide ── */}
            {estadoActual === 'Recibido' && (
              esStaff ? (
                decisionProcedencia === null ? (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-qms-primary-soft p-3">
                      <p className="text-sm font-semibold text-blue-900 leading-relaxed">¿La queja procede?</p>
                      <p className="text-xs text-blue-900 leading-relaxed mt-0.5">Elegí si la queja procede y pasa a investigación, o no procede y se cierra.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button onClick={() => setDecisionProcedencia('procede')}>Procede</Button>
                      <Button variant="danger" onClick={() => setDecisionProcedencia('no_procede')}>No Procede</Button>
                    </div>
                  </>
                ) : decisionProcedencia === 'no_procede' ? (
                  <>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-900 leading-relaxed">Marcar como No Procede</p>
                      <p className="text-xs text-red-900 leading-relaxed mt-0.5">La queja se cerrará como «No Procede». La justificación / resolución es obligatoria.</p>
                    </div>
                    <textarea
                      placeholder="Justificación / Resolución (Obligatorio)"
                      rows={4}
                      className="ui-textarea w-full px-3 py-2 text-sm"
                      value={justificacion}
                      onChange={(e) => { draftVersions.current.workflow++; setJustificacion(e.target.value) }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="danger" onClick={handleGuardarNoProcede} loading={loading}>Guardar</Button>
                      <Button variant="ghost" onClick={() => { draftVersions.current.workflow++; setDecisionProcedencia(null); setJustificacion('') }}>Volver</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-qms-primary-soft p-3">
                      <p className="text-sm font-semibold text-blue-900 leading-relaxed">Asignar responsable</p>
                      <p className="text-xs text-blue-900 leading-relaxed mt-0.5">La justificación es obligatoria. Seleccioná quién investigará la queja; al guardar inicia el plazo de 15 días.</p>
                    </div>
                    <textarea
                      placeholder="Justificación (Obligatorio)"
                      rows={3}
                      className="ui-textarea w-full px-3 py-2 text-sm"
                      value={justificacion}
                      onChange={(e) => { draftVersions.current.workflow++; setJustificacion(e.target.value) }}
                    />
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider sm:w-36 shrink-0">Responsable *</label>
                      <BuscadorResponsable responsables={responsables} value={responsableValue} onChange={handleSeleccionarResponsable} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={handleGuardarProcede} loading={loading}>Guardar</Button>
                      <Button variant="ghost" onClick={() => { draftVersions.current.workflow++; setDecisionProcedencia(null); setJustificacion(''); setResponsableSeleccionado(null) }}>Volver</Button>
                    </div>
                  </>
                )
              ) : (
                <p className="text-sm text-gray-500">Solo el personal de calidad puede decidir la procedencia de la queja.</p>
              )
            )}

            {/* ── EN INVESTIGACIÓN: adjuntos + resolver ── */}
            {estadoActual === 'En Investigación' && (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</p>
                    <p className="text-sm font-medium text-gray-900">{responsableActual?.nombre ?? 'Sin asignar'}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">El responsable queda fijo durante la investigación. No se puede modificar.</p>
                </div>

                {!resolucionAbierta ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => { draftVersions.current.workflow++; setResolucionAbierta(true) }}>Resolver</Button>
                    {!queja.derivado_sacp_id && (
                      <Button variant="secondary" onClick={handleDerivarSACP} loading={derivando}>
                        <GitBranch className="h-3.5 w-3.5" /> Derivar a SACP
                      </Button>
                    )}
                    {queja.derivado_sacp_id && <Badge variant="blue">Derivada a SACP</Badge>}
                  </div>
                ) : (
                  <>
                    <textarea
                      placeholder="Análisis / Resolución Final (Obligatorio)"
                      rows={4}
                      className="ui-textarea w-full px-3 py-2 text-sm"
                      value={resolucion}
                      onChange={(e) => { draftVersions.current.workflow++; setResolucion(e.target.value) }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={handleConfirmarResolucion} loading={loading}>Confirmar resolución</Button>
                      <Button variant="ghost" onClick={() => { draftVersions.current.workflow++; setResolucionAbierta(false); setResolucion('') }}>Volver</Button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── PENDIENTE DE REVISIÓN GC (expedientes heredados) ── */}
            {estadoActual === 'Pendiente de Revisión GC' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <p className="text-sm font-semibold text-purple-900 leading-relaxed">Resolución enviada a revisión</p>
                  <p className="text-xs text-purple-900 leading-relaxed mt-0.5">El responsable envió su resolución. Aprobalo para resolver la queja o devolvela a investigación.</p>
                </div>
                {queja.resolucion && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resolución del colaborador</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{queja.resolucion}</p>
                  </div>
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
            {estadoActual === 'Resuelto' && (
              esStaff ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleFinalizar} loading={loading}>Finalizar</Button>
                  <Button variant="secondary" onClick={() => { draftVersions.current.workflow++; setReaperturaAbierta(true) }}>
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
            {estadoActual === 'Finalizado' && (
              esStaff ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => { draftVersions.current.workflow++; setReaperturaAbierta(true) }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir queja
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Queja finalizada.</p>
              )
            )}

            {(estadoActual === 'No Procede' || estadoActual === 'Finalizado') && (
              <p className="text-sm text-gray-500">
                {estadoActual === 'No Procede'
                  ? 'Queja cerrada como No Procede.'
                  : 'Queja finalizada.'}
                {queja.fecha_cierre && <> Cierre: {new Date(queja.fecha_cierre).toLocaleDateString('es-ES')}.</>}
              </p>
            )}

            {reaperturaAbierta && esStaff && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Reabrir queja</p>
                <p className="text-xs text-amber-900">La queja volverá a «En Investigación» con un nuevo plazo de 15 días. El motivo es obligatorio y quedará en las notas.</p>
                <textarea
                  placeholder="Motivo de la reapertura..."
                  rows={2}
                  className="ui-textarea w-full px-3 py-2 text-sm"
                  value={motivoReapertura}
                  onChange={(e) => { draftVersions.current.workflow++; setMotivoReapertura(e.target.value) }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleReabrir} loading={reabriendo}>Confirmar reapertura</Button>
                  <Button variant="ghost" onClick={() => { draftVersions.current.workflow++; setReaperturaAbierta(false) }}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sección 4: Comentarios y notas internas */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
          <p className="text-base font-semibold text-gray-800 mb-2">Comentarios y notas internas</p>

          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {comentariosLoading ? <LoadingSkeleton variant="list" label="Cargando comentarios…" framed={false} /> : comentarios.length === 0 ? (
              <p className="text-sm text-gray-400">Sin comentarios todavía.</p>
            ) : comentarios.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-2.5 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={c.tipo === 'cliente' ? 'blue' : 'gray'}>{c.tipo === 'cliente' ? 'Cliente' : 'Interno'}</Badge>
                  {c.visible_cliente && <Badge variant="green">Visible al quejoso</Badge>}
                  <span className="text-xs text-gray-400">{new Date(c.fecha).toLocaleString('es-ES')}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comentario}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <textarea
              placeholder="Nuevo comentario..."
              rows={2}
              className="ui-textarea w-full px-3 py-2 text-sm"
              value={nuevoComentario}
              onChange={(e) => { draftVersions.current.comentario++; setNuevoComentario(e.target.value) }}
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <Select className="w-full" value={comentarioTipo} onChange={(e) => { draftVersions.current.comentario++; setComentarioTipo(e.target.value as 'interno' | 'cliente') }}>
                <option value="interno">Interno</option>
                <option value="cliente">Cliente</option>
              </Select>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={visibleCliente} onChange={(e) => { draftVersions.current.comentario++; setVisibleCliente(e.target.checked) }} />
                Visible al quejoso
              </label>
              <Button size="sm" onClick={handleAgregarComentario} loading={agregandoComentario} disabled={!nuevoComentario.trim()}><Send className="h-3 w-3" /> Agregar</Button>
            </div>
          </div>
        </div>
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

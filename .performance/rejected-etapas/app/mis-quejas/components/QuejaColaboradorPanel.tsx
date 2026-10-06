'use client'

import ErrorState from '@/components/ui/ErrorState'

import { CButton, CFormTextarea, CFormLabel, CCard, CNav, CNavLink, CAlert } from '@coreui/react'
import styles from './QuejaColaboradorPanel.module.css'
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Info, Activity, CheckCircle, Send, Loader2, Maximize, Minimize, FileText, ArrowLeft, Sparkles, Edit, Eye as EyeIcon, Upload } from '@/components/ui/icons'
import type { Queja } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import { prioridadVariant } from '@/lib/constants/variants'
import { useQuejaActividad, useCrearQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { useQuejaAdjuntos, quejaAdjuntosKey, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { transicionarQueja, descargarAdjuntoQueja, subirAdjuntoQueja, eliminarAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { analizarIA } from '@/lib/services/aiService'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import ReactMarkdown from 'react-markdown'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: (updated?: Partial<Queja> & Pick<Queja, 'id'>) => void
}

type Tab = 'detalle' | 'actividad' | 'resolucion'

const ESTADOS_ENVIADOS = ['quality_review', 'resolved', 'finished']

export default function QuejaColaboradorPanel({ queja, onClose, onUpdated }: Props) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('detalle')
  const [resolucion, setResolucion] = useState('')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [previewAdjunto, setPreviewAdjunto] = useState<QuejaAdjunto | null>(null)
  const [aiAutoLoading, setAiAutoLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [chat, setChat] = useState<{ id: string; role: 'user' | 'ia'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [subiendoAdjuntoAnalisis, setSubiendoAdjuntoAnalisis] = useState(false)
  const [eliminandoAdjunto, setEliminandoAdjunto] = useState<string | null>(null)
  const [confirmarEliminacion, setConfirmarEliminacion] = useState<string | null>(null)
  const [agregandoNota, setAgregandoNota] = useState(false)

  const quejaId = queja?.id ?? ''
  const requestScope = useEntityRequestGuard(quejaId || null)
  const closePanel = useCallback(() => {
    requestScope.invalidate()
    onClose()
  }, [requestScope, onClose])
  const { data: actividad = [], isLoading: actividadLoading, error: actividadError, refetch: retryActividad } = useQuejaActividad(quejaId)
  const crearActividad = useCrearQuejaActividad()
  const { data: adjuntos = [], isLoading: adjuntosLoading, error: adjuntosError, refetch: retryAdjuntos } = useQuejaAdjuntos(quejaId)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) closePanel()
    }
    if (quejaId) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [quejaId, closePanel])

  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setResolucion('')
    setNota('')
    setIsExpanded(false)
    setPreviewAdjunto(null)
    setAiResult('')
    setChat([])
    setConfirmarEliminacion(null)
    setEliminandoAdjunto(null)
    setChatInput('')
    setAiAutoLoading(false)
    setChatLoading(false)
    setLoading(false)
    setAgregandoNota(false)
    setSubiendoAdjuntoAnalisis(false)
    setModoEdicion(false)
  }

  if (!queja) return null

  const estado = queja.estado_codigo ?? ''
  const resolucionEnviada = ESTADOS_ENVIADOS.includes(estado)

  const handleEnviarRevision = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí la conclusión antes de enviarla a revisión')
      return
    }
    const isCurrent = requestScope.capture()
    setLoading(true)
    try {
      const updated = await transicionarQueja(queja.id, 'quality_review', { revision: queja.revision, resolucion })
      // Los datos confirmados se actualizan siempre, aunque el usuario abra otro expediente.
      onUpdated(updated)
      if (!isCurrent()) return
      showSuccess('Resolución enviada a Gestión de Calidad')
      setResolucion((current) => current === resolucion ? '' : current)
    } catch (error) {
      if (isCurrent()) showError(error as Error, 'No se pudo enviar la resolución')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }

  const handleAnalisisAuto = async () => {
    const isCurrent = requestScope.capture()
    setAiAutoLoading(true)
    setAiResult('')
    try {
      const txt = await analizarIA({ modulo: 'quejas', entidad_id: queja.id, tipo_consulta: 'auto' })
      if (isCurrent()) setAiResult(txt)
    } catch (e) {
      if (!isCurrent()) return
      const errorMsg = e instanceof Error ? e.message : 'No se pudo generar el análisis IA'
      showError(e as Error, errorMsg)
      setAiResult('')
    } finally {
      if (isCurrent()) setAiAutoLoading(false)
    }
  }

  const handleEnviarIA = async () => {
    const msg = chatInput.trim()
    if (!msg) return
    const isCurrent = requestScope.capture()
    const messageId = crypto.randomUUID()
    setChat((c) => [...c, { id: messageId, role: 'user', content: msg }])
    setChatInput('')
    setChatLoading(true)
    try {
      const txt = await analizarIA({ modulo: 'quejas', entidad_id: queja.id, tipo_consulta: 'custom', prompt_usuario: msg })
      if (isCurrent()) setChat((c) => [...c, { id: crypto.randomUUID(), role: 'ia', content: txt }])
    } catch (e) {
      if (!isCurrent()) return
      const errorMsg = e instanceof Error ? e.message : 'No se pudo obtener respuesta de IA'
      showError(e as Error, errorMsg)
      setChat((c) => c.filter((message) => message.id !== messageId))
    } finally {
      if (isCurrent()) setChatLoading(false)
    }
  }

  const handleAgregarNota = async () => {
    if (!nota.trim()) return
    const isCurrent = requestScope.capture()
    setAgregandoNota(true)
    try {
      await crearActividad.mutateAsync({ quejaId: queja.id, descripcion: nota, usuarioId: user?.id ?? null })
      if (!isCurrent()) return
      showSuccess('Nota agregada a la actividad')
      setNota((current) => current === nota ? '' : current)
    } catch (error) {
      if (isCurrent()) showError(error as Error, 'No se pudo agregar la nota')
    } finally {
      if (isCurrent()) setAgregandoNota(false)
    }
  }

  const handleSubirAdjuntoAnalisis = async (file: File) => {
    const isCurrent = requestScope.capture()
    setSubiendoAdjuntoAnalisis(true)
    try {
      await subirAdjuntoQueja(queja.id, file)
      queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(queja.id) })
      if (isCurrent()) showSuccess('Adjunto de análisis subido')
    } catch (error) {
      if (isCurrent()) showError(error as Error, 'No se pudo subir el adjunto de análisis')
    } finally {
      if (isCurrent()) setSubiendoAdjuntoAnalisis(false)
    }
  }

  const handleEliminarAdjunto = async (adjuntoId: string) => {
    const isCurrent = requestScope.capture()
    setEliminandoAdjunto(adjuntoId)
    try {
      await eliminarAdjuntoQueja(adjuntoId)
      queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(queja.id) })
      if (!isCurrent()) return
      showSuccess('Adjunto eliminado')
      setConfirmarEliminacion((current) => current === adjuntoId ? null : current)
    } catch (error) {
      if (isCurrent()) showError(error as Error, 'No se pudo eliminar el adjunto')
    } finally {
      if (isCurrent()) setEliminandoAdjunto((current) => current === adjuntoId ? null : current)
    }
  }

  const handleDescargarAdjunto = async (adjunto: QuejaAdjunto) => {
    const isCurrent = requestScope.capture()
    try {
      await descargarAdjuntoQueja(adjunto)
    } catch (error) {
      if (isCurrent()) showError(error as Error, 'No se pudo descargar el archivo')
    }
  }

  const puedeEliminarAdjunto = (adjunto: QuejaAdjunto): boolean => {
    if (adjunto.usuario_id === null) return user?.rol === 'admin'
    return user?.rol === 'admin' || user?.rol === 'calidad' || queja.responsable_id === user?.id
  }

  const tabs: { key: Tab; label: string; icon: typeof Info }[] = [
    { key: 'detalle', label: 'Detalle', icon: Info },
    { key: 'actividad', label: 'Análisis', icon: Activity },
    { key: 'resolucion', label: 'Resolución', icon: CheckCircle },
  ]

  return (
    <aside className={`${styles.panel} ${isExpanded ? styles.expanded : ''}`} aria-label={`Expediente ${queja.folio}`}>
      <div className={styles.toolbar}>
        <CButton color="secondary" variant="ghost" onClick={closePanel}><ArrowLeft size={18} /> Mis Quejas</CButton>
        <div className="d-flex gap-1">
          <CButton color="secondary" variant="ghost" onClick={() => setIsExpanded(v => !v)} aria-label={isExpanded ? 'Reducir panel' : 'Expandir panel'} title={isExpanded ? 'Reducir panel' : 'Expandir panel'}>
            {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
          </CButton>
          <CButton color="secondary" variant="ghost" onClick={closePanel} aria-label="Cerrar panel" title="Cerrar panel"><X size={20} /></CButton>
        </div>
      </div>
      <div className={styles.identity}>
        <div className={styles.identityRow}><span className={styles.identityIcon}><FileText size={24} /></span><div><h1>{queja.folio}</h1><p>{queja.cliente_nombre}</p></div></div>
        <div className="d-flex flex-wrap gap-2"><Badge variant={queja.estado_color}>{queja.estado_nombre}</Badge><Badge variant={prioridadVariant[queja.prioridad] || 'gray'}>Prioridad {queja.prioridad}</Badge></div>
      </div>
      <CNav as="nav" variant="underline-border" className={styles.tabs} aria-label="Secciones del expediente">
        {tabs.map(t => { const Icon = t.icon; return <CNavLink key={t.key} as="button" active={activeTab === t.key} aria-current={activeTab === t.key ? 'page' : undefined} onClick={() => setActiveTab(t.key)}><Icon size={18} />{t.label}</CNavLink> })}
      </CNav>
      <div className={styles.body}>
        {activeTab === 'detalle' && (
          <div className={styles.content}>
            <CCard className={styles.section}>
              <dl className={styles.metadata}>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Folio</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900">{queja.folio}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{queja.cliente_nombre}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Fecha de creación</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{new Date(queja.fecha).toLocaleString('es-ES')}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Categoría</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{queja.categoria}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">SLA</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {queja.fecha_sla ? new Date(queja.fecha_sla).toLocaleDateString('es-ES') : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Límite de investigación</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {queja.fecha_limite_investigacion ? new Date(queja.fecha_limite_investigacion).toLocaleDateString('es-ES') : '—'}
                  </dd>
                </div>
              </dl>
            </CCard>

            <CCard className={styles.section}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Descripción</h2>
              {queja.descripcion ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{queja.descripcion}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Sin descripción.</p>
              )}
            </CCard>

            {queja.notas && (
              <CCard className={`${styles.section} ${styles.note}`}>
                <h2 className="text-xs font-medium uppercase tracking-wider text-body">Justificación de Gestión de Calidad</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-body">{queja.notas}</p>
              </CCard>
            )}

            <CCard className={styles.section}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Evidencias adjuntas</h2>
              {adjuntosError ? <ErrorState error={adjuntosError} title="No se pudieron cargar las evidencias" onRetry={() => void retryAdjuntos()} /> : adjuntosLoading ? <div className="flex items-center justify-center py-3" role="status"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div> : adjuntos.length === 0 ? (
                <p className={styles.empty}>Sin evidencias adjuntas.</p>
              ) : (
                <ListaAdjuntos
                  adjuntos={adjuntos}
                  onPreview={(a) => setPreviewAdjunto(a)}
                  onDownload={handleDescargarAdjunto}
                  puedeEliminar={puedeEliminarAdjunto}
                  onEliminar={(a) => setConfirmarEliminacion(a.id)}
                />
              )}
            </CCard>
          </div>
        )}

        {activeTab === 'actividad' && (
          <div className={styles.content}>
            <div className={styles.sectionIntro}><h2>Análisis</h2><p>Registrá avances y comentarios de tu investigación.</p></div>

            <CCard className={styles.section}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-qms-primary" />
                <h2 className="mb-0">Asistente IA</h2>
              </div>
              <p className="mt-1 text-xs text-body-secondary">Resume los antecedentes y las evidencias para apoyar tu investigación.</p>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={handleAnalisisAuto} loading={aiAutoLoading}>
                  <Sparkles className="h-3.5 w-3.5" /> Generar análisis
                </Button>
              </div>
              {aiAutoLoading && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-qms-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Obteniendo contexto y consultando a la IA…
                </div>
              )}
              {aiResult && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-gray-500">Resultado del análisis</h3>
                    <Button
                      variant="secondary"
                      onClick={() => setModoEdicion(!modoEdicion)}
                      className="gap-1.5"
                    >
                      {modoEdicion ? (
                        <span className="flex items-center gap-1.5">
                          <EyeIcon className="h-3.5 w-3.5" />
                          Vista Lectura
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Edit className="h-3.5 w-3.5" />
                          Editar
                        </span>
                      )}
                    </Button>
                  </div>
                  {modoEdicion ? (
                    <CFormTextarea
                      className="w-full min-h-[500px] p-6 resize-y font-sans leading-relaxed whitespace-pre-wrap"
                      value={aiResult}
                      onChange={(e) => setAiResult(e.target.value)}
                      placeholder="El análisis de la IA aparecerá aquí..."
                    />
                  ) : (
                    <CCard className={styles.markdown}>
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                          ),
                        }}
                      >
                        {aiResult}
                      </ReactMarkdown>
                    </CCard>
                  )}
                </div>
              )}
              {chat.length > 0 && (
                <div className="mt-4 space-y-2">
                  {chat.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-qms-primary text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {chatLoading && (
                <div className="mt-2 flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analizando…
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-end gap-2">
                <CFormTextarea
                  rows={2}
                  placeholder="Hacé una pregunta sobre esta queja..."
                  className="flex-1 resize-none px-3 py-2 transition-colors placeholder:text-gray-400"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <Button onClick={handleEnviarIA} loading={chatLoading} disabled={!chatInput.trim()}>
                  <Send className="h-3.5 w-3.5" /> Enviar
                </Button>
              </div>
            </CCard>

            <CCard className={styles.section}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Agregar nota</h2>
              <CFormTextarea
                rows={2}
                placeholder="Registrá un avance o comentario de tu investigación..."
                className="mt-2 w-full resize-none px-3 py-2 transition-colors placeholder:text-gray-400"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={handleAgregarNota} disabled={!nota.trim()} loading={agregandoNota}>
                  <Send className="h-3 w-3" /> Agregar nota
                </Button>
              </div>
            </CCard>

            <CCard className={styles.section}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Evidencias de análisis</h2>
                <span className="text-xs text-gray-400">{adjuntos.filter((a) => a.usuario_id).length} archivo(s)</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Archivos internos de investigación. Solo visibles para staff y responsable.</p>
              
              {adjuntosError ? <ErrorState error={adjuntosError} title="No se pudieron cargar las evidencias de análisis" onRetry={() => void retryAdjuntos()} /> : adjuntosLoading ? <div className="flex items-center justify-center py-3" role="status"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div> : adjuntos.filter((a) => a.usuario_id).length === 0 ? (
                <p className={styles.empty}>Sin evidencias de análisis.</p>
              ) : (
                <ListaAdjuntos
                  adjuntos={adjuntos.filter((a) => a.usuario_id)}
                  onPreview={(a) => setPreviewAdjunto(a)}
                  onDownload={handleDescargarAdjunto}
                  puedeEliminar={puedeEliminarAdjunto}
                  onEliminar={(a) => setConfirmarEliminacion(a.id)}
                />
              )}
              
              {estado === 'investigation' && (
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
                  <CFormLabel className="btn btn-outline-primary d-inline-flex align-items-center gap-2 mb-0">
                    <Upload className="h-3.5 w-3.5" /> Subir evidencia de análisis
                    <input
                      type="file"
                      className="hidden"
                      disabled={subiendoAdjuntoAnalisis}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) handleSubirAdjuntoAnalisis(f)
                      }}
                    />
                  </CFormLabel>
                  {subiendoAdjuntoAnalisis && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo...
                    </span>
                  )}
                </div>
              )}
            </CCard>

            <CCard className={styles.section}><h2>Actividad de la investigación</h2>
            {actividadError ? <ErrorState error={actividadError} title="No se pudo cargar la actividad" onRetry={() => void retryActividad()} /> : actividadLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : actividad.length === 0 ? (
              <p className={styles.empty}>Sin actividad registrada todavía.</p>
            ) : (
              <div className={styles.timeline}>
                {actividad.map((a) => (
                  <div key={a.id} className={styles.timelineItem}>
                    <span className={styles.timelineIcon}><Activity size={16} /></span>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineMeta}>
                        <span className="text-xs font-medium text-gray-500">{a.tipo}</span>
                        <span className="shrink-0 text-xs text-gray-400">{new Date(a.created_at).toLocaleString('es-ES')}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{a.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CCard>
          </div>
        )}

        {activeTab === 'resolucion' && (
          <div className={styles.content}>
            <div className={styles.sectionIntro}><h2>Resolución</h2><p>Documentá la conclusión de tu investigación.</p></div>

            <CCard className={styles.section}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Conclusión de la investigación</h2>
              <CFormTextarea
                rows={7}
                placeholder="Documentá la conclusión y los hallazgos de tu investigación..."
                className="mt-2 w-full resize-none px-3 py-2 transition-colors placeholder:text-gray-400 disabled:cursor-not-allowed"
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                disabled={estado === 'received' || resolucionEnviada}
              />

              {resolucionEnviada && (
                <CAlert color="primary" className="mt-3 mb-0">
                  <p className="text-sm font-medium text-body">Resolución enviada a Calidad</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-body">
                    La queja está en «Pendiente de Revisión GC». Esperá la aprobación o devolución de Gestión de Calidad.
                  </p>
                </CAlert>
              )}

              {queja.resolucion && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Resolución enviada</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{queja.resolucion}</p>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                {estado === 'investigation' ? (
                  <Button onClick={handleEnviarRevision} loading={loading} disabled={!resolucion.trim()}>
                    Enviar a Revisión GC
                  </Button>
                ) : (
                  <Button disabled>Enviar a Revisión GC</Button>
                )}
              </div>
            </CCard>
          </div>
        )}
      </div>

      <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />

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
    </aside>
  )
}

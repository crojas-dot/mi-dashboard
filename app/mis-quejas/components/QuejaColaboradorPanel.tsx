'use client'

import { useEffect, useState } from 'react'
import { X, Info, Activity, CheckCircle, Send, Loader2, Maximize, Download, Eye, FileText, Sparkles, Edit, Eye as EyeIcon } from 'lucide-react'
import type { Queja } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import { useQuejaActividad, useCrearQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { useQuejaAdjuntos, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { transicionarQueja, descargarAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { analizarIA } from '@/lib/services/aiService'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import ReactMarkdown from 'react-markdown'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: () => void
}

type Tab = 'detalle' | 'actividad' | 'resolucion'

const ESTADOS_ENVIADOS = ['Pendiente de Revisión GC', 'Resuelto', 'Finalizado']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const estadoVariant: Record<string, string> = {
  Recibido: 'gray', 'No Procede': 'red', 'En Investigación': 'amber',
  'Pendiente de Revisión GC': 'purple', Resuelto: 'green', Finalizado: 'gray',
}

const prioridadVariant: Record<string, string> = { Baja: 'blue', Media: 'amber', Alta: 'orange', Crítica: 'red' }

export default function QuejaColaboradorPanel({ queja, onClose, onUpdated }: Props) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('detalle')
  const [resolucion, setResolucion] = useState('')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [previewAdjunto, setPreviewAdjunto] = useState<QuejaAdjunto | null>(null)
  const [aiAutoLoading, setAiAutoLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [chat, setChat] = useState<{ role: 'user' | 'ia'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)

  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading } = useQuejaActividad(quejaId)
  const crearActividad = useCrearQuejaActividad()
  const { data: adjuntos = [] } = useQuejaAdjuntos(quejaId)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (queja) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [queja, onClose])

  const [prevQuejaId, setPrevQuejaId] = useState<string | null>(queja?.id ?? null)
  if ((queja?.id ?? null) !== prevQuejaId) {
    setPrevQuejaId(queja?.id ?? null)
    setResolucion('')
    setNota('')
    setIsExpanded(false)
    setPreviewAdjunto(null)
    setAiResult('')
    setChat([])
    setChatInput('')
    setAiAutoLoading(false)
    setChatLoading(false)
  }

  if (!queja) return null

  const estado = queja.estado ?? ''
  const resolucionEnviada = ESTADOS_ENVIADOS.includes(estado)

  const handleEnviarRevision = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí la conclusión antes de enviarla a revisión')
      return
    }
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'Pendiente de Revisión GC', { resolucion })
      showSuccess('Resolución enviada a Gestión de Calidad')
      setResolucion('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo enviar la resolución')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalisisAuto = async () => {
    setAiAutoLoading(true)
    setAiResult('')
    try {
      const txt = await analizarIA({ modulo: 'quejas', entidad_id: queja.id, tipo_consulta: 'auto' })
      setAiResult(txt)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'No se pudo generar el análisis IA'
      showError(e as Error, errorMsg)
      setAiResult('')
    } finally {
      setAiAutoLoading(false)
    }
  }

  const handleEnviarIA = async () => {
    const msg = chatInput.trim()
    if (!msg) return
    setChat((c) => [...c, { role: 'user', content: msg }])
    setChatInput('')
    setChatLoading(true)
    try {
      const txt = await analizarIA({ modulo: 'quejas', entidad_id: queja.id, tipo_consulta: 'custom', prompt_usuario: msg })
      setChat((c) => [...c, { role: 'ia', content: txt }])
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'No se pudo obtener respuesta de IA'
      showError(e as Error, errorMsg)
      setChat((c) => c.slice(0, -1))
    } finally {
      setChatLoading(false)
    }
  }

  const handleAgregarNota = async () => {
    if (!nota.trim()) return
    try {
      await crearActividad.mutateAsync({ quejaId: queja.id, descripcion: nota, usuarioId: user?.id ?? null })
      showSuccess('Nota agregada a la actividad')
      setNota('')
    } catch (error) {
      showError(error as Error, 'No se pudo agregar la nota')
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Info }[] = [
    { key: 'detalle', label: 'Detalle', icon: Info },
    { key: 'actividad', label: 'Análisis', icon: Activity },
    { key: 'resolucion', label: 'Resolución', icon: CheckCircle },
  ]

  return (
    <aside
      className={`fixed top-0 right-0 z-50 flex h-screen flex-col bg-white border-l border-gray-200 shadow-2xl transition-[width] duration-300 ease-in-out ${isExpanded ? 'w-full' : 'w-[500px]'}`}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center text-sm">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded px-2 py-1 font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Mis Quejas
          </button>
          <span className="mx-1 text-gray-300">/</span>
          <span className="px-2 py-1 font-medium text-gray-900">{queja.folio}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? 'Reducir panel' : 'Expandir panel'}
            className={`cursor-pointer rounded p-1 transition-colors hover:bg-gray-100 ${isExpanded ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'}`}
          >
            <Maximize className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar panel"
            className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Underline tabs */}
      <nav className="flex shrink-0 gap-6 border-b border-gray-200 px-6">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </nav>

      {/* Blank-page content */}
      <div className="flex-1 select-text overflow-y-auto px-8 py-6">
        {activeTab === 'detalle' && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{queja.folio}</h1>
            <p className="mt-1 text-sm text-gray-500">{queja.cliente_nombre}</p>

            <div className="mt-3 flex items-center gap-2">
              <Badge variant={estadoVariant[estado] || 'gray'}>{estado}</Badge>
              <Badge variant={prioridadVariant[queja.prioridad] || 'gray'}>{queja.prioridad}</Badge>
            </div>

            <div className="mt-6 mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
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
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Descripción</h2>
              {queja.descripcion ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{queja.descripcion}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Sin descripción.</p>
              )}
            </div>

            {queja.notas && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-xs font-medium uppercase tracking-wider text-amber-700">Justificación de Gestión de Calidad</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">{queja.notas}</p>
              </div>
            )}

            <div className="mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Evidencias adjuntas</h2>
              {adjuntos.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">Sin evidencias todavía.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {adjuntos.map((a) => (
                    <li key={a.id} className="flex select-text items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setPreviewAdjunto(a)}
                        className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-gray-700 hover:text-blue-700 hover:underline"
                        title="Vista previa"
                      >
                        {a.nombre}
                      </button>
                      <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{formatBytes(a.tamano)}</span>
                      <button type="button" onClick={() => setPreviewAdjunto(a)} className="shrink-0 cursor-pointer text-gray-500 hover:text-blue-600" title="Vista previa">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => descargarAdjuntoQueja(a).catch((e) => showError(e as Error, 'No se pudo descargar el archivo'))}
                        className="shrink-0 cursor-pointer text-gray-500 hover:text-blue-600"
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'actividad' && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Análisis</h1>
            <p className="mt-1 text-sm text-gray-500">Registrá avances y comentarios de tu investigación.</p>

            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: '#0d6efd' }} />
                <h2 className="text-xs font-medium uppercase tracking-wider text-blue-700">Asistente IA</h2>
              </div>
              <p className="mt-1 text-xs text-blue-900/70">Analizá la queja con el proveedor configurado en Configuración → IA.</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={handleAnalisisAuto} loading={aiAutoLoading}>
                  <Sparkles className="h-3.5 w-3.5" /> Análisis IA
                </Button>
              </div>
              {aiAutoLoading && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Obteniendo contexto y consultando a la IA…
                </p>
              )}
              {aiResult && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-gray-500">Resultado del análisis</h3>
                    <Button
                      size="sm"
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
                    <textarea
                      className="w-full min-h-[500px] p-6 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-blue-600 outline-none resize-y shadow-sm font-sans leading-relaxed whitespace-pre-wrap"
                      value={aiResult}
                      onChange={(e) => setAiResult(e.target.value)}
                      placeholder="El análisis de la IA aparecerá aquí..."
                    />
                  ) : (
                    <div className="prose prose-blue max-w-none min-h-[400px] p-6 bg-white border border-gray-200 rounded-lg shadow-sm font-sans leading-relaxed text-gray-800">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                          ),
                        }}
                      >
                        {aiResult}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              {chat.length > 0 && (
                <div className="mt-4 space-y-2">
                  {chat.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>
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
                <textarea
                  rows={2}
                  placeholder="Hacé una pregunta sobre esta queja..."
                  className="flex-1 resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <Button size="sm" onClick={handleEnviarIA} loading={chatLoading} disabled={!chatInput.trim()}>
                  <Send className="h-3.5 w-3.5" /> Enviar
                </Button>
              </div>
            </div>

            <div className="mt-6 mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Agregar nota</h2>
              <textarea
                rows={2}
                placeholder="Registrá un avance o comentario de tu investigación..."
                className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={handleAgregarNota} disabled={!nota.trim()} loading={crearActividad.isPending}>
                  <Send className="h-3 w-3" /> Agregar nota
                </Button>
              </div>
            </div>

            {actividadLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : actividad.length === 0 ? (
              <p className="py-10 text-sm text-gray-400">Sin actividad registrada todavía.</p>
            ) : (
              <div className="relative mb-6 space-y-5">
                {actividad.map((a, i) => (
                  <div key={a.id} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                      {i < actividad.length - 1 && <span className="w-px flex-1 bg-gray-100" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="mb-0.5 flex items-baseline justify-between gap-3">
                        <span className="text-xs font-medium text-gray-500">{a.tipo}</span>
                        <span className="shrink-0 text-xs text-gray-400">{new Date(a.created_at).toLocaleString('es-ES')}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{a.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resolucion' && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Resolución</h1>
            <p className="mt-1 text-sm text-gray-500">Documentá la conclusión de tu investigación.</p>

            <div className="mt-6 mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Conclusión de la investigación</h2>
              <textarea
                rows={7}
                placeholder="Documentá la conclusión y los hallazgos de tu investigación..."
                className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                disabled={estado === 'Recibido' || resolucionEnviada}
              />

              {resolucionEnviada && (
                <div className="mt-3 rounded-md bg-purple-50 px-3 py-2.5">
                  <p className="text-sm font-medium text-purple-900">Resolución enviada a Calidad</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-purple-900">
                    La queja está en «Pendiente de Revisión GC». Esperá la aprobación o devolución de Gestión de Calidad.
                  </p>
                </div>
              )}

              {queja.resolucion && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Resolución enviada</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{queja.resolucion}</p>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                {estado === 'En Investigación' ? (
                  <Button onClick={handleEnviarRevision} loading={loading} disabled={!resolucion.trim()}>
                    Enviar a Revisión GC
                  </Button>
                ) : (
                  <Button disabled>Enviar a Revisión GC</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AdjuntoPreviewModal adjunto={previewAdjunto} onClose={() => setPreviewAdjunto(null)} />
    </aside>
  )
}
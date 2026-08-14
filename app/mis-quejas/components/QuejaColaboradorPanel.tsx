'use client'

import { useEffect, useState } from 'react'
import { X, Info, Activity, CheckCircle, Send, Loader2, Maximize } from 'lucide-react'
import type { Queja } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import { useQuejaActividad, useCrearQuejaActividad } from '@/lib/queries/useQuejaActividad'
import { transicionarQueja } from '@/lib/services/quejaWorkflowService'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: () => void
}

type Tab = 'detalle' | 'actividad' | 'resolucion'

const ESTADOS_ENVIADOS = ['Pendiente de Revisión GC', 'Resuelto', 'Finalizado']

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

  const quejaId = queja?.id ?? ''
  const { data: actividad = [], isLoading: actividadLoading } = useQuejaActividad(quejaId)
  const crearActividad = useCrearQuejaActividad()

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
  }

  if (!queja) return null

  const estado = queja.estado ?? ''
  const resolucionEnviada = ESTADOS_ENVIADOS.includes(estado)

  const handleIniciarInvestigacion = async () => {
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'En Investigación')
      showSuccess('Investigación iniciada. Plazo: 15 días.')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo iniciar la investigación')
    } finally {
      setLoading(false)
    }
  }

  const handleEnviarRevision = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí la conclusión antes de enviarla a revisión')
      return
    }
    setLoading(true)
    try {
      await transicionarQueja(queja.id, 'Pendiente de Revisión GC', resolucion)
      showSuccess('Resolución enviada a Gestión de Calidad')
      setResolucion('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo enviar la resolución')
    } finally {
      setLoading(false)
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
    { key: 'actividad', label: 'Actividad', icon: Activity },
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
          </div>
        )}

        {activeTab === 'actividad' && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Actividad</h1>
            <p className="mt-1 text-sm text-gray-500">Registrá avances y comentarios de tu investigación.</p>

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

            {estado === 'Recibido' && (
              <div className="mt-6 mb-6 rounded-xl border border-gray-200 bg-slate-50 p-5">
                <p className="mb-3 text-sm text-gray-600">
                  Iniciá la investigación de esta queja antes de documentar la resolución. Tenés 15 días.
                </p>
                <Button onClick={handleIniciarInvestigacion} loading={loading}>Iniciar investigación</Button>
              </div>
            )}

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
    </aside>
  )
}

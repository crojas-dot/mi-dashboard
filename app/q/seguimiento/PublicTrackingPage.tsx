'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Link as LinkIcon, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { consultarSeguimiento } from '@/lib/services/publicTrackingClient'
import type { PublicTrackingStatus } from '@/lib/types/publicTracking'

const date = (value: string) => new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' })

export default function PublicTrackingPage({ available = true }: { available?: boolean } = {}) {
  const [status, setStatus] = useState<PublicTrackingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const request = useRef<AbortController | null>(null)
  const activeKey = useRef('')
  const initialKey = useRef('')
  const lastRequestKey = useRef('')

  async function consultar(key: string, reference?: string) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    lastRequestKey.current = key
    activeKey.current = ''
    setStatus(null); setLoading(true); setError(''); setCanRetry(false)
    try {
      const next = await consultarSeguimiento(key, reference, controller.signal)
      if (request.current !== controller || controller.signal.aborted) return
      activeKey.current = key
      setStatus(next)
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) {
        setError(failure instanceof Error ? failure.message : 'No se pudo consultar el trámite.')
        setCanRetry(true)
      }
    } finally { if (request.current === controller && !controller.signal.aborted) setLoading(false) }
  }

  useEffect(() => {
    // El fragmento no se envía al servidor. Retirarlo reduce su permanencia en el historial.
    const consumeLink = (initial = false) => {
      const fragment = window.location.hash
      const key = fragment ? new URLSearchParams(fragment.slice(1)).get('clave') ?? '' : initial ? initialKey.current : ''
      if (fragment) window.history.replaceState(null, '', window.location.pathname + window.location.search)
      initialKey.current = key
      if (!available) return
      if (key && key.length <= 1024) { void consultar(key) }
      else if (fragment) {
        request.current?.abort(); activeKey.current = ''; lastRequestKey.current = ''
        setStatus(null); setLoading(false); setCanRetry(false)
        setError('Revisá el enlace privado recibido por correo.')
      }
    }
    const onHashChange = () => consumeLink()
    consumeLink(true)
    window.addEventListener('hashchange', onHashChange)
    return () => { window.removeEventListener('hashchange', onHashChange); request.current?.abort(); activeKey.current = '' }
  }, [available])

  return <main className="min-h-dvh bg-qms-bg px-4 py-6 sm:py-10">
    <div className="mx-auto min-w-0 max-w-3xl space-y-5 [overflow-wrap:anywhere]">
      <header className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-qms-primary font-semibold text-white">E</span><div><p className="font-semibold text-qms-dark">QMS ECA</p><p className="text-sm text-qms-muted">Gestión de Calidad</p></div></header>
      <section className="ui-panel p-5 sm:p-6">
        <div className="mb-5"><h1 className="text-xl font-semibold text-qms-dark">Seguimiento de tu trámite</h1><p className="mt-2 text-sm leading-relaxed text-qms-muted">Consultá el avance y la respuesta de Gestión de Calidad desde tu enlace de seguimiento.</p></div>
        {!available ? <div role="status" className="space-y-3 rounded-card bg-qms-hover-bg p-4 text-sm leading-relaxed text-qms-muted">
          <p className="font-medium text-qms-dark">La consulta en línea todavía no está habilitada.</p>
          <p>Esto no afecta el registro de tu queja. Conservá tu consecutivo para consultar con Gestión de Calidad.</p>
        </div> : !status && !loading && <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-card bg-qms-hover-bg p-4">
            <LinkIcon className="mt-0.5 size-5 shrink-0 text-qms-primary" aria-hidden="true" />
            <div className="space-y-2 text-sm leading-relaxed"><p className="font-medium text-qms-dark">Abrí el enlace de tu correo de confirmación</p><p className="text-qms-muted">El botón «Consultar mi trámite» abre tu expediente automáticamente. No necesitás crear una cuenta ni ingresar una contraseña.</p><p className="text-xs text-qms-muted">Si recargaste esta página, volvé a abrir el enlace del correo o el que guardaste al enviar tu queja.</p></div>
          </div>
          {error && canRetry && <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void consultar(lastRequestKey.current)}>Reintentar consulta</Button>}
        </div>}
        {loading && <LoadingSkeleton variant="list" label="Consultando tu trámite…" framed={false} />}
        {status && <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-qms-border pb-5"><div><p className="text-sm text-qms-muted">Número de registro</p><h2 className="mt-1 break-all font-mono text-2xl font-semibold text-qms-primary">{status.folio}</h2><p className="mt-2 text-sm text-qms-muted">Recibido el {date(status.recibido_at)}</p></div><Badge variant="neutral" className="max-w-full whitespace-normal!">{status.estado === 'Pendiente de Revisión GC' ? 'En revisión por Calidad' : status.estado}</Badge></div>
          <ol aria-label="Avance del trámite" className="grid gap-3 sm:grid-cols-2">{status.etapas.map((step, index) => <li key={`${index}-${step.nombre}`} className="flex min-w-0 items-start gap-3 rounded-card border border-qms-border bg-qms-primary-soft p-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-qms-success text-white"><Check className="size-4" aria-hidden="true" /></span><div><p className="text-base font-semibold text-qms-dark">{step.nombre}</p>{step.fecha && <p className="mt-1 text-sm text-qms-muted">{date(step.fecha)}</p>}</div></li>)}</ol>
          {status.respuesta && <section className="border-t border-qms-border pt-5"><h3 className="font-semibold">Respuesta de Gestión de Calidad</h3><p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed">{status.respuesta}</p>{status.numero_oficio && <p className="mt-4 text-sm text-qms-muted">Oficio: <span className="font-medium text-qms-dark">{status.numero_oficio}</span></p>}</section>}
          <div className="flex flex-wrap gap-2 border-t border-qms-border pt-4"><Button size="sm" variant="secondary" onClick={() => void consultar(activeKey.current)}><RefreshCw className="size-4" aria-hidden="true" /> Actualizar estado</Button></div>
        </div>}
        {error && <p role="alert" className="mt-4 text-sm text-qms-danger">{error}</p>}

      </section>
      <p className="text-center text-xs leading-relaxed text-qms-muted">El acceso vence 30 días naturales después del cierre. El informe de respuesta se envía adjunto a tu correo. Para consultas: gc@eca.or.cr.</p>
    </div>
  </main>
}

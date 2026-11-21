'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { consultarSeguimiento } from '@/lib/services/publicTrackingClient'
import type { PublicTrackingStatus } from '@/lib/types/publicTracking'
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'
import PublicQmsHeader from '@/app/q/components/PublicQmsHeader'

const date = (value: string) => new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' })

export default function PublicTrackingPage({ available = true, initialLogo }: { available?: boolean; initialLogo?: string } = {}) {
  const { data: identidad } = useIdentidadImagenes(initialLogo === undefined)
  const logoFormulario = initialLogo ?? identidad?.formulario_encabezado ?? ''
  const [status, setStatus] = useState<PublicTrackingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const request = useRef<AbortController | null>(null)
  const initialKey = useRef('')
  const lastRequestKey = useRef('')

  async function consultar(key: string, reference?: string) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    lastRequestKey.current = key
    setStatus(null); setLoading(true); setError(''); setCanRetry(false)
    try {
      const next = await consultarSeguimiento(key, reference, controller.signal)
      if (request.current !== controller || controller.signal.aborted) return
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
        request.current?.abort(); lastRequestKey.current = ''
        setStatus(null); setLoading(false); setCanRetry(false)
        setError('Revisá el enlace privado recibido por correo.')
      }
    }
    const onHashChange = () => consumeLink()
    consumeLink(true)
    window.addEventListener('hashchange', onHashChange)
    return () => { window.removeEventListener('hashchange', onHashChange); request.current?.abort() }
  }, [available])

  return <main className="ui-auth-card my-auto min-w-0 p-4 sm:px-8 [overflow-wrap:anywhere]">
    <PublicQmsHeader title="QMS ECA" subtitle="Gestión de Calidad" logo={logoFormulario} />
    <div className="py-5 sm:py-6">
      <h1 className="m-0 text-xl font-semibold text-qms-dark">Seguimiento de tu trámite</h1>

      {!available ? <div role="status" className="mt-4 space-y-2 text-base leading-relaxed">
        <p className="font-medium text-qms-dark">La consulta en línea todavía no está habilitada.</p>
        <p className="text-qms-muted">Esto no afecta el registro de tu queja. Conservá tu consecutivo para consultar con Gestión de Calidad.</p>
      </div> : status ? <>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-qms-border pb-4 text-sm text-qms-muted">
          <span>Número de registro</span>
          <strong className="min-w-0 select-text break-all text-lg font-semibold text-qms-primary">{status.folio}</strong>
          <Badge variant="neutral" className="ml-auto max-w-full whitespace-normal!">{status.estado === 'Pendiente de Revisión GC' ? 'En revisión por Calidad' : status.estado}</Badge>
        </div>
        <p className="mt-5 text-base text-qms-dark">Tu solicitud fue recibida el {date(status.recibido_at)}.</p>
        <h2 className="mt-5 text-base font-semibold text-qms-dark">Avance del trámite</h2>
        <ol aria-label="Avance del trámite" className="mt-3 divide-y divide-qms-border border-y border-qms-border">
          {status.etapas.map((step, index) => <li key={`${index}-${step.nombre}`} className="flex min-w-0 items-center gap-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-qms-success text-white">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-medium text-qms-dark">{step.nombre}</p>
              {step.fecha && <p className="mt-0.5 text-sm text-qms-muted">{date(step.fecha)}</p>}
            </div>
          </li>)}
        </ol>
        {status.respuesta && <section className="mt-5" aria-label="Respuesta de Gestión de Calidad">
          <h2 className="font-semibold text-qms-dark">Respuesta de Gestión de Calidad</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-qms-dark">{status.respuesta}</p>
          {status.numero_oficio && <p className="mt-3 text-sm text-qms-muted">Oficio: <span className="font-medium text-qms-dark">{status.numero_oficio}</span></p>}
        </section>}
      </> : loading ? <div className="mt-5"><LoadingSkeleton variant="list" label="Consultando tu trámite…" framed={false} /></div> :
        <div className="mt-4 space-y-3 text-base leading-relaxed">
          <p className="text-qms-dark">Ingresá desde el botón «Consultar mi trámite» del correo de confirmación. El enlace abre tu trámite directamente, sin contraseña.</p>
          <p className="text-sm text-qms-muted">Si recargaste esta página, volvé a abrir el enlace del correo o el que guardaste al registrar la queja.</p>
          {canRetry && <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => void consultar(lastRequestKey.current)}>Reintentar consulta</Button>}
        </div>}
      {error && <p role="alert" className="mt-4 text-sm text-qms-danger">{error}</p>}
    </div>
    <footer className="space-y-1 border-t border-qms-border pt-3 text-xs leading-relaxed text-qms-muted">
      <p>El acceso vence 30 días naturales después del cierre. El informe de respuesta se envía adjunto a tu correo.</p>
      <p>Para consultas: <a className="text-qms-primary underline underline-offset-2" href="mailto:gc@eca.or.cr">gc@eca.or.cr</a>.</p>
    </footer>
  </main>
}

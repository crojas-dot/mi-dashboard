'use client'

import { useEffect, useId, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'

interface SessionScreenProps {
  label?: string
  description?: string
  denied?: boolean
  onRetry?: () => void
  onExit?: () => void
  layout?: 'neutral' | 'login'
}

/** Presentación pública: no recibe usuario, permisos, credenciales ni contenido privado. */
export default function SessionScreen({
  label = 'Cargando…',
  description = 'Enseguida podrás continuar.',
  denied = false,
  onRetry,
  onExit,
  layout = 'neutral',
}: SessionScreenProps) {
  const titleId = useId()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (denied || !onRetry) return
    const timer = setTimeout(() => setSlow(true), 10_000)
    return () => clearTimeout(timer)
  }, [denied, onRetry])

  if (!denied) return <main data-session-layout={layout} className="relative min-h-dvh bg-qms-background">
    <span role="status" className="sr-only">{label}</span>
    {layout === 'login' && <div aria-hidden="true" aria-busy="true"><LoginSkeleton /></div>}
    {slow && <div className="fixed inset-x-4 bottom-4 z-10 mx-auto max-w-sm rounded-card border border-qms-border bg-qms-surface p-4 shadow-sm">
      <p role="status" className="mb-3 text-sm text-qms-muted">La carga está tardando más de lo habitual.</p>
      <Button variant="secondary" onClick={onRetry} className="min-h-11 w-full">Reintentar</Button>
    </div>}
  </main>

  return <main className="flex min-h-dvh items-center justify-center bg-qms-background px-4 py-8 text-qms-dark antialiased">
    <div className="w-full max-w-sm text-center">
      <p className="mb-7 text-2xl font-semibold tracking-tight">ECA<span className="text-qms-primary">-QMS</span></p>
      <section aria-labelledby={titleId} className="overflow-hidden rounded-card border border-qms-border bg-qms-surface shadow-sm">
        <div role={denied ? 'alert' : 'status'} className="min-h-56 px-6 py-8 sm:px-8">
          <div aria-hidden="true" className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary">
            <ShieldAlert className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <h1 id={titleId} className="text-lg font-medium">{label}</h1>
          <p className="mt-2 text-sm leading-relaxed text-qms-muted">{description}</p>
        </div>
        {onExit && <div className="border-t border-qms-border bg-qms-hover-bg px-6 py-4">
          <Button variant="secondary" onClick={onExit} className="min-h-11 w-full">Cerrar sesión</Button>
        </div>}
      </section>
      <p className="mt-6 text-xs text-qms-muted">Sistema de Gestión de Calidad</p>
    </div>
  </main>
}

function LoginSkeleton() {
  return <div className="flex min-h-dvh items-center justify-center px-4 py-10">
    <div className="w-full max-w-md motion-safe:animate-pulse [animation-duration:2.4s]">
      <div className="mb-8 flex items-center justify-center gap-3"><Skeleton className="h-12 w-12 rounded-card" /><Skeleton className="h-7 w-36" /></div>
      <div className="rounded-card border border-qms-border bg-qms-surface">
        <div className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3"><Skeleton className="mx-auto h-6 w-36" /><Skeleton className="mx-auto h-3 w-3/4" /></div>
          {[0, 1].map(index => <div key={index} className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-full rounded-button" /></div>)}
          <Skeleton className="h-12 w-full rounded-button" />
        </div>
        <div className="border-t border-qms-border px-6 py-5"><Skeleton className="mx-auto h-3 w-4/5" /></div>
      </div>
      <Skeleton className="mx-auto mt-6 h-3 w-3/5" />
    </div>
  </div>
}

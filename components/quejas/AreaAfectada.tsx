import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'

export function AreaAfectadaFrame({ children }: { children: ReactNode }) {
  return <div className="relative ml-auto flex w-[250px] min-w-0 max-w-full shrink-0 flex-col gap-0.5">
    <span className="px-1.5 text-xs font-medium text-qms-muted">Área afectada</span>{children}
  </div>
}

/** Comparte la presentación del área sin cargar el catálogo ni sus permisos. */
export default function AreaAfectada({ area }: { area?: string | null }) {
  return <AreaAfectadaFrame><span className="flex min-w-0 items-center gap-1.5 px-1.5 text-sm text-qms-muted" title={`Área afectada: ${area || 'Sin indicar'}`}><MapPin aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 break-words">{area || 'Sin indicar'}</span></span></AreaAfectadaFrame>
}

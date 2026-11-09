'use client'

import type { Queja } from '@/lib/types'

/** Vista histórica de Mis Quejas. Los campos nuevos se editan en su etapa del flujo. */
export default function RegistroQuejaGC({ queja }: { queja: Queja }) {
  if (!queja.area_afectada && !queja.numero_oficio_resolucion && !queja.observaciones) return null
  return <section className="rounded-lg border border-qms-border bg-qms-surface p-4 sm:p-5">
    <h2 className="mb-4 text-base font-semibold text-qms-dark">Registro de Gestión de Calidad</h2>
    <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
      {queja.area_afectada && <div><dt className="text-qms-muted">Área afectada</dt><dd className="mt-0.5 break-words text-qms-dark">{queja.area_afectada}</dd></div>}
      {queja.numero_oficio_resolucion && <div><dt className="text-qms-muted">{queja.estado === 'No Procede' ? 'N.º de oficio explicativo' : 'N.º de oficio'}</dt><dd className="mt-0.5 break-words text-qms-dark">{queja.numero_oficio_resolucion}</dd></div>}
      {queja.observaciones && <div className="sm:col-span-2"><dt className="text-qms-muted">Observación anterior</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-qms-dark">{queja.observaciones}</dd></div>}
    </dl>
  </section>
}

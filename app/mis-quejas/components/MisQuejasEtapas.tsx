'use client'

import type { cicloMisQuejas, EtapaMisQuejas } from './etapasResponsable'

type Ciclo = ReturnType<typeof cicloMisQuejas>

export function MisQuejasBreadcrumb({ ciclo, etapa, onChange }: {
  ciclo: Ciclo
  etapa: EtapaMisQuejas
  onChange: (etapa: EtapaMisQuejas) => void
}) {
  return <nav data-mis-quejas-cycle aria-label="Etapas de Mis Quejas">
    <ol className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {ciclo.etapas.map((paso, indice) => (
        <li key={paso.id} className="min-w-0 text-center">
          <button type="button" data-case-stage={paso.id} aria-current={paso.actual ? 'step' : undefined}
            aria-pressed={paso.id === etapa} disabled={!paso.disponible} onClick={() => onChange(paso.id)}
            className="flex w-full min-w-0 cursor-pointer flex-col justify-end rounded-button px-1 py-1 text-center transition-colors hover:bg-qms-hover-bg focus-visible:outline-2 focus-visible:outline-qms-primary disabled:cursor-default disabled:hover:bg-transparent">
            <span className={`flex min-h-8 items-center justify-center text-[11px] leading-tight sm:min-h-6 sm:text-sm ${paso.id === etapa ? 'font-semibold text-qms-primary' : 'text-qms-muted'}`}>
              {indice + 1}. {paso.label}
            </span>
            <span aria-hidden="true" className={`mt-1 block h-1 w-full rounded-full ${paso.id === etapa && !paso.actual ? 'bg-qms-primary' : paso.completa ? 'bg-qms-success' : paso.actual ? 'bg-qms-primary' : 'bg-qms-border'}`} />
          </button>
        </li>
      ))}
    </ol>
  </nav>
}

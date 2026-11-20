'use client'

import { Check } from 'lucide-react'
import type { cicloMisQuejas, EtapaMisQuejas } from './etapasResponsable'

type Ciclo = ReturnType<typeof cicloMisQuejas>

export function MisQuejasBreadcrumb({ ciclo, etapa, onChange, chevrons = false }: {
  ciclo: Ciclo
  etapa: EtapaMisQuejas
  onChange: (etapa: EtapaMisQuejas) => void
  chevrons?: boolean
}) {
  if (chevrons) return <nav data-mis-quejas-cycle aria-label="Etapas de Mis Quejas">
    <ol data-mis-quejas-chevrons className="flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md">
      {ciclo.etapas.map((paso, indice) => {
        const selected = paso.id === etapa
        const color = selected ? 'bg-[#2A61B0] font-semibold text-white'
          : paso.completa ? 'bg-[#E6E5E5] font-semibold text-[#1A1718]'
          : paso.actual ? 'bg-[#E8EDF4] font-medium text-[#526273] ring-1 ring-inset ring-[#9DB7D4]'
          : 'border-y border-[#E0E3E7] bg-[#E8EDF4] font-medium text-[#526273]'
        const clipPath = indice === 0
          ? 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)'
          : 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%)'
        return <li key={paso.id} className={`min-w-0 flex-1 ${indice ? '-ml-2' : ''}`} aria-current={paso.actual ? 'step' : undefined}>
          <button type="button" data-case-stage={paso.id} aria-label={`Consultar ${paso.label}`}
            aria-pressed={selected} disabled={!paso.disponible} title={paso.label} onClick={() => onChange(paso.id)}
            style={{ clipPath }}
            className={`block h-9 w-full cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed ${color}`}>
            <span className="flex min-w-0 items-center justify-center gap-1 px-3 text-xs leading-9">
              {paso.completa && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
              <span className="truncate">{paso.label}</span>
            </span>
          </button>
        </li>
      })}
    </ol>
  </nav>
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

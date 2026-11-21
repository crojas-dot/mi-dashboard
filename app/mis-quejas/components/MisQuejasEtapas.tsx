'use client'

import { Check } from 'lucide-react'
import type { cicloMisQuejas, EtapaMisQuejas } from './etapasResponsable'

type Ciclo = ReturnType<typeof cicloMisQuejas>

export function MisQuejasBreadcrumb({ ciclo, etapa, onChange, compact = false }: {
  ciclo: Ciclo
  etapa: EtapaMisQuejas
  onChange: (etapa: EtapaMisQuejas) => void
  compact?: boolean
}) {
  return <nav data-mis-quejas-cycle aria-label="Etapas de Mis Quejas">
    <ol data-mis-quejas-chevrons data-case-stepper-compact={compact || undefined} className={`flex w-full min-w-0 items-center overflow-hidden rounded-md ${compact ? 'h-8' : 'h-9'}`}>
      {ciclo.etapas.map((paso, indice) => {
        const selected = paso.id === etapa
        const color = selected ? 'bg-[#2A61B0] font-semibold text-white'
          : paso.completa ? 'bg-[#E6E5E5] font-semibold text-[#1A1718]'
          : paso.actual ? 'bg-[#D9E5F5] font-semibold text-[#174574]'
          : 'bg-[#F3F6FB] text-[#4B5563]'
        const clipPath = indice === 0
          ? 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)'
          : 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%)'
        return <li key={paso.id} className={`min-w-0 flex-1 ${indice ? '-ml-2' : ''}`} aria-current={paso.actual ? 'step' : undefined}>
          <button type="button" data-case-stage={paso.id} aria-label={`Consultar ${paso.label}`}
            aria-pressed={selected} disabled={!paso.disponible} title={paso.label} onClick={() => onChange(paso.id)}
            style={{ clipPath }}
            className={`block w-full cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed ${compact ? 'h-8' : 'h-9'} ${color}`}>
            <span className={`flex min-w-0 items-center justify-center gap-1 text-xs ${compact ? 'px-2.5 leading-8' : 'px-3 leading-9'}`}>
              {paso.completa && <Check aria-hidden="true" className={`size-3.5 shrink-0 ${compact ? 'hidden @min-[420px]/workspace:block' : ''}`} />}
              {compact && paso.id === 'revision' ? <><span className="truncate @min-[420px]/workspace:hidden">Rev. GC</span><span className="hidden truncate @min-[420px]/workspace:inline">{paso.label}</span></> : <span className="truncate">{paso.label}</span>}
            </span>
          </button>
        </li>
      })}
    </ol>
  </nav>
}

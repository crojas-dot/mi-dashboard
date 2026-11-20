'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Queja } from '@/lib/types'
import { CaseRequestHeader } from '@/app/quejas/components/QuejaExpedientePanels'

/** Mismo desplegable de solicitante en Quejas y Mis quejas: sin duplicar datos en el lateral. */
export default function QuejaClienteDropdown({ queja, prominent = false, notionStyle = false }: { queja: Queja; prominent?: boolean; notionStyle?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  return <div ref={rootRef} data-case-client-dropdown className="relative min-w-0 max-w-[250px]"
    onKeyDown={event => {
      if (open && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }}>
    <button ref={buttonRef} type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? 'queja-cliente-datos' : undefined}
      onClick={() => setOpen(value => !value)}
      className={`flex max-w-full items-center gap-1.5 rounded-sm text-left leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A61B0] ${notionStyle ? 'text-[15px] font-normal text-[#787774] hover:text-[#37352F]' : prominent ? 'text-[15px] font-normal text-[#4B5563] hover:text-[#111827]' : 'text-[13px] text-[#343A40] hover:text-[#1A1718]'}`}>
      <span className="min-w-0 truncate">{queja.cliente_nombre || 'Solicitante sin nombre'}</span>
      <ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id="queja-cliente-datos" role="dialog" aria-label="Datos del solicitante"
      className={`absolute top-full left-0 z-50 mt-3 w-[min(350px,calc(100vw-2rem))] rounded-lg border p-4 ${notionStyle ? 'border-[#E9E9E7] bg-[#FFFEFC] text-[#37352F] shadow-[0_8px_30px_rgba(55,53,47,0.12)]' : 'border-qms-border bg-white text-qms-dark shadow-xl'}`}>
      <div className={`mb-3 flex items-center justify-between gap-2 border-b pb-2.5 ${notionStyle ? 'border-[#E9E9E7]' : 'border-qms-border'}`}>
        <p className="text-sm font-semibold text-qms-dark">Datos del solicitante</p>
        <button type="button" aria-label="Cerrar datos del solicitante" onClick={() => { setOpen(false); buttonRef.current?.focus() }}
          className={`rounded-md px-2 py-1 text-xs font-medium ${notionStyle ? 'text-[#787774] hover:bg-[#F1F1EF]' : 'text-qms-muted hover:bg-qms-hover-bg'}`}>Cerrar</button>
      </div>
      <CaseRequestHeader queja={queja} reference variant="panel" />
    </div>}
  </div>
}

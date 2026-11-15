'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, ChevronDown, XCircle } from 'lucide-react'

type Decision = 'procede' | 'no_procede'

interface Props {
  value: Decision
  disabled?: boolean
  onChange: (value: Decision) => void
}

/** Cambia la elección sin desmontar el editor ni alterar el texto redactado. */
export default function DecisionProcedenciaBadge({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const proceedRef = useRef<HTMLButtonElement>(null)
  const rejectRef = useRef<HTMLButtonElement>(null)
  const selectedProceed = value === 'procede'
  const Icon = selectedProceed ? CheckCircle2 : XCircle

  useEffect(() => {
    if (!open || disabled) return
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open, disabled])

  const select = (next: Decision) => {
    if (disabled) return
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div ref={rootRef} className="relative shrink-0">
    <button ref={triggerRef} type="button" disabled={disabled}
      data-decision-badge aria-label="Cambiar decisión de procedencia"
      aria-haspopup="menu" aria-expanded={open && !disabled}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          requestAnimationFrame(() => (selectedProceed ? proceedRef : rejectRef).current?.focus())
        }
      }}
      className={'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 ' +
        (selectedProceed ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-red-50 text-red-700 hover:bg-red-100')}>
      <Icon aria-hidden="true" className="size-4" />
      {selectedProceed ? 'Procede' : 'No Procede'}
      <ChevronDown aria-hidden="true" className="ml-0.5 size-3.5" />
    </button>
    {open && !disabled && <div role="menu" aria-label="Elegir decisión" data-decision-menu
      className="absolute left-0 top-full z-[80] mt-2 w-44 rounded-lg border border-gray-100 bg-white p-1 shadow-lg">
      <button ref={proceedRef} type="button" role="menuitemradio" aria-checked={selectedProceed}
        onClick={() => select('procede')}
        onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); rejectRef.current?.focus() } }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none">
        <CheckCircle2 aria-hidden="true" className="size-4 text-blue-700" /> Procede
        {selectedProceed && <Check aria-hidden="true" className="ml-auto size-3.5 text-blue-700" />}
      </button>
      <button ref={rejectRef} type="button" role="menuitemradio" aria-checked={!selectedProceed}
        onClick={() => select('no_procede')}
        onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); proceedRef.current?.focus() } }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none">
        <XCircle aria-hidden="true" className="size-4 text-red-700" /> No Procede
        {!selectedProceed && <Check aria-hidden="true" className="ml-auto size-3.5 text-red-700" />}
      </button>
    </div>}
  </div>
}

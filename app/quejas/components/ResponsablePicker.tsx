'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, UserRound } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { Usuario } from '@/lib/queries/useUsuarios'

interface ResponsablePickerProps {
  id: string
  options: Usuario[]
  value: Usuario | null
  onSelect: (user: Usuario) => void
  disabled?: boolean
  validationMessage?: string
  openRequest?: number
  loading?: boolean
  errorMessage?: string
}

const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')

export default function ResponsablePicker({ id, options, value, onSelect, disabled = false, validationMessage, openRequest = 0, loading = false, errorMessage }: ResponsablePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const requestRef = useRef(0)
  const filtered = useMemo(() => {
    const query = searchable(search.trim())
    return query ? options.filter(user => searchable(`${user.nombre} ${user.email}`).includes(query)) : options
  }, [options, search])
  const index = Math.min(activeIndex, Math.max(0, filtered.length - 1))
  const listId = `${id}-list`
  const errorId = `${id}-error`

  const close = useCallback((restoreFocus = true) => {
    const popup = popupRef.current
    if (popup && typeof popup.hidePopover === 'function' && popup.matches(':popover-open')) popup.hidePopover()
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true })
  }, [])
  const show = useCallback(() => {
    if (disabled) return
    setSearch('')
    setActiveIndex(Math.max(0, options.findIndex(user => user.id === value?.id)))
    setOpen(true)
  }, [disabled, options, value?.id])

  useEffect(() => {
    const previous = requestRef.current
    requestRef.current = openRequest
    if (openRequest > 0 && openRequest !== previous) show()
  }, [openRequest, show])

  useLayoutEffect(() => {
    if (!open || disabled) return
    const popup = popupRef.current
    const button = buttonRef.current
    if (!popup || !button) return
    const position = () => {
      const anchor = button.getBoundingClientRect()
      const viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8
      const topEdge = (viewport?.offsetTop ?? 0) + 8
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16
      const width = Math.min(320, rightEdge - leftEdge)
      const below = bottomEdge - anchor.bottom - 6
      const above = anchor.top - topEdge - 6
      const useAbove = below < 200 && above > below
      const maxHeight = Math.max(96, Math.min(360, useAbove ? above : below))
      popup.style.width = `${width}px`
      popup.style.left = `${Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width))}px`
      popup.style.maxHeight = `${maxHeight}px`
      popup.style.top = `${useAbove ? Math.max(topEdge, anchor.top - Math.min(popup.scrollHeight, maxHeight) - 6) : Math.max(topEdge, anchor.bottom + 6)}px`
    }
    // El popover permanece dentro del dialog en el DOM, pero su top layer evita
    // el recorte del encabezado. El fallback fijo conserva el mismo contrato.
    const nativePopover = typeof popup.showPopover === 'function'
    if (nativePopover) {
      popup.setAttribute('popover', 'manual')
      popup.showPopover()
    }
    position()
    searchRef.current?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      window.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      if (nativePopover && popup.matches(':popover-open')) popup.hidePopover()
    }
  }, [open, disabled])

  useEffect(() => {
    if (!open || disabled) return
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!popupRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Consumir este Escape antes del dialog: cierra el selector, nunca el documento.
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open, disabled, close])

  useEffect(() => {
    if (open) optionRefs.current[index]?.scrollIntoView({ block: 'nearest' })
  }, [open, index, search])

  const select = (user: Usuario) => {
    if (disabled) return
    onSelect(user)
    close()
  }

  return <div className="relative min-w-0">
    <Button
      id={id}
      ref={buttonRef}
      variant="ghost"
      size="sm"
      disabled={disabled}
      className={`max-w-[100px] gap-1.5 px-1.5 sm:max-w-[150px] ${validationMessage ? 'border-qms-danger text-qms-danger' : ''}`}
      aria-label={value ? `Responsable de investigación: ${value.nombre}` : 'Asignar responsable de investigación'}
      aria-haspopup="listbox"
      aria-expanded={open && !disabled}
      aria-controls={open && !disabled ? listId : undefined}
      aria-invalid={Boolean(validationMessage)}
      aria-describedby={validationMessage ? errorId : undefined}
      title={value ? `${value.nombre} · ${value.email}` : 'Asignar responsable'}
      onClick={() => open ? close() : show()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() }
      }}
    >
      <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{value?.nombre || 'Responsable'}</span>
      <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    </Button>
    {open && !disabled && <div ref={popupRef} data-responsable-picker className="fixed z-[70] m-0 flex flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface p-0 text-qms-dark shadow-lg" style={{ inset: 'auto' }}>
      <div className="shrink-0 border-b border-qms-border p-3">
        <label htmlFor={`${id}-search`} className="sr-only">Buscar responsable por nombre o correo</label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-qms-muted" />
          <Input
            ref={searchRef}
            id={`${id}-search`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={filtered[index] && !loading && !errorMessage ? `${id}-option-${index}` : undefined}
            placeholder="Buscar nombre o correo…"
            autoComplete="off"
            value={search}
            className="pl-9"
            onChange={event => { setSearch(event.target.value); setActiveIndex(0) }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex(previous => filtered.length ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                if (filtered[index] && !loading && !errorMessage) select(filtered[index])
              } else if (event.key === 'Tab') {
                // Se devuelve al disparador dentro del diálogo; el siguiente Tab
                // continúa su recorrido normal, sin escapar al documento de fondo.
                event.preventDefault()
                event.stopPropagation()
                close()
              }
            }}
          />
        </div>
        {validationMessage && <p id={errorId} role="alert" className="mt-2 mb-0 text-sm text-qms-danger">{validationMessage}</p>}
      </div>
      <div id={listId} role="listbox" aria-label="Responsables asignables" className="min-h-0 overflow-y-auto overscroll-contain p-1">
        {loading ? <p role="status" className="m-0 px-3 py-4 text-sm text-qms-muted">Cargando responsables…</p>
          : errorMessage ? <p role="alert" className="m-0 px-3 py-4 text-sm text-qms-danger">{errorMessage}</p>
            : filtered.length === 0 ? <p role="status" className="m-0 px-3 py-4 text-sm text-qms-muted">{search ? 'Sin coincidencias.' : 'No hay responsables disponibles.'}</p>
              : filtered.map((user, optionIndex) => <button
                type="button"
                role="option"
                id={`${id}-option-${optionIndex}`}
                key={user.id}
                ref={element => { optionRefs.current[optionIndex] = element }}
                tabIndex={-1}
                aria-selected={value?.id === user.id}
                title={`${user.nombre} · ${user.email}`}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-button border-0 px-3 py-2 text-left ${index === optionIndex ? 'bg-qms-primary-soft' : 'bg-transparent hover:bg-qms-hover-bg'}`}
                onPointerMove={() => setActiveIndex(optionIndex)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => select(user)}
              >
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{user.nombre}</span><span className="block truncate text-xs text-qms-muted">{user.email}</span></span>
                {value?.id === user.id && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-qms-primary" />}
              </button>)}
      </div>
    </div>}
    {validationMessage && (!open || disabled) && <span id={errorId} className="sr-only">{validationMessage}</span>}
  </div>
}

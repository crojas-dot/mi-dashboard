'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { CatalogoValor } from '@/lib/queries/useCatalogos'

interface AreaCatalogoPickerProps {
  id: string
  rows: { row: CatalogoValor | null; valor: string }[]
  value: string
  disabled: boolean
  loading: boolean
  canManage: boolean
  onChange: (key: string) => void
  onEdit: (row: CatalogoValor) => void
  onRemove: (row: CatalogoValor) => void
  onRestore: (row: CatalogoValor) => void
}

// Desplazar solo la lista evita mover también el resumen o el documento del expediente.
function revealInPopup(popup: HTMLDivElement, element: HTMLElement) {
  const bounds = popup.getBoundingClientRect(), target = element.getBoundingClientRect()
  if (target.top < bounds.top + 4) popup.scrollTop -= bounds.top + 4 - target.top
  else if (target.bottom > bounds.bottom - 4) popup.scrollTop += target.bottom - bounds.bottom + 4
}

/** Selector local: las acciones conservan la fila capturada al abrir los tres puntos,
 * independientemente de la selección o de un refresco del catálogo. */
export default function AreaCatalogoPicker({ id, rows, value, disabled, loading, canManage, onChange, onEdit, onRemove, onRestore }: AreaCatalogoPickerProps) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<CatalogoValor | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const selected = rows.find(item => (item.row?.id ?? item.valor) === value)
  const expanded = open && !disabled
  if (disabled && open) { setOpen(false); setMenu(null) }
  if (!canManage && menu) setMenu(null)

  const close = useCallback((restoreFocus = true) => {
    setOpen(false); setMenu(null)
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true })
  }, [])

  const position = useCallback(() => {
    const popup = popupRef.current, button = buttonRef.current
    if (!popup || !button) return
    const anchor = button.getBoundingClientRect(), viewport = window.visualViewport
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8, topEdge = (viewport?.offsetTop ?? 0) + 8
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16
    const width = Math.max(1, Math.min(360, Math.max(260, anchor.width), rightEdge - leftEdge))
    const below = bottomEdge - anchor.bottom - 6, above = anchor.top - topEdge - 6
    const useAbove = below < 240 && above > below
    const maxHeight = Math.min(320, bottomEdge - topEdge, Math.max(80, useAbove ? above : below))
    popup.style.width = `${width}px`
    popup.style.left = `${Math.max(leftEdge, Math.min(anchor.left, rightEdge - width))}px`
    popup.style.maxHeight = `${Math.max(1, maxHeight)}px`
    const height = Math.min(popup.scrollHeight, maxHeight)
    popup.style.top = `${Math.max(topEdge, Math.min(useAbove ? anchor.top - height - 6 : anchor.bottom + 6, bottomEdge - height))}px`
  }, [])

  useLayoutEffect(() => {
    if (!expanded) return
    const popup = popupRef.current
    if (!popup) return
    // El top layer mantiene los menús visibles dentro del resumen con scroll y del modal.
    const nativePopover = typeof popup.showPopover === 'function'
    if (nativePopover) { popup.setAttribute('popover', 'manual'); popup.showPopover() }
    position()
    const selectedButton = popup.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? popup.querySelector<HTMLButtonElement>('[data-catalog-choice]')
    selectedButton?.focus({ preventScroll: true })
    if (selectedButton) revealInPopup(popup, selectedButton)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      if (nativePopover && popup.matches(':popover-open')) popup.hidePopover()
    }
  }, [expanded, position])

  useLayoutEffect(() => {
    if (!expanded) return
    position()
    if (menu) {
      const popup = popupRef.current, actions = popup?.querySelector<HTMLElement>('[role="menu"]')
      popup?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
      if (popup && actions) revealInPopup(popup, actions)
    }
  }, [expanded, menu, rows.length, position])

  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!popupRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close(false)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation()
      if (!menu) { close(); return }
      const action = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('[data-catalog-actions]') ?? []).find(button => button.dataset.catalogActions === menu.id)
      setMenu(null); action?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true) }
  }, [expanded, menu, close])

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const selector = menu ? '[role="menuitem"]' : 'button:not(:disabled)'
    const buttons = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>(selector) ?? [])
    if (!buttons.length) return
    event.preventDefault()
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus({ preventScroll: true })
    if (popupRef.current) revealInPopup(popupRef.current, buttons[next])
  }
  const act = (callback: (row: CatalogoValor) => void) => {
    if (!menu || !canManage || disabled) return
    const captured = menu
    close(); callback(captured)
  }

  return <>
    <Button ref={buttonRef} id={id} variant="secondary" disabled={disabled} className="w-full min-w-0 justify-between gap-2 text-left" aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? `${id}-popup` : undefined} onClick={() => expanded ? close() : setOpen(true)} onKeyDown={event => { if (event.key === 'ArrowDown' && !disabled) { event.preventDefault(); setOpen(true) } }}>
      <span className="min-w-0 truncate">{loading ? 'Cargando áreas…' : selected ? `${selected.valor}${selected.row?.activo === false ? ' (eliminada)' : ''}` : 'Elegir área'}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </Button>
    {expanded && <div ref={popupRef} id={`${id}-popup`} role="dialog" aria-label="Áreas del catálogo" className="fixed z-[70] m-0 overflow-y-auto overscroll-contain rounded-card border border-qms-border bg-qms-surface p-1 text-qms-dark shadow-lg" style={{ inset: 'auto' }} onKeyDown={navigate} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !buttonRef.current?.contains(event.relatedTarget)) close(false) }}>
      {rows.map(({ row, valor }) => {
        const key = row?.id ?? valor
        const activeMenu = menu?.id === row?.id && !!menu
        return <div key={key} className="min-w-0">
          <div className={`flex min-w-0 items-center gap-0.5 rounded-button ${key === value ? 'bg-qms-primary-soft' : ''}`}>
            <Button size="sm" variant="ghost" data-catalog-choice aria-pressed={key === value} className={`min-w-0 flex-1 justify-start gap-2 text-left whitespace-normal ${key === value ? 'text-qms-primary' : ''}`} onClick={() => { if (!disabled) { onChange(key); close() } }}>
              <span className="min-w-0 flex-1 break-words">{valor}{row?.activo === false && <span className="text-xs text-qms-muted"> · Eliminada</span>}</span>{key === value && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
            </Button>
            {canManage && row && <Button size="icon" variant="ghost" className="size-8 shrink-0 text-qms-muted" data-catalog-actions={row.id} aria-label={`Acciones de ${valor}`} aria-haspopup="menu" aria-expanded={activeMenu} aria-controls={activeMenu ? `${id}-actions` : undefined} onClick={() => setMenu(activeMenu ? null : { ...row })}><MoreHorizontal aria-hidden="true" className="size-4" /></Button>}
          </div>
          {activeMenu && <div id={`${id}-actions`} role="menu" aria-label={`Acciones de ${menu.valor}`} className="my-1 ml-auto w-36 rounded-button border border-qms-border bg-qms-surface p-1 shadow-sm" onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setMenu(null) }}>
            <Button size="sm" variant="ghost" role="menuitem" className="w-full justify-start gap-2" onClick={() => act(onEdit)}><Pencil aria-hidden="true" className="size-3.5" />Editar</Button>
            {menu.activo === false ? <Button size="sm" variant="ghost" role="menuitem" className="w-full justify-start gap-2" onClick={() => act(onRestore)}><RotateCcw aria-hidden="true" className="size-3.5" />Restaurar</Button> : <Button size="sm" variant="ghost" role="menuitem" className="w-full justify-start gap-2 text-qms-danger" onClick={() => act(onRemove)}><Trash2 aria-hidden="true" className="size-3.5" />Eliminar</Button>}
          </div>}
        </div>
      })}
    </div>}
  </>
}

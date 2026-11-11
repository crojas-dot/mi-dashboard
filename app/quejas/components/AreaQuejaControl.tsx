'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import AreaAfectada, { AreaAfectadaFrame } from '@/components/quejas/AreaAfectada'
import { useCatalogoTipo } from '@/lib/queries/useCatalogos'
import type { RegistroQuejaInput } from '@/lib/services/quejaWorkflowService'

interface AreaQuejaControlProps {
  quejaId: string
  area: string
  draft: RegistroQuejaInput | null
  onEdit?: () => void
  onSave: (next?: RegistroQuejaInput) => void
  onCancel: () => void
  saving?: boolean
  disabled?: boolean
}

/** Abrir muestra directamente las opciones. Elegir guarda el snapshot capturado,
 * sin cambiar revisión, oficio ni observación; el catálogo se administra aparte. */
export default function AreaQuejaControl({ quejaId, area, draft, onEdit, onSave, onCancel, saving = false, disabled = false }: AreaQuejaControlProps) {
  const id = `queja-area-${quejaId}`
  const editing = Boolean(draft && draft.quejaId === quejaId)
  const { data: areas = [], isLoading, error, refetch } = useCatalogoTipo('area_afectada', 'quejas')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const wasEditingRef = useRef(editing)
  const entityRef = useRef(quejaId)

  useLayoutEffect(() => {
    const wasEditing = wasEditingRef.current
    wasEditingRef.current = editing
    const sameEntity = entityRef.current === quejaId
    entityRef.current = quejaId
    const button = buttonRef.current
    const modal = document.querySelector('dialog:modal')
    if (wasEditing && !editing && sameEntity && button && document.activeElement === document.body && (!modal || modal.contains(button))) button.focus({ preventScroll: true })
  }, [editing, quejaId])

  const cancel = useCallback((restoreFocus = true) => {
    if (saving) return
    onCancel()
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true })
  }, [saving, onCancel])

  useLayoutEffect(() => {
    if (!editing) return
    const popup = popupRef.current, button = buttonRef.current
    if (!popup || !button) return
    const position = () => {
      const anchor = button.getBoundingClientRect(), viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8, topEdge = (viewport?.offsetTop ?? 0) + 8
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16
      const width = Math.max(1, Math.min(300, rightEdge - leftEdge))
      const below = bottomEdge - anchor.bottom - 6, above = anchor.top - topEdge - 6
      const useAbove = below < 200 && above > below
      const maxHeight = Math.min(Math.max(1, bottomEdge - topEdge), 300, Math.max(80, useAbove ? above : below))
      popup.style.width = `${width}px`
      popup.style.left = `${Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width))}px`
      popup.style.maxHeight = `${maxHeight}px`
      const height = Math.min(popup.scrollHeight, maxHeight)
      popup.style.top = `${Math.max(topEdge, Math.min(useAbove ? anchor.top - height - 6 : anchor.bottom + 6, bottomEdge - height))}px`
    }
    // El top layer evita recortar la lista en el lienzo con scroll.
    const nativePopover = typeof popup.showPopover === 'function'
    if (nativePopover) { popup.setAttribute('popover', 'manual'); popup.showPopover() }
    position()
    popup.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
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
  }, [editing, areas.length, isLoading, error])

  useEffect(() => {
    if (!editing) return
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!popupRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) cancel(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation(); cancel()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true) }
  }, [editing, cancel])

  const choose = (value: string) => {
    if (!draft || !editing || saving || disabled) return
    if (value === area) { cancel(); return }
    onSave({ ...draft, area: value })
  }
  const options = [...new Set(areas.map(item => item.valor))]
  // Un área histórica sigue visible aunque ya no se ofrezca para otras quejas.
  if (area && !options.includes(area)) options.unshift(area)
  const display = area || 'Seleccionar área afectada'
  if (!onEdit) return <AreaAfectada area={area} />
  return <AreaAfectadaFrame>
    <Button ref={buttonRef} id={id} size="sm" variant="ghost" disabled={disabled || saving} onClick={() => editing ? cancel() : onEdit()} aria-label={`Área afectada: ${area || 'Sin indicar'}`} aria-haspopup="dialog" aria-expanded={editing} aria-controls={editing ? `${id}-popup` : undefined} title={`Área afectada: ${area || 'Sin indicar'}`} className="w-full min-w-0 justify-start gap-1.5 px-1.5 text-left text-qms-muted">
      {saving ? <Spinner size="sm" /> : <MapPin aria-hidden="true" className="size-3.5 shrink-0" />}<span className={`min-w-0 flex-1 ${area ? 'truncate' : 'whitespace-normal'}`}>{saving ? 'Guardando área…' : display}</span><ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
    </Button>
    {editing && <div ref={popupRef} id={`${id}-popup`} role="dialog" aria-label="Seleccionar área afectada" aria-busy={saving} data-area-queja-control className="fixed z-[70] m-0 overflow-y-auto overscroll-contain rounded-card border border-qms-border bg-qms-surface p-1.5 text-qms-dark shadow-lg" style={{ inset: 'auto' }}>
      <p className="px-2.5 py-2 text-xs font-medium text-qms-muted">Área afectada</p>
      {isLoading && <p role="status" className="px-2.5 py-2 text-sm text-qms-muted">Cargando áreas…</p>}
      {error ? <div role="alert" className="px-2.5 py-2 text-sm"><p>No se pudieron cargar las áreas. El valor actual se conserva.</p><Button size="sm" variant="link" onClick={() => void refetch()}>Reintentar</Button></div> : <div role="group" aria-label="Áreas disponibles" className="space-y-0.5">
        {['', ...options].map(value => <Button key={value} size="sm" variant="ghost" className={`w-full justify-between gap-2 text-left whitespace-normal ${value === area ? 'bg-qms-primary-soft text-qms-primary' : ''}`} disabled={disabled || saving || isLoading} aria-pressed={value === area} onClick={() => choose(value)}><span className="min-w-0 flex-1 break-words">{value || 'Sin área asignada'}</span>{value === area && <Check aria-hidden="true" className="size-4 shrink-0" />}</Button>)}
        {!isLoading && !options.length && <p className="px-2.5 py-2 text-xs text-qms-muted">Todavía no hay áreas en el catálogo.</p>}
      </div>}
    </div>}
  </AreaAfectadaFrame>
}

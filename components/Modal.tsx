'use client'

import { useEffect, useId, useRef, type MouseEvent } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'dialog' | 'drawer' | 'sheet' | 'workspace' | 'document' | 'report' | 'confirmation'
  height?: 'fill' | 'content'
  tall?: boolean
  expanded?: boolean
  dismissOnEscape?: boolean
  dismissOnBackdrop?: boolean
  descriptionId?: string
  headerLeading?: React.ReactNode
  headerCenter?: React.ReactNode
  headerActions?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

const sizes: Record<string, string> = {
  sm: 'max-w-[500px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[700px]',
  xl: 'max-w-[1040px]',
}
let scrollLocks = 0
let previousOverflow = ''

export default function Modal({ open, onClose, title, size = 'md', variant = 'dialog', height = 'fill', tall = false, expanded = false, dismissOnEscape = true, dismissOnBackdrop = true, descriptionId, headerLeading, headerCenter, headerActions, footer, children }: ModalProps) {
  const drawer = variant === 'drawer'
  const workspace = variant === 'workspace'
  const report = variant === 'report'
  const confirmation = variant === 'confirmation'
  const sheet = variant === 'sheet' || workspace
  const documentView = variant === 'document' || report
  const centeredWorkspaceHeader = workspace && !!headerCenter
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let locked = false
    const releaseScroll = () => {
      if (!locked) return
      locked = false
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow
    }
    const mobile = workspace ? window.matchMedia('(max-width: 1023.98px)') : null
    const present = () => {
      // El panel de trabajo deja la tabla operativa; móvil y ampliado son modales.
      const modal = !workspace || expanded || mobile?.matches
      if (dialog.open && dialog.matches(':modal') === Boolean(modal)) return
      // Un cambio de viewport no debe subir el panel por encima de su editor/visor.
      // El observer retoma la presentación al cerrar el diálogo superior.
      // Un lateral contenido por el modal activo sí puede abrirse en su mismo plano.
      if (workspace && [...document.querySelectorAll('dialog:modal')].some(element => element !== dialog && !element.contains(dialog))) return
      if (dialog.open) dialog.close()
      if (modal) {
        dialog.showModal()
        if (!locked && scrollLocks++ === 0) {
          previousOverflow = document.body.style.overflow
          document.body.style.overflow = 'hidden'
        }
        locked = true
      } else {
        releaseScroll()
        dialog.show()
      }
    }
    present()
    mobile?.addEventListener('change', present)
    const observer = workspace ? new MutationObserver(present) : null
    observer?.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => {
      mobile?.removeEventListener('change', present)
      observer?.disconnect()
      dialog.close()
      releaseScroll()
      if (document.activeElement === document.body && origin?.isConnected) origin.focus({ preventScroll: true })
    }
  }, [open, workspace, expanded])

  if (!open) return null

  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal={workspace ? undefined : true}
      data-qms-modal
      className={`${workspace ? '@container/workspace ' : ''}fixed flex-col overflow-hidden border-0 p-0 open:flex ${tall && !sheet && !documentView && !confirmation && !drawer ? 'h-[min(76dvh,720px)]' : ''} ${report ? 'z-[100] inset-0 m-0 h-dvh max-h-[100dvh] w-screen max-w-none rounded-none bg-white text-qms-dark shadow-none' : 'shadow-lg'} ${report || workspace && expanded ? 'backdrop:bg-transparent' : 'backdrop:bg-black/50'} ${confirmation ? 'inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[480px] rounded-[12px] border border-qms-border bg-white text-qms-dark shadow-md' : sheet && !report ? `inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full ${workspace ? expanded ? 'max-w-none' : `z-50 max-w-none ${size === 'sm' ? 'lg:w-[560px]' : 'lg:w-[40vw]'}` : expanded ? 'max-w-none' : size === 'sm' ? 'max-w-[420px]' : 'max-w-[790px]'} border-l border-qms-border bg-qms-surface text-qms-dark` : drawer ? 'inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100%-2rem))] max-w-none bg-qms-dark text-white' : !report && !confirmation ? `inset-0 m-auto max-h-[90dvh] ${documentView && height === 'fill' ? 'h-[90dvh]' : ''} w-[calc(100%-2rem)] rounded-modal bg-qms-surface text-qms-dark ${sizes[size]}` : ''}`}
      onCancel={(event) => {
        // El selector de archivos también emite cancel y burbujea hasta dialog.
        if (event.target !== event.currentTarget) return
        event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) onClose()
      }}
      onKeyDownCapture={event => {
        // Consumir Escape aquí evita que ProseMirror o un diálogo de fondo cambien
        // el cierre solicitado por esta vista; el selector superior conserva su Escape.
        const target = event.target && typeof (event.target as Element).closest === 'function' ? event.target as Element : null
        if (event.key === 'Escape' && target?.closest('[contenteditable="true"]') && target.closest('dialog') === event.currentTarget) {
          event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) onClose()
        }
      }}
      onKeyDown={event => {
        const target = event.target && typeof (event.target as Element).closest === 'function' ? event.target as Element : null
        if (target && target.closest('dialog') !== event.currentTarget) return
        if (workspace && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) onClose(); return }
        if (event.key !== 'Tab') return
        if (workspace && !event.currentTarget.matches(':modal')) return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]')]
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
      onMouseDown={(event) => { backdropDown.current = outside(event) }}
      onClick={(event) => {
        if (dismissOnBackdrop && backdropDown.current && outside(event)) onClose()
        backdropDown.current = false
      }}
    >
        {drawer ? <h2 id={titleId} className="sr-only">{title}</h2> : <div
          data-modal-header
          className={`${report ? 'flex h-14 min-h-14 shrink-0 flex-nowrap items-center justify-between gap-2 border-b border-qms-border bg-white px-3 text-qms-dark sm:px-4' : confirmation ? 'flex h-16 shrink-0 items-center justify-between gap-3 bg-white px-5 pt-4 text-qms-dark' : 'flex shrink-0 items-center justify-between gap-2 border-b border-qms-border bg-qms-surface px-4 py-2.5 text-qms-dark'} ${centeredWorkspaceHeader ? '@min-[1100px]/workspace:grid @min-[1100px]/workspace:grid-cols-[220px_minmax(0,1fr)_260px] @min-[1100px]/workspace:gap-4' : ''}`}
        >
          <div className={`flex min-w-0 items-center gap-3 ${headerCenter ? 'shrink-0' : 'flex-1'} ${report ? 'gap-2' : confirmation ? 'gap-3' : ''}`}>
            {headerLeading}
            <h2 id={titleId} title={workspace ? title : report ? title : undefined} className={`m-0 min-w-0 truncate leading-6 ${workspace ? 'text-sm font-semibold sm:text-base' : report ? 'text-base font-semibold' : confirmation ? 'text-lg font-semibold' : 'text-base'}`}>{title}</h2>
          </div>
          {headerCenter && <div data-modal-header-center className="flex min-w-0 flex-1 items-center justify-center overflow-hidden px-2 @min-[1100px]/workspace:px-0">{headerCenter}</div>}
          <div className={`flex shrink-0 items-center gap-1 ${centeredWorkspaceHeader ? '@min-[1100px]/workspace:justify-self-end' : ''}`}>
            {headerActions}
            <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className={`inline-flex ${report || confirmation ? 'h-9 w-9' : 'h-10 w-10'} shrink-0 cursor-pointer items-center justify-center rounded-button border border-transparent bg-transparent text-qms-muted hover:bg-qms-hover-bg hover:text-qms-dark`}>
              <svg aria-hidden="true" className={workspace ? 'size-5' : 'size-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>}
        <div className={sheet || documentView ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : tall ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg px-4 py-4' : confirmation ? 'min-h-0 flex-1 overflow-y-auto bg-white' : drawer ? 'flex min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-4'}>{children}</div>
        {footer && <div className="shrink-0 border-t border-qms-border bg-qms-surface px-4 py-3">{footer}</div>}
    </dialog>
  )
}

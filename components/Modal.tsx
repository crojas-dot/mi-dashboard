'use client'

import { useEffect, useId, useRef, type MouseEvent } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  onEscape?: () => void
  title: string
  titleSuffix?: string
  emphasizeTitle?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'mail'
  variant?: 'dialog' | 'drawer' | 'sheet' | 'workspace' | 'document' | 'report' | 'confirmation'
  height?: 'fill' | 'content'
  tall?: boolean
  fixedHeight?: boolean
  expanded?: boolean
  dismissOnEscape?: boolean
  dismissOnBackdrop?: boolean
  descriptionId?: string
  headerLeading?: React.ReactNode
  headerSubtitle?: React.ReactNode
  headerTone?: 'default' | 'quality' | 'profile' | 'activity'
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
  mail: 'max-w-[896px]',
}
let scrollLocks = 0
let previousOverflow = ''

export default function Modal({ open, onClose, onEscape, title, titleSuffix, emphasizeTitle = false, size = 'md', variant = 'dialog', height = 'fill', tall = false, fixedHeight = false, expanded = false, dismissOnEscape = true, dismissOnBackdrop = true, descriptionId, headerLeading, headerSubtitle, headerTone = 'default', headerCenter, headerActions, footer, children }: ModalProps) {
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
      className={`${workspace ? '@container/workspace ' : ''}fixed flex-col overflow-hidden border-0 p-0 open:flex ${fixedHeight && !sheet && !documentView && !confirmation && !drawer ? 'h-[min(600px,90dvh)]' : tall && !sheet && !documentView && !confirmation && !drawer ? 'h-[min(76dvh,720px)]' : ''} ${report ? 'z-[100] inset-0 m-0 h-dvh max-h-[100dvh] w-screen max-w-none rounded-none bg-white text-qms-dark shadow-none' : 'shadow-modal'} ${report || workspace && expanded ? 'backdrop:bg-transparent' : 'backdrop:bg-black/50'} ${workspace && expanded && headerTone === 'quality' ? 'border-l-0!' : ''} ${confirmation ? 'inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[480px] rounded-[12px] border border-qms-border bg-white text-qms-dark shadow-md' : sheet && !report ? `inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full ${workspace ? expanded ? 'max-w-none' : `z-50 max-w-none ${size === 'sm' ? 'lg:w-[560px]' : 'lg:w-[40vw]'}` : expanded ? 'max-w-none' : size === 'sm' ? 'max-w-[420px]' : 'max-w-[790px]'} border-l border-qms-border bg-qms-surface text-qms-dark` : drawer ? 'inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100%-2rem))] max-w-none bg-qms-dark text-white' : !report && !confirmation ? `inset-0 m-auto max-h-[90dvh] ${documentView && height === 'fill' ? 'h-[90dvh]' : ''} w-[calc(100%-2rem)] rounded-modal bg-qms-surface text-qms-dark ${fixedHeight ? 'max-w-[672px]' : sizes[size]}` : ''}`}
      onCancel={(event) => {
        // El selector de archivos también emite cancel y burbujea hasta dialog.
        if (event.target !== event.currentTarget) return
        event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) (onEscape ?? onClose)()
      }}
      onKeyDownCapture={event => {
        // Consumir Escape aquí evita que ProseMirror o un diálogo de fondo cambien
        // el cierre solicitado por esta vista; el selector superior conserva su Escape.
        const target = event.target && typeof (event.target as Element).closest === 'function' ? event.target as Element : null
        if (event.key === 'Escape' && target?.closest('[contenteditable="true"]') && target.closest('dialog') === event.currentTarget) {
          event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) (onEscape ?? onClose)()
        }
      }}
      onKeyDown={event => {
        const target = event.target && typeof (event.target as Element).closest === 'function' ? event.target as Element : null
        if (target && target.closest('dialog') !== event.currentTarget) return
        if (workspace && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (dismissOnEscape) (onEscape ?? onClose)(); return }
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
          data-case-header-grid={centeredWorkspaceHeader || undefined}
          data-case-header-tone={headerTone === 'quality' ? 'quality' : undefined}
          style={headerTone === 'quality'
            ? {
                background: '#C5CAD2',
                borderBottom: '1px solid #ABB3BF',
              }
            : headerTone === 'activity' ? { background: 'linear-gradient(110deg, rgb(28 52 73 / 84%), rgb(46 78 102 / 82%))' } : undefined}
          className={`${report ? 'flex h-14 min-h-14 shrink-0 flex-nowrap items-center justify-between gap-2 border-b border-qms-border bg-white px-3 text-qms-dark sm:px-4' : confirmation ? 'flex h-16 shrink-0 items-center justify-between gap-3 bg-white px-5 pt-4 text-qms-dark' : fixedHeight ? 'flex shrink-0 items-center justify-between gap-3 border-b border-qms-border bg-qms-surface px-4 py-3 text-qms-dark sm:px-6 sm:py-4' : 'flex shrink-0 items-center justify-between gap-2 border-b border-qms-border bg-qms-surface px-4 py-2.5 text-qms-dark'} ${centeredWorkspaceHeader ? `@min-[1100px]/workspace:grid ${headerTone === 'quality' ? '@min-[1100px]/workspace:grid-cols-[250px_minmax(0,1fr)_190px]' : '@min-[1100px]/workspace:grid-cols-[220px_minmax(0,1fr)_260px]'} @min-[1100px]/workspace:gap-4` : ''} ${headerTone === 'quality' ? 'relative z-30 h-[70px] min-h-[70px] bg-[#C5CAD2] text-[#1A1718]! [&>div:last-child_button]:text-[#1A1718]! [&>div:last-child_button:hover]:bg-black/10!' : headerTone === 'profile' ? 'bg-[#F0F5FA]! text-qms-primary!' : headerTone === 'activity' ? 'border-white/15! text-white!' : ''}`}
        >
          <div className={`flex min-w-0 items-center gap-3 ${headerCenter ? 'shrink-0' : 'flex-1'} ${report ? 'gap-2' : confirmation ? 'gap-3' : ''}`}>
            {headerLeading}
            {headerSubtitle ? <div className="min-w-0">
              <h2 id={titleId} title={workspace ? title : report ? title : undefined} className={`m-0 min-w-0 leading-6 ${fixedHeight ? 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[17px] font-semibold' : `truncate ${workspace ? 'text-sm font-semibold sm:text-base' : report ? 'text-base font-semibold' : confirmation ? 'text-lg font-semibold' : 'text-base'} ${emphasizeTitle ? 'font-semibold' : ''}`}`}>{titleSuffix ? <>{title}<span className={`font-normal ${headerTone === 'activity' ? 'text-white/90' : 'text-qms-muted'}`}>· {titleSuffix}</span></> : title}</h2>
              <div className="min-w-0">{headerSubtitle}</div>
            </div> : <h2 id={titleId} title={workspace ? title : report ? title : undefined} className={`m-0 min-w-0 leading-6 ${fixedHeight ? 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[17px] font-semibold' : `truncate ${workspace ? 'text-sm font-semibold sm:text-base' : report ? 'text-base font-semibold' : confirmation ? 'text-lg font-semibold' : 'text-base'} ${emphasizeTitle ? 'font-semibold' : ''}`}`}>{titleSuffix ? <>{title}<span className={`font-normal ${headerTone === 'activity' ? 'text-white/90' : 'text-qms-muted'}`}>· {titleSuffix}</span></> : title}</h2>}
          </div>
          {headerCenter && <div data-modal-header-center className="flex min-w-0 flex-1 items-center justify-center overflow-hidden px-2 @min-[1100px]/workspace:px-0">{headerCenter}</div>}
          <div className={`flex shrink-0 items-center gap-1 ${centeredWorkspaceHeader ? '@min-[1100px]/workspace:justify-self-end' : ''}`}>
            {headerActions}
            <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className={`inline-flex ${report || confirmation ? 'h-9 w-9' : 'h-10 w-10'} shrink-0 cursor-pointer items-center justify-center rounded-button border border-transparent bg-transparent ${headerTone === 'activity' ? 'text-white hover:bg-white/15 hover:text-white' : headerTone === 'quality' ? 'text-[#1A1718] hover:bg-black/10 hover:text-[#1A1718]' : 'text-qms-muted hover:bg-qms-hover-bg hover:text-qms-dark'}`}>
              <svg aria-hidden="true" className={workspace ? 'size-5' : 'size-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>}
        <div className={sheet || documentView ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : fixedHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg' : tall ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg px-4 py-4' : confirmation ? 'min-h-0 flex-1 overflow-y-auto bg-white' : drawer ? 'flex min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-4'}>{children}</div>
        {footer && <div className={`z-10 shrink-0 border-t border-qms-border bg-qms-surface ${fixedHeight ? 'p-4' : 'px-4 py-3'}`}>{footer}</div>}
    </dialog>
  )
}

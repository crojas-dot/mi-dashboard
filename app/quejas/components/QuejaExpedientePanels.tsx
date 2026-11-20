'use client'

import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Eye, Mail, Maximize2, Minimize2, Phone, Tag, UserRound } from 'lucide-react'
import QuejaPlazoIndicator from '@/components/quejas/QuejaPlazoIndicator'
import Badge from '@/components/ui/Badge'
import { varianteEstado } from '@/lib/constants/estados'
import Button from '@/components/ui/Button'
import type { Queja } from '@/lib/types'
import type { QuejaPlazoRun, QuejaCorreoEstado } from '@/lib/queries/useQuejaSeguimiento'
import { CASE_ACTIONS, caseDate, caseDeadline, getCaseRoleCycle, getCaseProcessCycle, type CaseAudience } from '@/app/quejas/components/quejaExpedienteModel'
import { tipoVisible } from '@/lib/constants/quejas'

export type CaseSectionVariant = 'panel' | 'document' | 'plain'

export function CaseReadOnlyHeader({ etapa, onReturn }: { etapa: string; onReturn: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-qms-border bg-qms-primary-soft px-5 py-3 text-sm sm:px-8">
    <span className="flex items-center gap-2 font-semibold text-qms-primary"><Eye aria-hidden="true" className="size-4" />Solo lectura · {etapa}</span>
    <Button size="sm" variant="secondary" onClick={onReturn}>Volver a etapa actual</Button>
  </div>
}

export function CaseCompletionDate({ queja }: { queja: Queja }) {
  if (!['Finalizado', 'No Procede'].includes(queja.estado) || !queja.fecha_cierre || !Number.isFinite(Date.parse(queja.fecha_cierre))) return null
  return <p className="mt-2 text-sm text-qms-muted">{queja.estado === 'No Procede' ? 'Cerrada' : 'Finalizada'} el <time dateTime={queja.fecha_cierre}>{caseDate(queja.fecha_cierre)}</time></p>
}

/** Solo metadatos del envío final; nunca destinatarios, contenido ni claims. */
export function CaseFinalMailStatus({ messages, loading, error, onRetry }: { messages: QuejaCorreoEstado[]; loading?: boolean; error?: boolean; onRetry: () => void }) {
  const message = messages.find(item => item.tipo === 'final')
  const states: Record<string, string> = { pending: 'En cola de envío', leased: 'Enviando', retry: 'Reintento automático pendiente', sent: 'Enviado', uncertain: 'Envío por comprobar', failed: 'No se pudo enviar', skipped: 'Envío omitido' }
  return <div className="mt-4 border-t border-qms-border pt-3" aria-live="polite">
    <p className="text-xs text-qms-muted">Correo al interesado</p>
    {loading ? <p className="mt-1 text-sm text-qms-muted">Consultando envío…</p> : error ? <div role="alert"><p className="mt-1 text-sm text-qms-danger">No se pudo consultar el envío.</p><Button variant="link" size="sm" className="mt-1" onClick={onRetry}>Actualizar estado</Button></div> : <>
      <p className="mt-1 break-words text-sm">{message ? states[message.status] ?? 'Estado por comprobar' : 'Sin correo final registrado'}</p>
      {message?.status === 'sent' && message.sent_at && <time className="mt-1 block text-xs text-qms-muted" dateTime={message.sent_at}>{caseDate(message.sent_at)}</time>}
    </>}
  </div>
}

export function CaseSection({ title, children, headerActions, variant = 'panel', source }: { title: ReactNode; children: ReactNode; headerActions?: ReactNode; variant?: CaseSectionVariant; source?: 'Cliente' | 'Gestión de Calidad' | 'Responsable' | 'Gestión interna' }) {
  // 'document': hoja del centro (sin borde propio, con padding de página).
  // 'plain': barras laterales silenciosas, sin tarjeta ni borde.
  // 'panel': tarjeta independiente (Actividad, revisión, Mis Quejas).
  if (variant === 'plain') return <section className="min-w-0"><h3 className="mb-3 text-xs font-semibold tracking-wide text-qms-muted uppercase">{title}</h3>{children}</section>
  return <section data-case-document-section={variant === 'document' || undefined} className={variant === 'document' ? 'min-w-0 px-5 py-5 sm:px-8 sm:py-6' : 'ui-panel min-w-0 p-4 sm:p-5'}><div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2"><div>{source && <p className={`mb-1 text-xs font-medium ${source === 'Cliente' ? 'text-qms-muted' : 'text-qms-primary'}`}>{source}</p>}<h3 className="text-base font-semibold text-qms-dark">{title}</h3></div>{headerActions}</div>{children}</section>
}

/** Mantiene el contacto disponible sin ocupar el espacio de lectura del documento. */
export function CaseRequestHeader({ queja, children, showReceivedAt = false, variant = 'details', reference = false }: { queja: Queja; children?: ReactNode; showReceivedAt?: boolean; variant?: 'details' | 'panel'; reference?: boolean }) {
  if (variant === 'panel') {
    // Variante lateral del expediente: datos del solicitante presentados estáticos,
    // sin el desplegable del resumen pegado arriba del documento.
    return <section data-case-request className="min-w-0">
      <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-button bg-qms-primary-soft text-qms-primary"><UserRound className="size-4" /></span><h3 className="min-w-0 break-words [overflow-wrap:anywhere] text-sm font-medium text-qms-dark pt-1">{queja.cliente_nombre}</h3></div>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm">
        <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-qms-muted"><Mail aria-hidden="true" className="size-3.5 shrink-0" />Correo electrónico</dt><dd className="mt-1 break-all [overflow-wrap:anywhere]">{queja.email_cliente || 'Sin correo registrado'}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-qms-muted"><Phone aria-hidden="true" className="size-3.5 shrink-0" />Teléfono</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{queja.telefono || 'Sin registrar'}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-qms-muted"><CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />Recibida</dt><dd className="mt-1">{caseDate(queja.fecha)}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-qms-muted"><Tag aria-hidden="true" className="size-3.5 shrink-0" />{reference ? 'Tipo' : 'Tipo recibido'}</dt><dd className="mt-1">{tipoVisible(queja)}</dd></div>
      </dl>
      {children}
    </section>
  }
  return <details data-case-summary className={reference ? 'group rounded-card border border-qms-border bg-qms-surface text-sm' : 'group sticky top-0 z-10 shrink-0 border-b border-qms-border bg-qms-surface text-sm'}>
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-medium">{queja.cliente_nombre}</span>
      {showReceivedAt && !reference && <time dateTime={queja.fecha} className="hidden text-xs text-qms-muted sm:inline">Recibida {caseDate(queja.fecha)}</time>}
      <span className="text-xs text-qms-muted">{tipoVisible(queja)}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-qms-muted transition-transform group-open:rotate-180" />
    </summary>
    <div className="max-h-[45dvh] overflow-y-auto overscroll-contain">
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pt-1 pb-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div className="min-w-0"><dt className="break-words [overflow-wrap:anywhere] text-xs text-qms-muted">Correo electrónico</dt><dd className="mt-1 break-all [overflow-wrap:anywhere]">{queja.email_cliente || 'Sin correo registrado'}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-qms-muted">Teléfono</dt><dd className="mt-1 break-words">{queja.telefono || 'Sin registrar'}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-qms-muted">Recibida</dt><dd className="mt-1">{caseDate(queja.fecha)}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-qms-muted">{reference ? 'Tipo' : 'Tipo recibido'}</dt><dd className="mt-1">{tipoVisible(queja)}</dd></div>
    </dl>
    {children && <div className="border-t border-qms-border px-4 py-2">{children}</div>}
    </div>
  </details>
}

/** Mismos controles de navegación y tamaño para Quejas y Mis Quejas. El cierre lo proporciona Modal. */
export function CaseWorkspaceNavigation({ expanded, onToggleExpanded, onPrevious, onNext, disabled = false }: {
  expanded: boolean
  onToggleExpanded: () => void
  onPrevious?: () => void
  onNext?: () => void
  disabled?: boolean
}) {
  return <>
    <div className="hidden items-center gap-1 @min-[480px]/workspace:flex">
      <Button size="icon" variant="ghost" className="size-11!" aria-label="Queja anterior" title="Queja anterior" disabled={!onPrevious || disabled} onClick={onPrevious}><ChevronLeft aria-hidden="true" className="size-6" /></Button>
      <Button size="icon" variant="ghost" className="size-11!" aria-label="Queja siguiente" title="Queja siguiente" disabled={!onNext || disabled} onClick={onNext}><ChevronRight aria-hidden="true" className="size-6" /></Button>
    </div>
    <Button size="icon" variant="ghost" aria-label={expanded ? 'Reducir expediente' : 'Ampliar expediente'} title={expanded ? 'Reducir expediente' : 'Ampliar expediente'}
      aria-pressed={expanded} onClick={onToggleExpanded}>{expanded ? <Minimize2 aria-hidden="true" className="size-5" /> : <Maximize2 aria-hidden="true" className="size-5" />}</Button>
  </>
}

/** Comparte solo la geometría; cada rol conserva sus documentos, permisos y acciones. */
export function CaseWorkspace({ children, compact, compactContent, cycle, action, headerMeta, request, requestFooter, documentKey, expanded = false, cyclePlacement = 'side', presentation = 'default', documentStyle = 'sheet', readingLayout = false, qualityTwoColumn = false }: { children: ReactNode; compact: ReactNode; compactContent?: ReactNode; cycle: ReactNode; action: ReactNode; headerMeta?: ReactNode; request?: ReactNode; requestFooter?: ReactNode; documentKey: string; expanded?: boolean; cyclePlacement?: 'side' | 'top' | 'header'; presentation?: 'default' | 'reference'; documentStyle?: 'sheet' | 'cards'; readingLayout?: boolean; qualityTwoColumn?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  // Cambiar de documento comienza arriba sin desmontar editores ni borrar borradores.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    if (centerRef.current) centerRef.current.scrollTop = 0
  }, [documentKey])
  // Igualar el ancho del ciclo en la cabecera con el ancho *útil* del editor:
  // el scrollport reserva un gutter de scrollbar que la cabecera no tiene.
  useLayoutEffect(() => {
    const scrollport = scrollRef.current
    const center = centerRef.current
    const modal = scrollport?.closest('dialog')
    if (!scrollport || !modal) return
    const syncGutter = () => {
      const gutter = Math.max(scrollport.offsetWidth - scrollport.clientWidth, center ? center.offsetWidth - center.clientWidth : 0)
      modal.style.setProperty('--qms-case-scrollbar-width', `${gutter}px`)
    }
    syncGutter()
    const observer = new ResizeObserver(syncGutter)
    observer.observe(scrollport)
    if (center) observer.observe(center)
    return () => {
      observer.disconnect()
      modal.style.removeProperty('--qms-case-scrollbar-width')
    }
  }, [presentation, expanded])
  const comfortableReading = readingLayout && expanded && presentation === 'reference'
  const referenceColumns = qualityTwoColumn
    ? '@min-[1100px]:grid-cols-[minmax(0,1fr)_360px] @min-[1100px]:gap-0 @min-[1100px]:px-0'
    : comfortableReading
      ? '@min-[1100px]:grid-cols-[240px_minmax(0,1fr)_270px] @min-[1360px]:grid-cols-[280px_minmax(0,1fr)_300px] @min-[1100px]:gap-6 @min-[1100px]:px-6'
      : '@min-[1100px]:grid-cols-[220px_minmax(0,1fr)_260px] @min-[1100px]:gap-4 @min-[1100px]:px-4'
  if (presentation === 'reference') return <div data-case-workspace data-case-presentation="reference" data-case-reading-layout={comfortableReading || undefined} data-case-quality-two-columns={qualityTwoColumn || undefined} className={`@container flex min-h-0 flex-1 flex-col overflow-hidden ${qualityTwoColumn && expanded ? 'bg-white' : 'bg-qms-hover-bg'} select-text ${expanded ? '' : 'pb-3 sm:pb-4'}`}>
    {/* En escritorio el círculo ocupa el margen de página y su etiqueta se alinea con Descripción. */}
    {(cyclePlacement !== 'header' || !expanded) && <div data-case-top-cycle className={`shrink-0 border-b border-qms-border bg-qms-surface py-3 ${expanded ? 'overflow-hidden [scrollbar-gutter:stable]' : 'px-4'}`}>{expanded ? <div data-case-top-cycle-layout className={`grid w-full min-w-0 gap-4 px-3 sm:px-4 ${comfortableReading ? 'mx-auto max-w-[1500px]' : ''} ${referenceColumns}`}><div data-case-cycle-track className="min-w-0 px-5 sm:px-0 @min-[1100px]:col-start-2">{cycle}</div></div> : compact}</div>}
    {cyclePlacement === 'header' && expanded && <div data-case-mobile-cycle className="shrink-0 border-b border-qms-border bg-qms-surface px-3 py-2 @min-[1100px]/workspace:hidden">{cycle}</div>}
    {compactContent && <div data-case-triage hidden={expanded} style={expanded ? { display: 'none' } : undefined} className="mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-card border border-qms-border bg-qms-surface sm:mx-4 sm:mt-4">{compactContent}</div>}
    {/* No desmontar las columnas ni Tiptap: ocultar el mismo árbol durante el triaje. */}
    <div data-case-frame style={!expanded && compactContent ? { display: 'none' } : undefined} className={`flex min-h-0 flex-1 flex-col ${expanded ? '' : 'mx-3 mt-3 overflow-hidden rounded-card border border-qms-border bg-qms-surface sm:mx-4 sm:mt-4'}`}>
      {/* En escritorio la cuadrícula queda fija. En móvil se desplaza el conjunto apilado. */}
      <div ref={scrollRef} data-case-scroll data-case-stack-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [will-change:transform] ${expanded ? qualityTwoColumn ? 'bg-white @min-[1100px]:overflow-y-auto @min-[1100px]:[will-change:auto]' : 'bg-qms-hover-bg @min-[1100px]:overflow-clip @min-[1100px]:[will-change:auto]' : 'bg-qms-surface'}`}>
        <div data-case-layout className={`grid w-full min-w-0 gap-4 ${expanded ? `${qualityTwoColumn ? 'gap-4 p-3 sm:p-4 @min-[1100px]:gap-0 @min-[1100px]:p-0 @min-[1100px]:items-start' : comfortableReading ? 'mx-auto max-w-[1500px] gap-6 p-4 sm:p-6' : 'p-3 sm:p-4'} ${referenceColumns} ${qualityTwoColumn ? '@min-[1100px]:min-h-full @min-[1100px]:py-0' : `@min-[1100px]:h-full @min-[1100px]:grid-rows-[minmax(0,1fr)] ${comfortableReading ? '@min-[1100px]:py-6' : '@min-[1100px]:py-4'}`}` : ''}`}>
          {!qualityTwoColumn && <aside data-case-request-region hidden={!expanded && !requestFooter} className={`order-2 min-w-0 ${expanded ? '@min-[1100px]:order-none @min-[1100px]:max-h-full @min-[1100px]:overflow-y-auto @min-[1100px]:overscroll-contain' : ''}`}>
            {requestFooter ? <><div hidden={!expanded}>{request}</div><div className={expanded ? 'mt-4' : 'px-4'}>{requestFooter}</div></> : request}
          </aside>}
          <div ref={centerRef} data-case-scroll data-case-document-scroll className={`order-3 min-h-0 min-w-0 ${expanded ? qualityTwoColumn ? '@min-[1100px]:order-none @min-[1100px]:overflow-visible' : '@min-[1100px]:order-none @min-[1100px]:overflow-y-auto @min-[1100px]:overscroll-contain @min-[1100px]:[will-change:transform]' : ''}`}>
            <main data-case-document className={`min-w-0 pb-6 ${documentStyle === 'cards' ? `${comfortableReading ? 'space-y-6' : 'space-y-4'} bg-qms-hover-bg` : `divide-y divide-qms-border bg-qms-surface ${expanded && !qualityTwoColumn ? 'rounded-card border border-qms-border' : ''} ${qualityTwoColumn ? '@min-[1100px]:min-h-[calc(100dvh-70px)] bg-white' : ''}`}`}>{children}</main>
          </div>
          <aside data-case-action className={`order-1 min-w-0 ${qualityTwoColumn ? 'bg-[#E6E5E5] text-qms-dark [&_.text-qms-muted]:text-[#50565C] p-4 @min-[1100px]:order-none @min-[1100px]:sticky @min-[1100px]:top-0 @min-[1100px]:h-[calc(100dvh-70px)] @min-[1100px]:self-start @min-[1100px]:overflow-visible @min-[1100px]:border-l @min-[1100px]:border-[#D1D0D0] @min-[1100px]:px-5 @min-[1100px]:py-5' : expanded ? '@min-[1100px]:order-none @min-[1100px]:max-h-full @min-[1100px]:overflow-y-auto @min-[1100px]:overscroll-contain' : 'border-b border-qms-border bg-qms-surface p-4'}`}>
            {action}
            {qualityTwoColumn && <div data-case-quality-tools className="mt-4 border-t border-[#DFE5ED] pt-3">
              <p className="text-xs font-semibold tracking-[0.06em] text-qms-muted">MI TRABAJO EN ESTA QUEJA</p>
              {requestFooter && <div className="mt-2 space-y-2">{requestFooter}</div>}
              {request && <details className="mt-4 rounded-lg border border-[#DADCE0] bg-white">
                <summary className="cursor-pointer px-3.5 py-3 text-sm font-semibold text-qms-dark">Datos del solicitante</summary>
                <div className="border-t border-qms-border px-3.5 py-4">{request}</div>
              </details>}
            </div>}
          </aside>
        </div>
      </div>
    </div>
  </div>
  // Con solicitud en lateral, el avance vive en la línea superior y la solicitud ocupa el hueco izquierdo.
  const leftContent = request ?? cycle
  const showLeft = cyclePlacement === 'side' || !!request || !!requestFooter
  const layoutWidth = request ? 'max-w-[1600px]' : 'max-w-[1440px]'
  const layoutColumns = cyclePlacement === 'top'
    ? request ? '@min-[1100px]:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(220px,240px)]' : '@min-[1100px]:grid-cols-[minmax(0,1fr)_240px]'
    : '@min-[1100px]:grid-cols-[160px_minmax(0,1fr)_240px]'
  const layoutGrid = `grid w-full min-w-0 ${layoutWidth} gap-4 ${layoutColumns} @min-[1100px]:items-start @min-[1100px]:gap-5`
  const layoutPadding = expanded ? 'p-3 sm:p-4 @min-[1100px]:px-5 @min-[1100px]:pt-5 @min-[1100px]:pb-5 @min-[1100px]:pl-3' : ''
  return <div data-case-workspace className={`@container flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg select-text ${expanded ? '' : 'pb-3 sm:pb-4'}`}>
    <div className="shrink-0 space-y-3 border-b border-qms-border bg-qms-surface px-4 py-3 @min-[1100px]:hidden">{compact}</div>
    {cyclePlacement === 'top' && <div data-case-top-cycle className="hidden shrink-0 overflow-hidden border-b border-qms-border bg-qms-surface py-2.5 [scrollbar-gutter:stable] @min-[1100px]:block"><div className={expanded ? '' : '@min-[1100px]:mx-4'}><div data-case-top-cycle-layout className={`mx-auto ${layoutGrid} ${expanded ? 'px-3 sm:px-4 @min-[1100px]:px-5 @min-[1100px]:pl-3' : ''} @min-[1100px]:grid`}>
      {request && <div data-case-cycle-label className="min-w-0 text-sm font-semibold text-qms-muted">Estado del trámite</div>}
      <div data-case-cycle-track className="min-w-0">{cycle}</div>
      {headerMeta && <div className="min-w-0 justify-self-end">{headerMeta}</div>}
    </div></div></div>}
    {/* El marco lateral permanece visible al desplazar; conservar su nodo al ampliar mantiene los editores montados. */}
    <div data-case-frame className={`flex min-h-0 flex-1 flex-col ${expanded ? '' : 'mx-3 mt-3 overflow-hidden rounded-card border border-qms-border bg-qms-surface shadow-sm sm:mx-4 sm:mt-4'}`}>
    {/* Promover el scrollport a capa compuesta evita que, al ampliar el expediente,
        Chrome repinte todo el ancho en el hilo principal y el desplazamiento se sienta lento.
        El fondo es opaco a propósito: una capa translúcida obliga a mezclar el ancho
        completo en cada frame, justo lo que se nota al pasar de 40vw a pantalla completa. */}
    <div ref={scrollRef} data-case-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [will-change:transform] ${expanded ? 'bg-qms-hover-bg' : 'bg-qms-surface'}`}>
    <div data-case-layout className={`mx-auto ${layoutGrid} ${layoutPadding}`}>
      {/* Los laterales sticky llevan su propia capa: así el compositor reubica
          su offset durante el desplazamiento sin esperar al hilo principal. */}
      <aside className={`sticky top-5 hidden max-h-[calc(100dvh-10rem)] overflow-y-auto [will-change:transform] ${showLeft ? '@min-[1100px]:block' : ''}`}>{leftContent}{requestFooter && <div className="mt-4">{requestFooter}</div>}</aside>
      <main data-case-document className={`min-w-0 divide-y divide-qms-border bg-qms-surface pb-6 ${expanded ? 'rounded-card border border-qms-border shadow-sm' : ''}`}>{children}</main>
      <aside className="sticky top-5 hidden min-w-0 max-h-[calc(100dvh-10rem)] overflow-y-auto [will-change:transform] @min-[1100px]:block">{action}</aside>
    </div>
    </div>
    </div>
  </div>
}

/** El progreso de lectura se reutiliza en los encabezados de Quejas y Mis Quejas. */
export function CaseProcessHeader({ queja, selectedStage, onStageChange, disabled = false, chevrons = false }: {
  queja: Queja
  selectedStage?: string | null
  onStageChange?: (stage: string) => void
  disabled?: boolean
  chevrons?: boolean
}) {
  return <div data-case-process-header className="w-full min-w-0">
    <div className="hidden @min-[1100px]/workspace:block">
      <CaseCycle queja={queja} process chevrons={chevrons} selectedStage={selectedStage} onStageChange={onStageChange} disabled={disabled} />
    </div>
  </div>
}

/** Patrón de acceso lateral: mismo aspecto que archivos/notas, contenido y acción independientes. */
export function CaseSidebarShortcut({ title, description, actionLabel, icon, onClick, disabled = false, count }: {
  title: string
  description: string
  actionLabel: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  count?: number
}) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={actionLabel}
    className="w-full min-w-0 cursor-pointer rounded-card border border-qms-border bg-qms-surface p-4 text-left shadow-sm transition-colors hover:bg-qms-hover-bg disabled:cursor-not-allowed disabled:opacity-60">
    <span className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-qms-primary">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-qms-dark">{title}</span>
      {count !== undefined && <span className="rounded-button bg-qms-primary-soft px-1.5 py-0.5 text-xs font-medium text-qms-primary">{count}</span>}
    </span>
    <span className="mt-3 block break-words text-xs leading-relaxed text-qms-muted">{description}</span>
    <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-qms-primary">
      {actionLabel}<ChevronRight aria-hidden="true" className="size-4 shrink-0" />
    </span>
  </button>
}

export function CaseCycle({ queja, audience = 'quality', compact = false, variant = 'plain', line = false, process = false, chevrons = false, currentOnly = false, selectedStage, onStageChange, disabled = false }: {
  queja: Queja; audience?: CaseAudience; compact?: boolean; variant?: CaseSectionVariant; line?: boolean; process?: boolean; chevrons?: boolean; currentOnly?: boolean
  selectedStage?: string | null; onStageChange?: (stage: string) => void; disabled?: boolean
}) {
  if (process) {
    const flow = getCaseProcessCycle(queja)
    if (chevrons) return <ol data-case-chevrons aria-label={flow.label} className="flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md">
      {flow.steps.map((step, position) => {
        const selected = selectedStage === step.id
        const active = (step.current && !selectedStage) || selected
        const color = active ? 'bg-[#2A61B0] font-semibold text-white' : step.current ? 'bg-[#D9E5F5] font-semibold text-[#174574]' : step.completed ? 'bg-[#E6E5E5] font-semibold text-[#1A1718]' : 'bg-white/75 text-[#4B5563]'
        const clipPath = position === 0
          ? 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)'
          : 'polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%)'
        const label = <span className="flex min-w-0 items-center justify-center gap-1 px-3 text-xs leading-9" title={step.label}>
          {step.completed && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
          <span className="truncate">{step.label}</span>
        </span>
        return <li key={step.id} aria-current={step.current ? 'step' : undefined} className={`min-w-0 flex-1 ${position ? '-ml-2' : ''}`}>
          {onStageChange ? <button type="button" data-case-stage={step.id} aria-label={`Consultar ${step.label} en modo solo lectura`}
            aria-pressed={selected} disabled={disabled} title={`Consultar ${step.label} sin modificar el estado`}
            onClick={() => onStageChange(step.id)} style={{ clipPath }}
            className={`block h-9 w-full cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed disabled:opacity-60 ${color}`}>{label}</button>
          : <div style={{ clipPath }} className={`h-9 w-full ${color}`}>{label}</div>}
          {step.completed && <span className="sr-only">: completada</span>}
        </li>
      })}
    </ol>
    const current = flow.steps.findIndex(step => step.current)
    const completed = flow.steps.every(step => step.completed)
    const index = current >= 0 ? current : completed ? flow.steps.length - 1 : -1
    if (currentOnly) return <div data-case-cycle-compact><p className="text-sm text-qms-muted sm:text-base">{index >= 0 ? `${flow.steps[index].label} · paso ${index + 1} de ${flow.steps.length}` : 'Etapa por verificar'}</p><div aria-hidden="true" className="mt-2 flex gap-1">{flow.steps.map(step => <span key={step.id} className={`h-1 flex-1 ${step.completed ? 'bg-qms-success' : step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />)}</div></div>
    return <div data-case-process-lines className="w-full min-w-0">
      <ol aria-label={flow.label} className={`grid w-full min-w-0 gap-1.5 sm:gap-2 ${flow.steps.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {flow.steps.map((step, position) => {
          const selected = selectedStage === step.id
          const current = step.current && !selectedStage
          const label = `${position + 1}. ${step.label}`
          const content = <>
            <span className={`inline-flex min-w-0 items-center justify-center gap-1 text-[11px] sm:text-sm ${selected || current ? 'font-semibold text-qms-primary' : step.completed ? 'font-medium text-qms-muted' : 'text-qms-muted'}`}>
              <span className="truncate">{label}</span>
              {onStageChange && !step.current && <ExternalLink aria-hidden="true" className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />}
            </span>
            <span data-case-cycle-line aria-hidden="true" className={`mt-1.5 block h-1 w-full rounded-full ${selected ? 'bg-qms-primary' : step.completed ? 'bg-qms-success' : step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />
          </>
          return <li key={step.id} aria-current={current ? 'step' : undefined} className="min-w-0 text-center">
            {onStageChange ? <button type="button" data-case-stage={step.id} aria-label={`Consultar ${step.label} en modo solo lectura`}
              aria-pressed={selected} disabled={disabled} title={`Consultar ${step.label} sin modificar el estado`}
              onClick={() => onStageChange(step.id)} className="group block w-full min-w-0 cursor-pointer rounded-button px-1 py-1 text-center transition-colors hover:bg-qms-hover-bg focus-visible:outline-2 focus-visible:outline-qms-primary disabled:cursor-not-allowed disabled:opacity-60">
              {content}
            </button> : <div title={step.label}>{content}</div>}
            {step.completed && <span className="sr-only">: completada</span>}
          </li>
        })}
      </ol>
    </div>
  }
  const flow = getCaseRoleCycle(queja, audience)
  if (currentOnly) {
    const current = flow.steps.findIndex(step => step.current)
    const index = current >= 0 ? current : flow.steps.every(step => step.completed) ? flow.steps.length - 1 : -1
    return <div data-case-cycle-compact><p className="text-sm text-qms-muted sm:text-base">{index >= 0 ? `${flow.steps[index].label} · paso ${index + 1} de ${flow.steps.length}` : 'Etapa por verificar'}</p><div aria-hidden="true" className="mt-2 flex gap-1">{flow.steps.map(step => <span key={step.id} className={`h-1 flex-1 ${step.completed ? 'bg-qms-success' : step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />)}</div></div>
  }
  // Es una proyección del estado, nunca un historial de aprobaciones o fechas.
  // En línea horizontal, `line` dibuja el avance con el token azul del estado activo.
  const cycle = <ol aria-label={flow.label} className={compact ? line ? 'flex min-w-max items-center gap-0' : 'flex min-w-max items-center gap-3' : 'space-y-4'}>{flow.steps.map((step, index) => <Fragment key={step.id}>{compact && line && index > 0 && <span data-case-cycle-connector aria-hidden="true" className={`mx-3 block h-[2px] w-6 shrink-0 sm:w-10 rounded-full ${step.completed || step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />}<li title={step.label} aria-current={step.current ? 'step' : undefined} className={compact ? 'relative flex shrink-0 items-center gap-2 text-sm' : 'relative flex items-center gap-3 text-sm'}>
    <span aria-hidden="true" className={`flex ${compact ? 'size-6' : 'size-8'} shrink-0 items-center justify-center rounded-full border ${step.completed ? 'border-qms-success bg-qms-success text-white' : step.current ? 'border-qms-primary bg-qms-primary text-white' : 'border-qms-border bg-qms-hover-bg text-qms-muted'}`}>{step.completed ? <Check className="size-4" /> : index + 1}</span>
    <span className={`${compact ? 'whitespace-nowrap' : ''} ${step.completed ? 'text-qms-muted' : step.current ? 'font-semibold text-qms-primary' : 'text-qms-muted'}`}>{step.label}</span>{step.completed && <span className="sr-only">: completada</span>}
  </li></Fragment>)}</ol>
  return compact ? <div className="overflow-x-auto">{cycle}</div> : <CaseSection title={flow.label} variant={variant}>{cycle}{flow.detail && <p className="mt-4 border-t border-qms-border pt-3 text-xs text-qms-muted">{flow.detail}</p>}</CaseSection>
}

export function CaseAction({ queja, runs, children, plazoError, condensed = false, variant = 'panel', heading, presentation = 'default', responsable, actionTitle, actionDetail }: { queja: Queja; runs: QuejaPlazoRun[]; children?: ReactNode; plazoError?: boolean; condensed?: boolean; variant?: CaseSectionVariant; heading?: string; presentation?: 'default' | 'reference'; responsable?: string; actionTitle?: string; actionDetail?: string }) {
  const action = CASE_ACTIONS[queja.estado], deadline = caseDeadline(queja, runs)
  // Evaluación conserva el mismo panel lateral y los tokens visuales de las demás etapas.
  if (presentation === 'reference' && queja.estado === 'Recibido' && !actionTitle) return (
    <CaseSection title="Siguiente paso" variant="plain">
      <div data-case-evaluation-actions className="flex min-w-0 flex-col">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={queja.estado_color || varianteEstado('quejas', queja.estado)}
            className="max-w-full whitespace-normal! text-left">{queja.estado_nombre || queja.estado}</Badge>
          {deadline.vence && <QuejaPlazoIndicator deadline={deadline} className="text-xs" />}
        </div>
        {plazoError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el detalle del calendario.</p>}
        <p className="mt-2 text-xs leading-relaxed text-qms-muted">Recibida {caseDate(queja.fecha)} · Tipo: {tipoVisible(queja)}</p>
        <h4 className="mt-4 text-base font-semibold text-qms-dark">Evaluar procedencia</h4>
        <p className="mt-1 text-[13px] leading-snug text-qms-muted">Seleccioná el resultado para continuar.</p>
        {children && <>
          <div className="mt-3 flex min-w-0 flex-col gap-2">{children}</div>
        </>}
      </div>
    </CaseSection>
  )
  if (presentation === 'reference') return <CaseSection title="Siguiente paso" variant="plain"><Badge variant={queja.estado_color || varianteEstado('quejas', queja.estado)} className="max-w-full whitespace-normal! text-left">{queja.estado_nombre || queja.estado}</Badge>
    <CaseCompletionDate queja={queja} />
    {deadline.vence && <div className="mt-3"><p className="mb-1 text-sm text-qms-muted">{deadline.stageTitle}</p><QuejaPlazoIndicator deadline={deadline} /></div>}
    {plazoError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el detalle del calendario.</p>}
    <h4 className="mt-5 text-base font-semibold">{actionTitle ?? action?.title ?? 'Consultar expediente'}</h4><p className="mt-2 text-sm leading-relaxed text-qms-muted">{actionDetail ?? action?.detail ?? 'Consultar la información registrada.'}</p>
    <div className="mt-4"><p className="text-xs text-qms-muted">Responsable</p><p className="mt-1 break-words text-sm">{responsable || 'Por asignar'}</p></div>
    {children && <div className="mt-4 flex min-w-0 flex-col gap-2">{children}</div>}
  </CaseSection>
  if (condensed) return <CaseSection title="Acciones" variant={variant}>{children}</CaseSection>
  const badgeClassName = variant === 'plain' ? 'max-w-full whitespace-normal justify-start text-left' : undefined
  return <CaseSection title={heading ?? (action?.action ? 'Acción pendiente' : 'Estado del expediente')} variant={variant}><Badge variant={queja.estado_color || varianteEstado('quejas', queja.estado)} className={badgeClassName}>{queja.estado_nombre || queja.estado}</Badge><h4 className="mt-4 text-base font-semibold">{action?.title || 'Consultar expediente'}</h4><p className="mt-2 text-sm leading-relaxed text-qms-muted">{action?.detail || 'Este estado no tiene una acción disponible.'}</p>
    <CaseCompletionDate queja={queja} />
    <div className="mt-5 border-t border-qms-border pt-4"><p className="mb-2 text-xs text-qms-muted">{deadline.stageTitle}</p><QuejaPlazoIndicator deadline={deadline} />{deadline.progress !== null && <div role="progressbar" aria-label="Plazo transcurrido" aria-valuenow={Math.round(deadline.progress)} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 overflow-hidden rounded-full bg-qms-border"><div className={`h-full rounded-full ${deadline.vencido ? 'bg-qms-danger' : 'bg-qms-primary'}`} style={{ width: `${deadline.progress}%` }} /></div>}{deadline. vence && <p className="mt-2 text-xs text-qms-muted">{deadline.business ? 'Según el calendario del expediente.' : 'Días naturales hasta la fecha límite.'}</p>}{plazoError && <p role="alert" className="mt-2 text-xs text-qms-muted">No se pudo cargar el detalle del calendario. Se conserva la fecha límite registrada.</p>}</div>{children && <div className="mt-5 border-t border-qms-border pt-4">{children}</div>}
  </CaseSection>
}

'use client'

import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronRight, Mail, Phone, Tag, UserRound } from 'lucide-react'
import QuejaPlazoIndicator from '@/components/quejas/QuejaPlazoIndicator'
import Badge from '@/components/ui/Badge'
import { varianteEstado } from '@/lib/constants/estados'
import Button from '@/components/ui/Button'
import type { Queja } from '@/lib/types'
import type { QuejaPlazoRun, QuejaCorreoEstado } from '@/lib/queries/useQuejaSeguimiento'
import { CASE_ACTIONS, caseDate, caseDeadline, getCaseRoleCycle, getCaseProcessCycle, type CaseAudience } from '@/app/quejas/components/quejaExpedienteModel'
import { tipoVisible } from '@/lib/constants/quejas'

export type CaseSectionVariant = 'panel' | 'document' | 'plain'

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
  return <section className={variant === 'document' ? 'min-w-0 px-5 py-5 sm:px-8 sm:py-6' : 'ui-panel min-w-0 p-4 sm:p-5'}><div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2"><div>{source && <p className={`mb-1 text-xs font-medium ${source === 'Cliente' ? 'text-qms-muted' : 'text-qms-primary'}`}>{source}</p>}<h3 className="text-base font-semibold text-qms-dark">{title}</h3></div>{headerActions}</div>{children}</section>
}

/** Mantiene el contacto disponible sin ocupar el espacio de lectura del documento. */
export function CaseRequestHeader({ queja, children, showReceivedAt = false, variant = 'details', reference = false }: { queja: Queja; children?: ReactNode; showReceivedAt?: boolean; variant?: 'details' | 'panel'; reference?: boolean }) {
  if (variant === 'panel') {
    // Variante lateral del expediente: datos del solicitante presentados estáticos,
    // sin el desplegable del resumen pegado arriba del documento.
    return <section data-case-request className="min-w-0 rounded-card border border-qms-border bg-qms-surface p-4">
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

/** Comparte solo la geometría; cada rol conserva sus documentos, permisos y acciones. */
export function CaseWorkspace({ children, compact, cycle, action, headerMeta, request, requestFooter, documentKey, expanded = false, cyclePlacement = 'side', presentation = 'default', documentStyle = 'sheet' }: { children: ReactNode; compact: ReactNode; cycle: ReactNode; action: ReactNode; headerMeta?: ReactNode; request?: ReactNode; requestFooter?: ReactNode; documentKey: string; expanded?: boolean; cyclePlacement?: 'side' | 'top' | 'header'; presentation?: 'default' | 'reference'; documentStyle?: 'sheet' | 'cards' }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Cambiar de documento comienza arriba sin desmontar editores ni borrar borradores.
  useLayoutEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [documentKey])
  // Igualar el ancho del ciclo en la cabecera con el ancho *útil* del editor:
  // el scrollport reserva un gutter de scrollbar que la cabecera no tiene.
  useLayoutEffect(() => {
    const scrollport = scrollRef.current
    const modal = scrollport?.closest('dialog')
    if (!scrollport || !modal) return
    const syncGutter = () => {
      const gutter = Math.max(0, scrollport.offsetWidth - scrollport.clientWidth)
      modal.style.setProperty('--qms-case-scrollbar-width', `${gutter}px`)
    }
    syncGutter()
    const observer = new ResizeObserver(syncGutter)
    observer.observe(scrollport)
    return () => {
      observer.disconnect()
      modal.style.removeProperty('--qms-case-scrollbar-width')
    }
  }, [presentation, expanded])
  const referenceColumns = '@min-[1100px]:grid-cols-[220px_minmax(0,1fr)_260px] @min-[1100px]:gap-4 @min-[1100px]:px-4'
  if (presentation === 'reference') return <div data-case-workspace data-case-presentation="reference" className={`@container flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg select-text ${expanded ? '' : 'pb-3 sm:pb-4'}`}>
    {/* En escritorio el círculo ocupa el margen de página y su etiqueta se alinea con Descripción. */}
    {(cyclePlacement !== 'header' || !expanded) && <div data-case-top-cycle className={`shrink-0 border-b border-qms-border bg-qms-surface py-3 ${expanded ? 'overflow-hidden [scrollbar-gutter:stable]' : 'px-4'}`}>{expanded ? <div data-case-top-cycle-layout className={`grid w-full min-w-0 gap-4 px-3 sm:px-4 ${referenceColumns}`}><div data-case-cycle-track className="min-w-0 px-5 sm:px-0 @min-[1100px]:col-start-2">{cycle}</div></div> : compact}</div>}
    <div data-case-frame className={`flex min-h-0 flex-1 flex-col ${expanded ? '' : 'mx-3 mt-3 overflow-hidden rounded-card border border-qms-border bg-qms-surface sm:mx-4 sm:mt-4'}`}>
      {/* El scrollport y los documentos conservan sus nodos al ampliar/reducir. */}
      <div ref={scrollRef} data-case-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [will-change:transform] ${expanded ? 'bg-qms-hover-bg' : 'bg-qms-surface'}`}>
        <div data-case-layout className={`grid w-full min-w-0 gap-4 ${expanded ? `p-3 sm:p-4 ${referenceColumns} @min-[1100px]:items-start @min-[1100px]:py-4` : ''}`}>
          <aside data-case-request-region hidden={!expanded && !requestFooter} className={`order-2 min-w-0 ${expanded ? '@min-[1100px]:sticky @min-[1100px]:top-4 @min-[1100px]:self-start @min-[1100px]:order-none' : ''}`}>
            {requestFooter ? <><div hidden={!expanded}>{request}</div><div className={expanded ? 'mt-4' : 'px-4'}>{requestFooter}</div></> : request}
          </aside>
          <main data-case-document className={`order-3 min-w-0 pb-6 ${documentStyle === 'cards' ? 'space-y-4 bg-qms-hover-bg' : `divide-y divide-qms-border bg-qms-surface ${expanded ? 'rounded-card border border-qms-border' : ''}`} ${expanded ? '@min-[1100px]:order-none' : ''}`}>{children}</main>
          <aside data-case-action className={`order-1 min-w-0 bg-qms-surface p-4 ${expanded ? '@min-[1100px]:sticky @min-[1100px]:top-4 @min-[1100px]:self-start @min-[1100px]:order-none @min-[1100px]:bg-transparent @min-[1100px]:p-0' : 'border-b border-qms-border'}`}>{action}</aside>
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
export function CaseProcessHeader({ queja }: { queja: Queja }) {
  return <div data-case-process-header className="w-full min-w-0">
    <div className="hidden @min-[1100px]/workspace:block"><CaseCycle queja={queja} process /></div>
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

export function CaseCycle({ queja, audience = 'quality', compact = false, variant = 'plain', line = false, process = false, currentOnly = false }: { queja: Queja; audience?: CaseAudience; compact?: boolean; variant?: CaseSectionVariant; line?: boolean; process?: boolean; currentOnly?: boolean }) {
  if (process) {
    const flow = getCaseProcessCycle(queja)
    const current = flow.steps.findIndex(step => step.current)
    const completed = flow.steps.every(step => step.completed)
    const index = current >= 0 ? current : completed ? flow.steps.length - 1 : -1
    if (currentOnly) return <div data-case-cycle-compact><p className="text-sm text-qms-muted sm:text-base">{index >= 0 ? `${flow.steps[index].label} · paso ${index + 1} de ${flow.steps.length}` : 'Etapa por verificar'}</p><div aria-hidden="true" className="mt-2 flex gap-1">{flow.steps.map(step => <span key={step.id} className={`h-1 flex-1 ${step.completed ? 'bg-qms-success' : step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />)}</div></div>
    return <div data-case-process-lines className="w-full min-w-0">
      <ol aria-label={flow.label} className={`grid w-full min-w-0 gap-1.5 sm:gap-2 ${flow.steps.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {flow.steps.map((step, position) => <li key={step.id} title={step.label} aria-current={step.current ? 'step' : undefined} className="min-w-0 text-center">
          <span className={`block truncate text-[11px] sm:text-sm ${step.current ? 'font-semibold text-qms-primary' : step.completed ? 'font-medium text-qms-muted' : 'text-qms-muted'}`}>{position + 1}. {step.label}</span>
          <span data-case-cycle-line aria-hidden="true" className={`mt-1.5 block h-1 w-full rounded-full ${step.completed ? 'bg-qms-success' : step.current ? 'bg-qms-primary' : 'bg-qms-border'}`} />
          {step.completed && <span className="sr-only">: completada</span>}
        </li>)}
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

const mailLabels: Record<QuejaCorreoEstado['tipo'], string> = {
  recibido: 'Acuse de recibo', investigacion: 'Inicio de investigación', final: 'Comunicación final',
  interno_recibido: 'Recepción · Calidad',
  interno_evaluacion_1: 'Evaluación: falta 1 día hábil · Calidad',
  interno_asignacion: 'Asignación al responsable',
  interno_investigacion_5: 'Investigación: faltan 5 días hábiles · Calidad',
  interno_investigacion_3: 'Investigación: faltan 3 días hábiles · Calidad y responsable',
  interno_evaluacion_vencida: 'Evaluación vencida',
  interno_investigacion_vencida: 'Investigación vencida',
}
const mailStatus: Record<string, string> = { pending: 'Pendiente', leased: 'En proceso', retry: 'Reintento pendiente', sent: 'Aceptado por correo', uncertain: 'Requiere comprobación', failed: 'Fallido', skipped: 'Omitido' }
export function CaseMailStatus({ messages }: { messages: QuejaCorreoEstado[] }) {
  return <CaseSection title="Comunicaciones"><p className="mb-3 text-xs text-qms-muted">El estado corresponde al servicio de envío; no confirma lectura ni entrega en la bandeja.</p>{messages.length === 0 ? <p className="text-sm text-qms-muted">No hay comunicaciones registradas.</p> : <ul className="divide-y divide-qms-border">{messages.map(message => <li key={message.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{mailLabels[message.tipo]}</span>{mailStatus[message.status] && <Badge variant="neutral">{mailStatus[message.status]}</Badge>}</div>{message.sent_at && <p className="mt-1 text-xs text-qms-muted">{caseDate(message.sent_at)}</p>}</li>)}</ul>}</CaseSection>
}

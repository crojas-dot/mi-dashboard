'use client'

import type { ReactNode } from 'react'
import { ArrowRight, BookOpenCheck, ClipboardCheck, FileCheck2, FilePenLine, FolderCheck, MailCheck, Paperclip, SearchCheck, ShieldCheck, TriangleAlert, ChevronRight } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import QuejaPlazoIndicator from '@/components/quejas/QuejaPlazoIndicator'
import { varianteEstado } from '@/lib/constants/estados'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaPlazoRun } from '@/lib/queries/useQuejaSeguimiento'
import { caseDeadline, type CaseTriageNextStepData } from './quejaExpedienteModel'
import Button from '@/components/ui/Button'

/** Triaje común sin editores. El expediente íntegro permanece montado en CaseWorkspace. */
export function CaseTriageSummary({ queja, runs, responsable, plazoError = false, primaryAction, children, footer }: {
  queja: Queja
  runs: QuejaPlazoRun[]
  responsable?: string
  plazoError?: boolean
  primaryAction?: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  const deadline = caseDeadline(queja, runs)
  return <div data-case-triage-summary className="flex h-full min-h-0 flex-col bg-qms-surface">
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
      <section className="space-y-3 border-b border-qms-border pb-4" aria-label="Situación del expediente">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={queja.estado_color || varianteEstado('quejas', queja.estado)}>{queja.estado_nombre || queja.estado}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-qms-muted">Plazo</dt>
            <dd className="mt-1">{deadline.vence ? <QuejaPlazoIndicator deadline={deadline} /> : <span className="text-qms-muted">{deadline.label}</span>}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-qms-muted">Responsable</dt>
            <dd className="mt-1 truncate font-medium text-qms-dark" title={responsable || 'Por asignar'}>{responsable || 'Por asignar'}</dd>
          </div>
        </dl>
        {plazoError && <p role="alert" className="text-xs text-qms-muted">No se pudo consultar el detalle del calendario.</p>}
        {primaryAction && <div data-case-triage-review-cta>{primaryAction}</div>}
      </section>
      {children}
    </div>
    <div data-case-triage-footer className="shrink-0 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-5">{footer}</div>
  </div>
}

const nextStepIcons = {
  clipboard: ClipboardCheck,
  search: SearchCheck,
  review: ShieldCheck,
  mail: MailCheck,
  archive: FolderCheck,
  edit: FilePenLine,
  saved: FileCheck2,
  warning: TriangleAlert,
  file: BookOpenCheck,
} as const

const nextStepTones = {
  blue: 'border-blue-100 bg-blue-50/70 text-blue-700',
  amber: 'border-amber-100 bg-amber-50/80 text-amber-800',
  green: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
  slate: 'border-slate-100 bg-slate-50 text-slate-600',
} as const

/** Orienta antes de ampliar. No tiene handlers de aprobar, devolver, enviar ni publicar. */
export function CaseTriageNextStep({ step, onOpen, disabled = false }: {
  step: CaseTriageNextStepData
  onOpen: () => void
  disabled?: boolean
}) {
  const Icon = nextStepIcons[step.icon]
  return <section data-case-triage-next-step aria-label="Siguiente paso"
    className={`min-w-0 rounded-md border px-3.5 py-3.5 sm:px-4 ${nextStepTones[step.tone]}`}>
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/75">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide uppercase">Siguiente paso</p>
        <h3 className="mt-0.5 text-sm font-semibold text-qms-dark">{step.title}</h3>
        <p className="mt-1 line-clamp-2 break-words text-[13px] leading-[1.45rem] text-slate-600">{step.description}</p>
      </div>
    </div>
    <Button type="button" data-case-triage-expand size="sm" variant="primary"
      className="mt-3 min-h-10 w-full justify-center gap-2 rounded-md bg-qms-primary! px-3 text-white! shadow-sm hover:bg-blue-700! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      disabled={disabled} onClick={onOpen}>
      <span className="min-w-0 break-words text-center">{step.ctaLabel}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </Button>
  </section>
}

export function CaseTriageExcerpt({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <section className="min-w-0 space-y-2" aria-label={title}>
    <h3 className="text-sm font-semibold text-qms-dark">{title}</h3>
    <p className="line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-qms-muted">{text || 'Sin contenido registrado.'}</p>
    {children}
  </section>
}

export function CaseTriageAttachments({ files, onPreview, loading = false, error = false }: {
  files: QuejaAdjunto[]
  onPreview: (file: QuejaAdjunto) => void
  loading?: boolean
  error?: boolean
}) {
  if (loading) return <p className="text-xs text-qms-muted">Consultando adjuntos…</p>
  if (error) return <p role="alert" className="text-xs text-qms-muted">No se pudieron consultar los adjuntos.</p>
  if (!files.length) return null
  const visible = files.slice(0, 2)
  return <section data-case-triage-attachments className="space-y-2" aria-label="Adjuntos del expediente">
    <p className="text-xs font-medium text-qms-muted">Adjuntos ({files.length})</p>
    <div className="flex flex-wrap gap-2">
      {visible.map(file => <button key={file.id} type="button" onClick={() => onPreview(file)}
        title={'Previsualizar ' + file.nombre}
        className="inline-flex max-w-full items-center gap-1.5 rounded-button border border-qms-border bg-qms-hover-bg px-2.5 py-1.5 text-xs text-qms-dark hover:border-qms-primary/40 focus-visible:outline-2 focus-visible:outline-qms-primary">
        <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-qms-muted" />
        <span className="max-w-40 truncate">{file.nombre}</span>
      </button>)}
    </div>
    {files.length > 2 && <p className="text-xs text-qms-muted">+{files.length - 2} más en ampliado</p>}
  </section>
}

export function CaseTriageFooter({ count, onOpen, title = 'Historial y observaciones' }: {
  count?: number
  onOpen: () => void
  title?: string
}) {
  return <button type="button" onClick={onOpen}
    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-button text-left text-sm font-medium text-qms-dark hover:text-qms-primary focus-visible:outline-2 focus-visible:outline-qms-primary">
    <span className="truncate">{title}{count !== undefined ? ' (' + count + ')' : ''}</span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-qms-primary" />
  </button>
}

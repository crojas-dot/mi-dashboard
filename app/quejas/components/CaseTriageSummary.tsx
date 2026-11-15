'use client'

import type { ReactNode } from 'react'
import { ChevronRight, Paperclip } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import QuejaPlazoIndicator from '@/components/quejas/QuejaPlazoIndicator'
import { varianteEstado } from '@/lib/constants/estados'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaPlazoRun } from '@/lib/queries/useQuejaSeguimiento'
import { caseDeadline } from './quejaExpedienteModel'

/** Triaje común sin editores. El expediente íntegro permanece montado en CaseWorkspace. */
export function CaseTriageSummary({ queja, runs, responsable, plazoError = false, children, footer }: {
  queja: Queja
  runs: QuejaPlazoRun[]
  responsable?: string
  plazoError?: boolean
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
      </section>
      {children}
    </div>
    <div data-case-triage-footer className="shrink-0 border-t border-qms-border bg-qms-surface px-4 py-3 sm:px-5">{footer}</div>
  </div>
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

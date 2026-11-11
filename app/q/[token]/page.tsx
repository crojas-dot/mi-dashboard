'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { Upload, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useFormularioPublico } from '@/lib/queries/useFormularioPublico'
import { CATEGORIAS_PUBLICAS, PUBLIC_FILE_ACCEPT, MAX_PUBLIC_FILES, PublicRequestError, publicErrorMessage, type PublicQuejaField } from '@/lib/services/publicQuejasClient'
import { PUBLIC_QUEJA_LIMITES, publicQuejaFieldMessage } from '@/lib/utils/publicQuejaValidation'
import { usePublicQuejaForm } from '@/app/q/components/usePublicQuejaForm'

// Mantener el mismo ancho al cargar, enviar y confirmar evita saltos de tamaño.
const PUBLIC_FORM_WIDTH = 'w-full max-w-[896px]'

function PublicField({ field, label, error, children }: {
  field: PublicQuejaField; label: string; error?: string; children: ReactNode
}) {
  return <Field id={`public-${field}`} label={label}>
    {children}
    {/* El aviso visible es el flotante; este nodo conserva el vínculo accesible del campo. */}
    {error && <p id={`public-${field}-error`} className="sr-only">{error}</p>}
  </Field>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FormularioQuejaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = params.token ?? ''
  // Un token nuevo es otra visita y otro borrador; la respuesta anterior no puede modificarlo.
  return <FormularioQuejaPublica key={token} token={token} />
}

function FormularioQuejaPublica({ token }: { token: string }) {
  const consulta = useFormularioPublico(token)
  const form = usePublicQuejaForm(token)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!form.invalidField || form.enviando || form.confirmationPending) return
    const input = document.getElementById(`public-${form.invalidField.field}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
    if (!input) return
    // El navegador ancla el aviso al campo y lo retira al corregirlo.
    input.setCustomValidity(publicQuejaFieldMessage(form.invalidField.field))
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    input.reportValidity()
    return () => input.setCustomValidity('')
  }, [form.invalidField, form.enviando, form.confirmationPending])

  const fieldError = (field: PublicQuejaField) => form.invalidField?.field === field ? form.error : undefined
  // El error de un campo usa el aviso flotante; el pie conserva solo errores operativos.
  const footerError = form.invalidField ? '' : form.error || form.archivos.find(entry => entry.status === 'fallido')?.error || ''
  const fieldAttributes = (field: PublicQuejaField) => ({
    'aria-invalid': !!fieldError(field),
    'aria-describedby': fieldError(field) ? `public-${field}-error` : undefined,
  })

  if (!form.receipt && token && consulta.isPending) {
    return <div className="flex min-h-dvh items-start justify-center px-4 py-6">
      <LoadingSkeleton variant="form" label="Cargando formulario…" className={PUBLIC_FORM_WIDTH} />
    </div>
  }

  if (!form.receipt && (!token || !consulta.data || consulta.error)) {
    const invalid = !token || consulta.error instanceof PublicRequestError && [404, 410].includes(consulta.error.status)
    return <div className="flex min-h-dvh items-start justify-center p-4 py-6">
      <div className={`${PUBLIC_FORM_WIDTH} rounded-card border border-qms-border bg-qms-surface p-6 text-center shadow-sm sm:p-8`}>
        <h1 className="m-0 text-xl font-bold text-qms-dark">{invalid ? 'Enlace no válido' : 'Servicio no disponible'}</h1>
        <p role={invalid ? undefined : 'alert'} className="mt-2 text-sm text-qms-muted">
          {invalid ? 'Este enlace no es válido o ya no está disponible.' : publicErrorMessage(consulta.error, 'No se pudo cargar el formulario. Intentá de nuevo más tarde.')}
        </p>
        {!invalid && <Button className="mt-4 min-h-11" variant="secondary" loading={consulta.isFetching} loadingLabel="Cargando formulario…" onClick={() => void consulta.refetch()}>Reintentar</Button>}
      </div>
    </div>
  }

  const disabled = form.enviando || form.confirmationPending || !!form.receipt
  const uploaded = form.archivos.filter(entry => entry.status === 'subido').length
  const failed = form.archivos.filter(entry => entry.status === 'fallido').length
  const completed = !!form.receipt && form.finalized && uploaded === form.archivos.length
  const fileStatus = { pendiente: 'Pendiente', subiendo: 'Subiendo…', subido: 'Adjuntado', fallido: 'No adjuntado' }

  // Recibir el folio no significa que los adjuntos y la finalización hayan terminado.
  if (completed && !form.enviando && form.receipt) {
    return <div className="flex min-h-dvh items-start justify-center p-4 py-6">
      <div role="status" aria-atomic="true" className={`${PUBLIC_FORM_WIDTH} rounded-card border border-qms-border bg-qms-surface`}>
        <div className="flex items-center gap-3 border-b border-qms-border px-5 py-4 sm:px-6">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-qms-primary text-lg font-semibold leading-none text-white">
            E
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-qms-dark">QMS ECA</p>
            <p className="text-xs text-qms-muted">Gestión de Calidad</p>
          </div>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <h1 className="m-0 text-xl font-semibold text-qms-dark">Queja registrada</h1>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-qms-border pb-4 text-sm text-qms-muted">
            Número de registro
            <strong className="min-w-0 select-text break-all text-lg font-semibold text-qms-primary">{form.receipt.folio}</strong>
          </p>
          <p className="mt-5 text-base text-qms-dark">Recibimos tu información correctamente. Gestión de Calidad revisará tu queja y te comunicará el resultado.</p>
          <p className="mt-3 text-sm text-qms-muted">Recibirás la confirmación en el correo electrónico indicado.</p>
          {form.trackingUrl && <div className="mt-5">
            <a className="ui-button ui-button-primary min-h-11 w-full sm:w-auto" href={form.trackingUrl} referrerPolicy="no-referrer">Consultar mi trámite</a>
            <p className="mt-3 text-xs text-qms-muted">El enlace abre tu trámite directamente, sin contraseña. Guardalo y compartilo solo con personas de confianza.</p>
          </div>}
          {form.trackingState === 'pending' && <div className="mt-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-qms-dark">Seguimiento privado</h2>
              <p className="mt-1 text-sm text-qms-muted">Tu queja ya está registrada. Podés volver a obtener el enlace sin repetir el envío ni los adjuntos.</p>
            </div>
            {form.error && <p role="alert" className="text-sm text-qms-danger">{form.error}</p>}
            <Button className="min-h-11 w-full sm:w-auto" variant="secondary" loading={form.retryingTracking} loadingLabel="Obteniendo enlace…" onClick={() => void form.retryTracking()}>Obtener enlace de seguimiento</Button>
          </div>}
        </div>
        <div className="space-y-1 border-t border-qms-border px-5 py-3 text-xs text-qms-muted sm:px-6">
          {form.archivos.length > 0 && <p>Evidencias adjuntadas: {uploaded} de {form.archivos.length}.</p>}
          <p>Conservalo para tus consultas con Gestión de Calidad.</p>
        </div>
      </div>
    </div>
  }

  return <div className="flex min-h-dvh items-start justify-center p-4 py-6">
    <div className={`${PUBLIC_FORM_WIDTH} flex h-[calc(100dvh-48px)] flex-col rounded-card border border-qms-border bg-qms-surface p-4 pb-0 shadow-sm sm:p-6 sm:pb-0`}>
      <div className="mb-3 shrink-0 border-b border-qms-border pb-3">
        <h1 className="m-0 text-xl font-semibold text-qms-dark">Registro de queja</h1>
        <p className="mt-1 text-sm text-qms-muted">{consulta.data?.nombre || 'Formulario de quejas'}</p>
      </div>
      {/* El validador compartido también cubre required/email y permite enfocar el error dentro del scroll. */}
      <form noValidate onSubmit={(event) => { event.preventDefault(); void form.submit() }} className="flex min-h-0 flex-1 flex-col">
        {/* El contenido se acorta en pantallas bajas; el envío conserva su espacio sin tapar campos. */}
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-1 pb-4 pt-1 [scrollbar-gutter:stable]">
        <div aria-hidden="true" hidden>
          <label htmlFor="public-website">Sitio web</label>
          <input id="public-website" name="qms-contact-check" type="text" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore value={form.honeypot} onChange={(event) => form.setHoneypot(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PublicField field="nombre" label="Nombre *" error={fieldError('nombre')}>
            <Input id="public-nombre" name="nombre" autoComplete="name" required maxLength={PUBLIC_QUEJA_LIMITES.nombre} disabled={disabled} value={form.draft.nombre} onChange={(event) => form.updateField('nombre', event.target.value)} className="w-full" {...fieldAttributes('nombre')} />
          </PublicField>
          <PublicField field="email" label="Correo electrónico *" error={fieldError('email')}>
            <Input id="public-email" name="email" autoComplete="email" type="email" required maxLength={PUBLIC_QUEJA_LIMITES.email} disabled={disabled} value={form.draft.email} onChange={(event) => form.updateField('email', event.target.value)} className="w-full" {...fieldAttributes('email')} />
          </PublicField>
          <PublicField field="telefono" label="Teléfono (opcional)" error={fieldError('telefono')}>
            <Input id="public-telefono" name="telefono" autoComplete="tel" type="tel" inputMode="tel" maxLength={PUBLIC_QUEJA_LIMITES.telefono} disabled={disabled} value={form.draft.telefono} onChange={(event) => form.updateField('telefono', event.target.value)} className="w-full" {...fieldAttributes('telefono')} />
          </PublicField>
          <PublicField field="categoria" label="Tipo *" error={fieldError('categoria')}>
            <Select id="public-categoria" name="categoria" required disabled={disabled} value={form.draft.categoria} onChange={(event) => form.updateField('categoria', event.target.value)} {...fieldAttributes('categoria')}>
              <option value="">Seleccionar tipo</option>
              {CATEGORIAS_PUBLICAS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </Select>
          </PublicField>
        </div>
        <PublicField field="descripcion" label="Descripción *" error={fieldError('descripcion')}>
          <Textarea id="public-descripcion" name="descripcion" required rows={6} maxLength={PUBLIC_QUEJA_LIMITES.descripcion} disabled={disabled} value={form.draft.descripcion} onChange={(event) => form.updateField('descripcion', event.target.value)} className="w-full resize-y [@media(min-width:640px)_and_(max-height:680px)]:h-28" {...fieldAttributes('descripcion')} />
        </PublicField>
        {(consulta.data?.uploadsAllowed || form.archivos.length > 0) && <Field id="public-archivos" label="Evidencias (opcional)" hint={`PDF, JPEG o PNG. Hasta ${MAX_PUBLIC_FILES} archivos, de 4 MB por archivo.`}>
          <input ref={fileInputRef} id="public-archivos-input" type="file" hidden
            aria-label="Seleccionar evidencias" multiple accept={PUBLIC_FILE_ACCEPT} disabled={disabled}
            onChange={(event) => {
              form.agregarArchivos(event.target.files)
              event.target.value = ''
            }} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button id="public-archivos" variant="secondary" disabled={disabled} className="min-h-11 px-3 text-qms-primary"
                aria-describedby="public-archivos-hint public-archivos-count" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden="true" /> Adjuntar archivos
              </Button>
              <span id="public-archivos-count" className="text-xs text-qms-muted" aria-live="polite">
                {form.archivos.length > 0 ? `${form.archivos.length} de ${MAX_PUBLIC_FILES} archivos` : 'Sin archivos adjuntos'}
              </span>
            </div>
            {/* La lista crece solo hasta dos filas; el pie de envío conserva su propio espacio. */}
            {form.archivos.length > 0 && <ul aria-label="Evidencias seleccionadas" tabIndex={0} className="mt-2 max-h-26 min-w-0 divide-y divide-qms-border overflow-y-auto overscroll-contain rounded-button border border-qms-border [scrollbar-gutter:stable]">
                {form.archivos.map((entry) => <li key={entry.uploadId} className="flex min-h-13 items-center gap-2 px-3 py-1">
                  <div className="min-w-0 flex-1 break-words text-xs text-qms-dark">
                    <span className="block select-text truncate" title={entry.file.name}>{entry.file.name}</span>
                    {form.receipt && <p className={entry.status === 'fallido' ? 'mt-1 text-qms-danger' : entry.status === 'subido' ? 'mt-1 text-qms-success' : 'mt-1 text-qms-muted'}>{entry.error || fileStatus[entry.status]}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-qms-muted">{formatBytes(entry.file.size)}</span>
                  {!form.receipt && <Button size="icon" variant="ghost" disabled={disabled} className="min-h-11 min-w-11 shrink-0" aria-label={`Quitar ${entry.file.name}`} title="Quitar archivo" onClick={() => form.quitarArchivo(entry.uploadId)}><X className="h-4 w-4" aria-hidden="true" /></Button>}
                </li>)}
              </ul>}
          </div>
        </Field>}
        </div>
        <div className="-mx-4 shrink-0 space-y-3 rounded-b-card border-t border-qms-border bg-qms-surface px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 sm:pb-6">
          {(form.confirmationPending || footerError || form.receipt) && <div className="space-y-2" aria-live="polite" aria-atomic="true">
            {form.receipt && <p className="text-sm text-qms-dark">Queja registrada. Tu folio es <strong className="font-mono text-qms-primary">{form.receipt.folio}</strong>. Guardalo para dar seguimiento.</p>}
            <p role={footerError ? 'alert' : 'status'} className={footerError ? 'text-sm text-qms-danger' : completed ? 'text-sm text-qms-success' : 'text-sm text-qms-muted'}>
              {footerError || (form.enviando ? form.etapa : completed ? 'Envío completado.' : form.receipt ? (failed ? 'La queja conserva su folio. Podés reintentar únicamente las evidencias pendientes.' : 'La queja está registrada; falta confirmar la finalización.') : 'Tus datos se conservaron. Reintentá el mismo envío sin crear otra queja.')}
            </p>
            {form.receipt && form.archivos.length > 0 && <p className="text-xs text-qms-muted">{uploaded} de {form.archivos.length} evidencias adjuntadas.</p>}
          </div>}
          {form.receipt ? <Button type="button" className="min-h-11 w-full" loading={form.enviando} loadingLabel={form.etapa || 'Enviando…'} disabled={completed} onClick={() => void form.retryPending()}>
            {form.enviando ? form.etapa : completed ? 'Envío completado' : failed ? 'Reintentar evidencias pendientes' : 'Reintentar finalización'}
          </Button> : <Button type="submit" className="h-11 w-full" loading={form.enviando} loadingLabel={form.etapa || 'Enviando…'}>{form.enviando ? form.etapa : form.confirmationPending ? 'Reintentar el mismo envío' : 'Enviar queja'}</Button>}
        </div>
      </form>
    </div>
  </div>
}

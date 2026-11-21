'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Upload, X } from 'lucide-react'
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
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'
import PublicQmsHeader from '@/app/q/components/PublicQmsHeader'

function PublicField({ field, label, error, children, className }: {
  field: PublicQuejaField; label: string; error?: string; children: ReactNode; className?: string
}) {
  return <Field id={`public-${field}`} label={label} className={className}>
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

export default function FormularioQuejaPublica({ token, isEmbed, initialLogo }: { token: string; isEmbed: boolean; initialLogo?: string }) {
  const consulta = useFormularioPublico(token)
  const { data: identidad } = useIdentidadImagenes(initialLogo === undefined)
  const logoFormulario = initialLogo ?? identidad?.formulario_encabezado ?? ''
  const cardClass = isEmbed ? 'min-w-0' : 'ui-auth-card min-w-0 p-4 sm:px-8'
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
    return <LoadingSkeleton variant="form" label="Cargando formulario…" framed={false} className={isEmbed ? undefined : 'ui-auth-card'} />
  }

  if (!form.receipt && (!token || !consulta.data || consulta.error)) {
    const invalid = !token || consulta.error instanceof PublicRequestError && [404, 410].includes(consulta.error.status)
    return <div className={`${cardClass} text-center`}>
        <h1 className="m-0 text-xl font-bold text-qms-dark">{invalid ? 'Enlace no válido' : 'Servicio no disponible'}</h1>
        <p role={invalid ? undefined : 'alert'} className="mt-2 text-sm text-qms-muted">
          {invalid ? 'Este enlace no es válido o ya no está disponible.' : publicErrorMessage(consulta.error, 'No se pudo cargar el formulario. Intentá de nuevo más tarde.')}
        </p>
        {!invalid && <Button className="mt-4 min-h-11 text-base" variant="secondary" loading={consulta.isFetching} loadingLabel="Cargando formulario…" onClick={() => void consulta.refetch()}>Reintentar</Button>}
    </div>
  }

  const disabled = form.enviando || form.confirmationPending || !!form.receipt
  const uploaded = form.archivos.filter(entry => entry.status === 'subido').length
  const failed = form.archivos.filter(entry => entry.status === 'fallido').length
  const completed = !!form.receipt && form.finalized && uploaded === form.archivos.length
  const fileStatus = { pendiente: form.receipt ? 'Pendiente' : 'Seleccionado', subiendo: 'Subiendo…', subido: 'Adjuntado', fallido: 'No adjuntado' }

  const encabezado = (title: string, subtitle: string, Title: 'h1' | 'p' = 'p') =>
    <PublicQmsHeader title={title} subtitle={subtitle} logo={logoFormulario} Title={Title} />

  // Recibir el folio no significa que los adjuntos y la finalización hayan terminado.
  if (completed && !form.enviando && form.receipt) {
    return <div role="status" aria-atomic="true" className={`${cardClass} ${isEmbed ? '' : 'my-auto'}`}>
        {encabezado('QMS ECA', 'Gestión de Calidad')}
        <div className="py-5 sm:py-6">
          <h1 className="m-0 text-xl font-semibold text-qms-dark">Queja registrada</h1>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-qms-border pb-4 text-sm text-qms-muted">
            Número de registro
            <strong className="min-w-0 select-text break-all text-lg font-semibold text-qms-primary">{form.receipt.folio}</strong>
          </p>
          <p className="mt-5 text-base text-qms-dark">Recibimos tu información correctamente. Gestión de Calidad revisará tu queja y te comunicará el resultado.</p>
          <p className="mt-3 text-sm text-qms-muted">Recibirás la confirmación en el correo electrónico indicado.</p>
          {form.trackingUrl && <div className="mt-5">
            <a className="ui-button ui-button-primary min-h-11 w-full text-base sm:w-auto" href={form.trackingUrl} target={isEmbed ? '_blank' : undefined} rel={isEmbed ? 'noreferrer' : undefined} referrerPolicy="no-referrer">Consultar mi trámite</a>
            <p className="mt-3 text-xs text-qms-muted">El enlace abre tu trámite directamente, sin contraseña. Guardalo y compartilo solo con personas de confianza.</p>
          </div>}
          {form.trackingState === 'pending' && <div className="mt-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-qms-dark">Seguimiento privado</h2>
              <p className="mt-1 text-sm text-qms-muted">Tu queja ya está registrada. Podés volver a obtener el enlace sin repetir el envío ni los adjuntos.</p>
            </div>
            {form.error && <p role="alert" className="text-sm text-qms-danger">{form.error}</p>}
            <Button className="min-h-11 w-full text-base sm:w-auto" variant="secondary" loading={form.retryingTracking} loadingLabel="Obteniendo enlace…" onClick={() => void form.retryTracking()}>Obtener enlace de seguimiento</Button>
          </div>}
        </div>
        <div className="space-y-1 border-t border-qms-border pt-3 text-xs text-qms-muted">
          {form.archivos.length > 0 && <p>Evidencias adjuntadas: {uploaded} de {form.archivos.length}.</p>}
          <p>Conservalo para tus consultas con Gestión de Calidad.</p>
        </div>
    </div>
  }

  return <section className={`${cardClass} ${isEmbed ? '' : 'sm:flex sm:flex-1 sm:flex-col'}`}>
      {encabezado('Registro de queja', consulta.data?.nombre || 'Formulario de quejas', 'h1')}
      <form noValidate onSubmit={(event) => { event.preventDefault(); void form.submit() }} className="mt-3 flex flex-1 flex-col gap-3">
        <div aria-hidden="true" hidden>
          <label htmlFor="public-website">Sitio web</label>
          <input id="public-website" name="qms-contact-check" type="text" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore value={form.honeypot} onChange={(event) => form.setHoneypot(event.target.value)} />
        </div>
        <div className={`grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 ${isEmbed ? '' : 'sm:flex-1 sm:grid-rows-[auto_auto_minmax(min-content,1fr)]'}`}>
          <PublicField field="nombre" label="Nombre *" error={fieldError('nombre')}>
            <Input id="public-nombre" name="nombre" autoComplete="name" required maxLength={PUBLIC_QUEJA_LIMITES.nombre} disabled={disabled} value={form.draft.nombre} onChange={(event) => form.updateField('nombre', event.target.value)} className="min-h-11 w-full text-base" {...fieldAttributes('nombre')} />
          </PublicField>
          <PublicField field="email" label="Correo electrónico *" error={fieldError('email')}>
            <Input id="public-email" name="email" autoComplete="email" type="email" required maxLength={PUBLIC_QUEJA_LIMITES.email} disabled={disabled} value={form.draft.email} onChange={(event) => form.updateField('email', event.target.value)} className="min-h-11 w-full text-base" {...fieldAttributes('email')} />
          </PublicField>
          <PublicField field="telefono" label="Teléfono (opcional)" error={fieldError('telefono')}>
            <Input id="public-telefono" name="telefono" autoComplete="tel" type="tel" inputMode="tel" maxLength={PUBLIC_QUEJA_LIMITES.telefono} disabled={disabled} value={form.draft.telefono} onChange={(event) => form.updateField('telefono', event.target.value)} className="min-h-11 w-full text-base" {...fieldAttributes('telefono')} />
          </PublicField>
          <PublicField field="categoria" label="Tipo *" error={fieldError('categoria')}>
            <Select id="public-categoria" name="categoria" required disabled={disabled} value={form.draft.categoria} onChange={(event) => form.updateField('categoria', event.target.value)} className="min-h-11 text-base" {...fieldAttributes('categoria')}>
              <option value="">Seleccionar tipo</option>
              {CATEGORIAS_PUBLICAS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </Select>
          </PublicField>
          <PublicField field="descripcion" label="Descripción *" error={fieldError('descripcion')} className="flex flex-col sm:col-span-2">
            <Textarea id="public-descripcion" name="descripcion" required rows={4} maxLength={PUBLIC_QUEJA_LIMITES.descripcion} disabled={disabled} value={form.draft.descripcion} onChange={(event) => form.updateField('descripcion', event.target.value)} className={`w-full resize-y text-base ${isEmbed ? '' : 'sm:flex-1 sm:resize-none'}`} {...fieldAttributes('descripcion')} />
          </PublicField>
          {(consulta.data?.uploadsAllowed || form.archivos.length > 0) && <Field id="public-archivos" label="Evidencias (opcional)" className="sm:col-span-2"
            hint={`PDF, JPEG o PNG. Hasta ${MAX_PUBLIC_FILES} archivos, de 4 MB por archivo.`}>
            <input ref={fileInputRef} id="public-archivos-input" type="file" hidden
              aria-label="Seleccionar evidencias" multiple accept={PUBLIC_FILE_ACCEPT} disabled={disabled}
              onChange={(event) => {
                form.agregarArchivos(event.target.files)
                event.target.value = ''
              }} />
            <div className="flex min-w-0 flex-col gap-x-3 sm:flex-row sm:items-center">
              <Button id="public-archivos" variant="secondary" disabled={disabled} className="min-h-11 shrink-0 self-start px-3 text-base text-qms-primary sm:self-center"
                aria-describedby="public-archivos-hint public-archivos-count" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden="true" /> Adjuntar archivos
              </Button>
              <span id="public-archivos-count" className="sr-only" aria-live="polite">
                {form.archivos.length > 0 ? `${form.archivos.length} de ${MAX_PUBLIC_FILES} archivos` : 'Sin archivos adjuntos'}
              </span>
              <div className="flex h-12 min-w-0 shrink-0 items-center overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] sm:flex-1"
                role="region" aria-label="Evidencias seleccionadas" tabIndex={form.archivos.length ? 0 : undefined}>
                {form.archivos.length === 0 ? <span className="text-xs text-qms-muted" aria-hidden="true">Sin archivos adjuntos</span> : <ul className="flex gap-2">
                  {form.archivos.map((entry) => {
                    const status = fileStatus[entry.status]
                    const selected = !form.receipt || entry.status === 'subido'
                    const failedFile = entry.status === 'fallido'
                    const Icon = failedFile ? CircleAlert : selected ? CircleCheck : Upload
                    return <li key={entry.uploadId} className="flex h-9 w-56 shrink-0 items-center gap-2 rounded-button border border-qms-border bg-qms-card pl-2.5 pr-1">
                      <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${failedFile ? 'text-qms-danger' : selected ? 'text-qms-success' : 'text-qms-muted'}`} />
                      <div className="min-w-0 flex-1 text-xs leading-tight">
                        <span className="block select-text truncate text-qms-dark" title={entry.file.name}>{entry.file.name}</span>
                        <span className="block truncate text-qms-muted" title={entry.error || status}>{status} · {formatBytes(entry.file.size)}</span>
                      </div>
                      {!form.receipt && <Button size="icon" variant="ghost" disabled={disabled} className="h-8 w-8 shrink-0" aria-label={`Quitar ${entry.file.name}`} title="Quitar archivo" onClick={() => form.quitarArchivo(entry.uploadId)}><X className="h-4 w-4" aria-hidden="true" /></Button>}
                    </li>
                  })}
                </ul>}
              </div>
            </div>
          </Field>}
        </div>
        <div className="space-y-3 border-t border-qms-border pt-3">
          {(form.confirmationPending || footerError || form.receipt) && <div className="space-y-2" aria-live="polite" aria-atomic="true">
            {form.receipt && <p className="text-sm text-qms-dark">Queja registrada. Tu folio es <strong className="font-mono text-qms-primary">{form.receipt.folio}</strong>. Guardalo para dar seguimiento.</p>}
            <p role={footerError ? 'alert' : 'status'} className={footerError ? 'text-sm text-qms-danger' : completed ? 'text-sm text-qms-success' : 'text-sm text-qms-muted'}>
              {footerError || (form.enviando ? form.etapa : completed ? 'Envío completado.' : form.receipt ? (failed ? 'La queja conserva su folio. Podés reintentar únicamente las evidencias pendientes.' : 'La queja está registrada; falta confirmar la finalización.') : 'Tus datos se conservaron. Reintentá el mismo envío sin crear otra queja.')}
            </p>
            {form.receipt && form.archivos.length > 0 && <p className="text-xs text-qms-muted">{uploaded} de {form.archivos.length} evidencias adjuntadas.</p>}
          </div>}
          {form.receipt ? <Button type="button" className="min-h-11 w-full text-base" loading={form.enviando} loadingLabel={form.etapa || 'Enviando…'} disabled={completed} onClick={() => void form.retryPending()}>
            {form.enviando ? form.etapa : completed ? 'Envío completado' : failed ? 'Reintentar evidencias pendientes' : 'Reintentar finalización'}
          </Button> : <Button type="submit" className="min-h-11 w-full text-base" loading={form.enviando} loadingLabel={form.etapa || 'Enviando…'}>{form.enviando ? form.etapa : form.confirmationPending ? 'Reintentar el mismo envío' : 'Enviar queja'}</Button>}
        </div>
      </form>
  </section>
}

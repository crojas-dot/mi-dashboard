'use client'

import { useRef, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import type { FormularioPublico } from '@/lib/queries/useFormulariosPublicos'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { obtenerEnlaceSeguimientoPrivado } from '@/lib/services/publicTrackingAdminClient'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'

interface Props {
  formulario: FormularioPublico
  enabled: boolean
  checking: boolean
  unavailable: boolean
  onRetry: () => void
  onClose: () => void
}

export default function SeguimientoFormularioModal({ formulario, enabled, checking, unavailable, onRetry, onClose }: Props) {
  const scope = useEntityRequestGuard(formulario.id)
  const controller = useRef<AbortController | null>(null)
  const [folio, setFolio] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reference = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/seguimiento`
  const close = () => { controller.current?.abort(); scope.invalidate(); onClose() }
  const obtener = async () => {
    if (!enabled || !folio.trim()) return
    const operation = scope.start('tracking-link')
    if (!operation) return
    const currentContext = scope.captureContext()
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setUrl('')
    try {
      const result = await obtenerEnlaceSeguimientoPrivado({ formId: formulario.id, folio }, request.signal)
      if (operation.isCurrent() && currentContext()) setUrl(result)
    } catch (failure) {
      if (operation.isCurrent() && currentContext() && !request.signal.aborted) {
        setError(getUserError(failure, 'No se pudo obtener el enlace privado. Intentá de nuevo.').message)
      }
    } finally {
      if (operation.isCurrent()) setBusy(false)
      if (controller.current === request) controller.current = null
      operation.finish()
    }
  }
  const copiar = async () => {
    if (!url) return
    const isCurrent = scope.capture(), currentContext = scope.captureContext()
    try {
      await navigator.clipboard.writeText(url)
      if (isCurrent() && currentContext()) showSuccess('Enlace privado copiado')
    } catch {
      if (isCurrent() && currentContext()) showError(null, 'No se pudo copiar. Seleccioná el enlace para copiarlo manualmente.')
    }
  }
  return <Modal open onClose={close} title="Seguimiento de formulario" size="md">
    <div className="space-y-5">
      <div><p className="text-base font-medium text-qms-dark">{formulario.nombre}</p><p className="mt-1 text-sm leading-relaxed text-qms-muted">Consultá un envío finalizado de este formulario. Cada expediente usa un enlace privado; el consecutivo por sí solo no permite acceder.</p></div>
      <section className="ui-panel space-y-3 p-4">
        <p className="text-sm font-medium">Página de seguimiento</p>
        <p className="break-all text-xs text-qms-muted">{reference}</p>
        <a className="ui-button ui-button-link ui-button-sm" href={reference} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink className="size-4" aria-hidden="true" />Abrir página de referencia</a>
        <p className="text-xs leading-relaxed text-qms-muted">Es una página informativa. Para probar un expediente, obtené su enlace privado con el consecutivo de este formulario.</p>
      </section>
      {checking ? <p role="status" className="text-sm text-qms-muted">Comprobando disponibilidad del seguimiento…</p> : unavailable ? <div role="alert" className="space-y-2"><p className="text-sm text-qms-muted">No se pudo comprobar si el seguimiento está activo.</p><Button size="sm" variant="secondary" onClick={onRetry}>Reintentar disponibilidad</Button></div> : !enabled && <p role="status" className="rounded-card border border-qms-border bg-qms-surface p-3 text-sm text-qms-muted">Pendiente de activación. Podés revisar la página de referencia; los enlaces privados se habilitarán al activar el servicio.</p>}
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void obtener() }}>
        <Field id="seguimiento-consecutivo" label="Consecutivo" hint="Debe pertenecer a un envío finalizado de este formulario."><Input id="seguimiento-consecutivo" required autoComplete="off" maxLength={120} value={folio} disabled={busy || !enabled} placeholder="Ej.: 2026-001" onChange={event => { setFolio(event.target.value); setUrl(''); setError('') }} aria-describedby="seguimiento-consecutivo-hint" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={busy} loadingLabel="Obteniendo enlace privado…" disabled={!enabled || !folio.trim() || checking || unavailable}>Obtener enlace privado</Button></div>
      </form>
      {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
      {enabled && url && <section className="ui-panel space-y-3 p-4"><Field id="seguimiento-enlace-privado" label="Enlace privado del expediente"><Input id="seguimiento-enlace-privado" readOnly value={url} autoComplete="off" className="text-sm" /></Field><p className="text-xs leading-relaxed text-qms-muted">Tratalo como privado. Compartilo únicamente con la persona autorizada para consultar este trámite.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => void copiar()}><Copy className="size-4" aria-hidden="true" />Copiar enlace privado</Button><a className="ui-button ui-button-secondary ui-button-sm" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink className="size-4" aria-hidden="true" />Abrir seguimiento privado</a></div></section>}
    </div>
  </Modal>
}

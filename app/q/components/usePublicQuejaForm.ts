'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useOperationLock } from '@/lib/hooks/useOperationLock'
import {
  crearQuejaPublica, finalizarQuejaPublica, subirAdjuntoPublico, publicErrorMessage, publicSubmissionMessage, publicFinalizationMessage,
  validarArchivoPublico, validarBorradorPublico, fieldFromPublicError, MAX_PUBLIC_FILES, PublicRequestError,
  type PublicQuejaDraft, type PublicQuejaField, type PublicQuejaInput, type PublicQuejaReceipt, type PublicTrackingState,
} from '@/lib/services/publicQuejasClient'

interface ArchivoPublico {
  uploadId: string
  file: File
  status: 'pendiente' | 'subiendo' | 'subido' | 'fallido'
  error?: string
}

const EMPTY_DRAFT: PublicQuejaDraft = { nombre: '', email: '', telefono: '', categoria: '', descripcion: '' }

/** La reclamación se conserva en el navegador por sesión y token: si la confirmación se
 * pierde o la página recarga, reenviar recupera el mismo folio en lugar de crear otra queja. */
interface ReclamacionPublica {
  v: 1
  submissionId: string
  draft: PublicQuejaDraft
  receipt: PublicQuejaReceipt | null
  finalized: boolean
  trackingUrl: string | null
  trackingState: PublicTrackingState
}

const RECLAMACION_PREFIJO = 'qms-public-reclamacion:'

function claveReclamacion(token: string): string {
  return RECLAMACION_PREFIJO + token
}

function leerReclamacion(token: string): ReclamacionPublica | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    const raw = window.sessionStorage.getItem(claveReclamacion(token))
    if (!raw) return null
    const r = JSON.parse(raw)
    if (!r || r.v !== 1 || typeof r.submissionId !== 'string'
      || typeof r.draft?.nombre !== 'string' || typeof r.draft?.email !== 'string'
      || typeof r.draft?.telefono !== 'string' || typeof r.draft?.categoria !== 'string'
      || typeof r.draft?.descripcion !== 'string'
      || !['disabled', 'available', 'pending'].includes(r.trackingState)) return null
    if (r.receipt != null && (typeof r.receipt.folio !== 'string' || typeof r.receipt.quejaId !== 'string'
      || typeof r.receipt.uploadToken !== 'string' || typeof r.receipt.expiresAt !== 'string')) return null
    return r
  } catch { return null }
}

function guardarReclamacion(token: string, r: ReclamacionPublica): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try { window.sessionStorage.setItem(claveReclamacion(token), JSON.stringify(r)) } catch {}
}

function descartarReclamacion(token: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try { window.sessionStorage.removeItem(claveReclamacion(token)) } catch {}
}

/** Conserva el resto de la reclamación al actualizar solo el avance de finalización. */
function actualizarReclamacion(token: string, cambios: Partial<Pick<ReclamacionPublica, 'finalized' | 'trackingUrl' | 'trackingState'>>): void {
  const r = leerReclamacion(token)
  if (r) guardarReclamacion(token, { ...r, ...cambios })
}

function snapshotReclamacion(input: PublicQuejaInput): ReclamacionPublica {
  return {
    v: 1,
    submissionId: input.submissionId,
    draft: { nombre: input.nombre, email: input.email, telefono: input.telefono, categoria: input.categoria, descripcion: input.descripcion },
    receipt: null,
    finalized: false,
    trackingUrl: null,
    trackingState: 'disabled',
  }
}

export function usePublicQuejaForm(token: string) {
  const reclamacion = useRef<ReclamacionPublica | null | undefined>(undefined)
  if (reclamacion.current === undefined) reclamacion.current = leerReclamacion(token)
  const previa = reclamacion.current
  const [draft, setDraft] = useState<PublicQuejaDraft>(previa?.draft ?? EMPTY_DRAFT)
  const [honeypot, setHoneypot] = useState('')
  const [archivos, setArchivos] = useState<ArchivoPublico[]>([])
  const [receipt, setReceipt] = useState<PublicQuejaReceipt | null>(previa?.receipt ?? null)
  const [confirmationPending, setConfirmationPending] = useState(Boolean(previa && !previa.receipt))
  const [finalized, setFinalized] = useState(previa?.finalized ?? false)
  const [trackingUrl, setTrackingUrl] = useState<string | null>(previa?.trackingUrl ?? null)
  const [trackingState, setTrackingState] = useState<PublicTrackingState>(previa?.trackingState ?? 'disabled')
  const trackingStateRef = useRef<PublicTrackingState>(previa?.trackingState ?? 'disabled')
  const [error, setError] = useState('')
  const [invalidField, setInvalidField] = useState<{ field: PublicQuejaField } | null>(null)
  const [etapa, setEtapa] = useState('')
  const receiptRef = useRef(previa?.receipt ?? null)
  const finalizedRef = useRef(previa?.finalized ?? false)
  const mounted = useRef(false)
  const request = useRef<AbortController | null>(null)
  const submission = useRef<PublicQuejaInput | null>(null)
  const uncertainAttempt = useRef(false)
  const files = useRef<ArchivoPublico[]>([])
  const lock = useOperationLock<'submit' | 'retry' | 'tracking'>()

  if (previa && !previa.receipt) {
    // La reclamación anterior puede estar comprometida en DB: reenviar reutiliza su ID
    // y no descarta el submission en rechazos posteriores hasta confirmar el folio.
    submission.current = { ...previa.draft, formToken: token, submissionId: previa.submissionId, honeypot: '' }
    uncertainAttempt.current = true
  }

  // La página remonta este hook por token; abortar también invalida respuestas ya en vuelo.
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [])

  function publishFiles(next: ArchivoPublico[]) {
    files.current = next
    setArchivos(next)
  }

  function reportFailure(failure: unknown, fallback: string) {
    const field = fieldFromPublicError(failure)
    // Un objeto nuevo permite volver a enfocar el mismo campo en otro intento.
    setInvalidField(field ? { field } : null)
    setError(publicSubmissionMessage(failure, fallback))
  }

  function updateField(field: keyof PublicQuejaDraft, value: string) {
    if (lock.isLocked() || submission.current || receipt) return
    setDraft((previous) => ({ ...previous, [field]: value }))
    setInvalidField(null)
    setError('')
  }

  function agregarArchivos(selected: FileList | File[] | null) {
    if (!selected || lock.isLocked() || submission.current || receipt) return
    const next = [...files.current]
    let rejected = 0
    for (const file of Array.from(selected)) {
      try {
        validarArchivoPublico(file)
        if (next.some((entry) => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) continue
        if (next.length >= MAX_PUBLIC_FILES) throw new Error('El máximo es de diez archivos')
        next.push({ file, uploadId: crypto.randomUUID(), status: 'pendiente' })
      } catch { rejected++ }
    }
    publishFiles(next)
    setInvalidField(null)
    setError(rejected ? `No se adjuntaron ${rejected} archivo(s). Usá PDF, JPEG o PNG, sin archivos vacíos, de hasta 4 MB y un máximo de diez archivos.` : '')
  }

  function quitarArchivo(uploadId: string) {
    if (lock.isLocked() || submission.current || receipt) return
    publishFiles(files.current.filter((entry) => entry.uploadId !== uploadId))
  }

  async function processAttachments(created: PublicQuejaReceipt, controller: AbortController) {
    const isCurrent = () => mounted.current && request.current === controller && !controller.signal.aborted
    const pending = files.current.filter((entry) => entry.status !== 'subido')
    for (let index = 0; index < pending.length; index++) {
      if (!isCurrent()) return
      const entry = pending[index]
      publishFiles(files.current.map(item => item.uploadId === entry.uploadId ? { ...item, status: 'subiendo', error: undefined } : item))
      setEtapa(`Subiendo evidencia ${index + 1} de ${pending.length}…`)
      try {
        await subirAdjuntoPublico(entry.file, created.uploadToken, entry.uploadId, controller.signal)
        if (!isCurrent()) return
        publishFiles(files.current.map((item) => item.uploadId === entry.uploadId ? { ...item, status: 'subido', error: undefined } : item))
      } catch (failure) {
        if (!isCurrent()) return
        publishFiles(files.current.map((item) => item.uploadId === entry.uploadId
          ? { ...item, status: 'fallido', error: publicErrorMessage(failure, 'No se pudo confirmar la evidencia. Podés reintentar este archivo.') }
          : item))
      }
    }
    if (!isCurrent() || finalizedRef.current) return
    setEtapa('Finalizando envío…')
    try {
      const result = await finalizarQuejaPublica(created.uploadToken, controller.signal)
      if (isCurrent()) {
        finalizedRef.current = true
        setFinalized(true)
        setTrackingUrl(result?.trackingUrl ?? null)
        trackingStateRef.current = result.trackingState
        setTrackingState(result.trackingState)
        actualizarReclamacion(token, { finalized: true, trackingUrl: result?.trackingUrl ?? null, trackingState: result.trackingState })
      }
    } catch (failure) {
      if (isCurrent()) setError(publicFinalizationMessage(failure, 'La queja está registrada. No se pudo confirmar la finalización; podés reintentar sin crear otra queja.'))
    }
  }

  async function submit() {
    if (!mounted.current || receiptRef.current || lock.isLocked()) return
    let validated: PublicQuejaDraft
    try {
      validated = validarBorradorPublico(draft)
      files.current.forEach(({ file }) => validarArchivoPublico(file))
    } catch (failure) {
      reportFailure(failure, 'Revisá los datos del formulario')
      return
    }
    if (!lock.begin('submit')) return
    const controller = new AbortController()
    request.current = controller
    const isCurrent = () => mounted.current && request.current === controller && !controller.signal.aborted
    if (!submission.current) {
      setError('')
      // Si se pierde la respuesta, repetir este mismo ID y datos recupera el registro sin duplicarlo.
      submission.current = { ...validated, formToken: token, submissionId: crypto.randomUUID(), honeypot }
      // La reclamación se anota ANTES del primer POST: una recarga posterior reutiliza su folio.
      guardarReclamacion(token, snapshotReclamacion(submission.current))
    }
    setInvalidField(null)
    setEtapa('Registrando queja…')
    const attempted = submission.current
    setDraft(validated)
    setConfirmationPending(true)
    try {
      const created = await crearQuejaPublica(attempted, controller.signal)
      if (!isCurrent()) return
      receiptRef.current = created
      setReceipt(created)
      guardarReclamacion(token, { ...snapshotReclamacion(attempted), receipt: created })
      setConfirmationPending(false)
      await processAttachments(created, controller)
    } catch (failure) {
      if (!isCurrent()) return
      // El antispam no forma parte del hash persistido. Limpiar solo ese dato conserva
      // ID y contenido incluso si un intento anterior tuvo una respuesta perdida.
      if (failure instanceof PublicRequestError && failure.status === 403
        && ['honeypot_rejected', 'verification_failed'].includes(failure.code ?? '')
        && submission.current?.honeypot) {
        submission.current = { ...submission.current, honeypot: '' }
        setHoneypot('')
      }
      // Solo un código de campo propio confirma rechazo previo al alta. Un 400/422
      // genérico podría ocurrir después del commit y jamás debe estrenar otro ID.
      const validationRejected = fieldFromPublicError(failure) !== null
      const verificationRejected = failure instanceof PublicRequestError && failure.status === 403
        && ['honeypot_rejected', 'verification_failed'].includes(failure.code ?? '')
      if (!validationRejected && !verificationRejected) uncertainAttempt.current = true
      if (validationRejected && !uncertainAttempt.current) {
        submission.current = null
        descartarReclamacion(token)
        setConfirmationPending(false)
      }
      reportFailure(failure, 'No se pudo confirmar el registro. Reintentá el mismo envío.')
    } finally {
      if (isCurrent()) {
        request.current = null
        setEtapa('')
        lock.finish()
      }
    }
  }

  async function retryPending() {
    if (!mounted.current || !receiptRef.current || !lock.begin('retry')) return
    const created = receiptRef.current
    const controller = new AbortController()
    request.current = controller
    const isCurrent = () => mounted.current && request.current === controller && !controller.signal.aborted
    setError('')
    try {
      if (Date.parse(created.expiresAt) <= Date.now()) throw new PublicRequestError(410)
      await processAttachments(created, controller)
    } catch (failure) {
      if (isCurrent()) setError(publicFinalizationMessage(failure, 'No se pudo completar el envío. Conservá tu folio para dar seguimiento.'))
    } finally {
      if (isCurrent()) {
        request.current = null
        setEtapa('')
        lock.finish()
      }
    }
  }

  async function retryTracking() {
    const created = receiptRef.current
    if (!mounted.current || !created || !finalizedRef.current || trackingStateRef.current !== 'pending' || !lock.begin('tracking')) return
    const controller = new AbortController()
    request.current = controller
    const isCurrent = () => mounted.current && request.current === controller && !controller.signal.aborted
    setError('')
    try {
      if (Date.parse(created.expiresAt) <= Date.now()) {
        if (isCurrent()) setError('Conservá tu folio y contactá a Gestión de Calidad para recuperar el enlace de seguimiento.')
        return
      }
      // Repetir la finalización es idempotente: no vuelve a crear ni a subir evidencias.
      const result = await finalizarQuejaPublica(created.uploadToken, controller.signal)
      if (!isCurrent()) return
      trackingStateRef.current = result.trackingState
      setTrackingState(result.trackingState)
      setTrackingUrl(result.trackingUrl)
      actualizarReclamacion(token, { trackingUrl: result.trackingUrl, trackingState: result.trackingState })
    } catch (failure) {
      if (isCurrent()) setError(publicFinalizationMessage(failure, 'Tu queja está registrada. No se pudo recuperar el enlace de seguimiento.'))
    } finally {
      if (isCurrent()) { request.current = null; lock.finish() }
    }
  }

  return {
    draft, updateField, honeypot, setHoneypot, archivos, agregarArchivos, quitarArchivo,
    receipt, finalized, trackingUrl, trackingState, confirmationPending, error, invalidField, etapa,
    enviando: lock.operation === 'submit' || lock.operation === 'retry',
    retryingTracking: lock.operation === 'tracking',
    submit, retryPending, retryTracking,
  }
}

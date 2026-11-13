'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, FileText, Paperclip, Reply, Send, Trash2, Upload, X, Pencil } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import QuejaCorreoEditor from '@/app/quejas/components/QuejaCorreoEditor'
import QuejaInformeModal from '@/app/quejas/components/QuejaInformeModal'
import AdjuntoPreviewModal from '@/components/quejas/AdjuntoPreviewModal'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'
import { useRespuestaCliente, respuestaClienteKey, type RespuestaClienteContext } from '@/lib/queries/useQuejaRespuestaCliente'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaInforme } from '@/lib/queries/useQuejaInforme'
import { informeFilename, type QuejaInforme } from '@/lib/utils/quejaInforme'
import { crearCorreoAcompanamiento, validarCorreoQueja, type CorreoQueja } from '@/lib/utils/quejaCorreo'
import { esOficioPublicableQueja, guardarRespuestaClienteBorrador, publicarRespuestaAprobada, transicionarQueja, type RespuestaClienteDraftInput } from '@/lib/services/quejaWorkflowService'
import { errorMsg, showSuccess } from '@/lib/services/errorToast'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

interface Props {
  queja: Queja
  adjuntos: QuejaAdjunto[]
  archivosLoading: boolean
  archivosError: boolean
  onReintentar: () => void
  onSubir: (file: File) => Promise<QuejaAdjunto | undefined>
  subiendo: boolean
  autor: string
  noProcede?: boolean
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  onClose: (completed?: boolean) => void
}

export default function QuejaRespuestaClienteModal(props: Props) {
  const query = useRespuestaCliente(props.queja.id)
  const informe = useQuejaInforme(props.queja.id)
  const [initial, setInitial] = useState<(RespuestaClienteContext & { informe: QuejaInforme | null }) | null>(null)
  if (!initial && !query.isFetching && !query.error && query.data && !informe.isFetching && !informe.error && informe.data !== undefined) setInitial({ ...query.data, informe: informe.data })
  if (initial) return <RespuestaEditor {...props} initial={initial} />
  return <Modal open onClose={props.onClose} title="Respuesta al cliente" titleSuffix={props.queja.folio} headerLeading={<Reply aria-hidden="true" className="size-4 text-qms-muted" />} size="mail" variant="document" emphasizeTitle>
    {query.isLoading || query.isFetching || informe.isLoading || informe.isFetching ? <LoadingSkeleton variant="list" label="Consultando respuesta e informe guardado…" /> : <div className="p-5"><p role="alert" className="mb-3 text-sm text-qms-danger">No se pudo cargar el informe o la respuesta guardada.</p><Button variant="secondary" onClick={() => { void query.refetch(); void informe.refetch() }}>Reintentar</Button></div>}
  </Modal>
}

/** Solo un PDF institucional válido puede ser seleccionado para la comunicación final. */
function esPdfOficial(file: QuejaAdjunto, quejaId: string): boolean {
  return esOficioPublicableQueja(file, quejaId) && file.tipo_mime.toLowerCase() === 'application/pdf' && /\.pdf$/i.test(file.nombre)
}

function ultimoPdfGenerado(files: readonly QuejaAdjunto[], folio: string, report: QuejaInforme | null, quejaId: string): QuejaAdjunto | null {
  if (!report) return null
  const name = informeFilename(folio).replace(/\.docx$/, `-v${report.version}.pdf`)
  return files.filter(file => esPdfOficial(file, quejaId) && file.nombre === name)
    .sort((a,b) => b.created_at.localeCompare(a.created_at))[0] ?? null
}

function RespuestaEditor({ queja, initial, ...props }: Props & { initial: RespuestaClienteContext & { informe: QuejaInforme | null } }) {
  const [snapshot] = useState(queja)
  const noProcede = props.noProcede === true
  const originalDraft = initial.borrador
  const compatibleDraft = noProcede || originalDraft?.motivo_no_procede == null ? originalDraft : null
  const [form, setForm] = useState<RespuestaClienteDraftInput & { correo: CorreoQueja }>(() => {
    const plantilla = crearCorreoAcompanamiento(queja, noProcede)
    const respuesta = compatibleDraft?.respuesta?.trim() ? compatibleDraft.respuesta : (noProcede ? 'La solicitud se declara no procedente. Los fundamentos se detallan en el informe adjunto al correo de respuesta.' : 'La resolución de su solicitud se detalla en el informe oficial enviado como archivo adjunto al correo de respuesta.')
    const motivoGuardado = compatibleDraft?.motivo_no_procede?.trim() ? compatibleDraft.motivo_no_procede : null
    // Los fundamentos se redactan en el oficio; el registro conserva el motivo
    // previo o la comunicación que remite al adjunto, sin pedir un segundo texto.
    const savedPdf = props.adjuntos.find(file => file.id === compatibleDraft?.adjunto_id && esPdfOficial(file, queja.id))
    const defaultPdf = ultimoPdfGenerado(props.adjuntos, queja.folio, initial.informe, queja.id)
    return { respuesta,
      numeroOficio: compatibleDraft?.numero_oficio ?? (queja.numero_oficio_resolucion || queja.folio), adjuntoId: savedPdf?.id ?? defaultPdf?.id ?? null,
      ...(noProcede ? { noProcede: { justificacion: motivoGuardado ?? respuesta, formato: motivoGuardado ? compatibleDraft?.motivo_no_procede_formato ?? 'plain' : 'plain' } } : {}),
      correo: { asunto: compatibleDraft?.correo_asunto ?? plantilla.asunto, cuerpo: compatibleDraft?.correo_cuerpo ?? plantilla.cuerpo } }
  })
  const [saved, setSaved] = useState(initial.borrador)
  const [report, setReport] = useState(initial.informe)
  const [editingReport, setEditingReport] = useState(false)
  const [baseline, setBaseline] = useState(form)
  const [previewFile, setPreviewFile] = useState<QuejaAdjunto | null>(null)
  const [uploaded, setUploaded] = useState<QuejaAdjunto[]>([])
  const [busy, setBusy] = useState<'save' | 'publish' | 'finish' | 'upload' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const scope = useEntityRequestGuard(snapshot.id)
  const queryClient = useQueryClient()
  const draftGeneration = useRef(0)
  const autoSelected = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reportIsCurrent = useRef<() => boolean>(() => false)
  const files = [...props.adjuntos, ...uploaded.filter(file => !props.adjuntos.some(existing => existing.id === file.id))]
    .filter(file => esPdfOficial(file, snapshot.id))
  const selectedFile = files.find(file => file.id === form.adjuntoId) ?? null
  // La lista puede llegar después de abrir el correo; seleccionar solo una vez y
  // nunca sustituir la selección manual del usuario al refrescar adjuntos.
  useEffect(() => {
    if (autoSelected.current || props.archivosLoading || props.archivosError || initial.publicada) return
    autoSelected.current = true
    if (form.adjuntoId || !report || uploaded.length) return
    const generated = ultimoPdfGenerado(props.adjuntos, snapshot.folio, report, snapshot.id)
    if (generated) setForm(current => current.adjuntoId ? current : { ...current, adjuntoId: generated.id })
  }, [props.archivosLoading, props.archivosError, props.adjuntos, form.adjuntoId, uploaded.length, report, snapshot.folio, snapshot.id, initial.publicada])
  const dirty = !initial.publicada && (form.respuesta !== baseline.respuesta
    || form.numeroOficio !== baseline.numeroOficio || form.adjuntoId !== baseline.adjuntoId
    || form.correo.asunto !== baseline.correo.asunto || form.correo.cuerpo !== baseline.correo.cuerpo
    || form.noProcede?.justificacion !== baseline.noProcede?.justificacion
    || form.noProcede?.formato !== baseline.noProcede?.formato)
  const disabled = !!busy || props.subiendo || editingReport
  const change = (patch: Partial<RespuestaClienteDraftInput>) => { draftGeneration.current++; setForm(current => ({ ...current, ...patch })); setError(''); setNotice('') }

  async function write(kind: 'save' | 'publish' | 'finish') {
    const operation = scope.start('response-write')
    if (!operation) return
    const isContextCurrent = scope.captureContext(), generation = draftGeneration.current
    setBusy(kind); setError(''); setNotice('')
    let committed = false
    try {
      if (kind !== 'finish') validarCorreoQueja(form.correo, kind === 'publish')
      if (form.noProcede && (form.noProcede.justificacion.length > 10000 || kind === 'publish' && !form.noProcede.justificacion.trim())) throw new Error('Revisá la justificación de no procedencia.')
      const nextForm = form
      const officialFile = selectedFile
      if (kind === 'publish' && !officialFile) throw new Error('Seleccioná o subí el PDF oficial antes de publicar.')
      if (kind === 'save') {
        const result = await guardarRespuestaClienteBorrador(snapshot, saved?.version ?? 0, nextForm)
        committed = true
        if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: respuestaClienteKey(snapshot.id) })
        if (operation.isCurrent() && generation === draftGeneration.current) {
          const savedForm = { respuesta: result.respuesta, numeroOficio: result.numero_oficio, adjuntoId: result.adjunto_id,
            ...(noProcede ? { noProcede: { justificacion: result.motivo_no_procede ?? nextForm.noProcede!.justificacion, formato: result.motivo_no_procede_formato ?? nextForm.noProcede!.formato } } : {}),
            correo: { asunto: result.correo_asunto ?? nextForm.correo.asunto, cuerpo: result.correo_cuerpo ?? nextForm.correo.cuerpo } }
          setSaved(result); setForm(savedForm); setBaseline(savedForm); setNotice('Borrador guardado. Podés continuar después desde el expediente.')
        }
      } else {
        const updated = kind === 'finish' ? await transicionarQueja(snapshot, 'Finalizado')
          : await publicarRespuestaAprobada(snapshot, saved?.version ?? 0, nextForm, officialFile)
        committed = true
        if (kind === 'publish' && operation.isCurrent()) showSuccess(noProcede ? 'No procedencia registrada. Correo en cola de envío.' : 'Expediente finalizado. Correo en cola de envío.')
        if (isContextCurrent()) props.onUpdated(updated, operation.isCurrent)
        if (operation.isCurrent()) props.onClose(true)
      }
    } catch (caught) {
      if (operation.isCurrent()) { setConfirmPublish(false); if (committed) setNotice('La operación pudo quedar registrada. Comprobá el estado antes de repetirla.'); setError(errorMsg(caught, 'No se pudo completar la operación. El borrador se conserva.')) }
    } finally { if (operation.isCurrent()) setBusy(null); operation.finish() }
  }

  async function upload(file: File) {
    if (file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name)) {
      setError('Para comunicar al cliente se requiere un archivo PDF (.pdf).')
      return
    }
    const operation = scope.start('response-upload')
    if (!operation) return
    setBusy('upload'); setError(''); setNotice('')
    try {
      const result = await props.onSubir(file)
      if (operation.isCurrent() && result) {
        if (!esPdfOficial(result, snapshot.id)) throw new Error('El archivo subido no es un PDF oficial válido.')
        setUploaded(current => [...current, result])
        change({ adjuntoId: result.id })
        setNotice('PDF adjuntado. Podés visualizarlo antes de publicarlo.')
      } else if (operation.isCurrent()) throw new Error('No se pudo guardar el PDF en el expediente.')
    } catch (caught) {
      if (operation.isCurrent()) setError(errorMsg(caught, 'No se pudo adjuntar el PDF. La respuesta se conserva.'))
    } finally { if (operation.isCurrent()) setBusy(null); operation.finish() }
  }

  function requestPublish() {
    if (disabled) return
    try { validarCorreoQueja(form.correo, true) } catch (caught) { setError(errorMsg(caught, 'Revisá el asunto y el mensaje del correo.')); return }
    if (!form.numeroOficio.trim() || !selectedFile) {
      setError('Completá el número de oficio y seleccioná o subí el PDF oficial.'); return
    }
    if (noProcede) { void write('publish'); return }
    setConfirmPublish(true)
  }
  const close = () => { if (disabled) return; if (dirty) setConfirmClose(true); else props.onClose() }
  return <>
    <Modal open onClose={close} title="Respuesta al cliente" titleSuffix={snapshot.folio}
      headerLeading={<Reply aria-hidden="true" className="size-4 shrink-0 text-qms-muted" />}
      size="mail" variant="document" emphasizeTitle dismissOnBackdrop={false}
      footer={<div className="flex flex-wrap items-center justify-between gap-3">
        {initial.publicada
          ? <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={disabled}>Cerrar</Button>
              <Button disabled={disabled} loading={busy === 'finish'} onClick={() => { void write('finish') }}>Finalizar expediente</Button>
            </div>
          : <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button data-response-publish size="sm" disabled={disabled || props.archivosLoading || props.archivosError} loading={busy === 'publish'} onClick={requestPublish}>
                <Send aria-hidden="true" className="size-4" />Publicar respuesta
              </Button>
              <Button variant="ghost" size="icon" aria-label="Subir PDF" title="Subir PDF" disabled={disabled}
                onClick={() => fileInputRef.current?.click()}>
                <Paperclip aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
              <Button size="sm" variant="ghost" disabled={disabled} onClick={close}><Trash2 aria-hidden="true" className="size-4" />Descartar</Button>
              <Button size="sm" variant="secondary" disabled={disabled || !!saved && !dirty} loading={busy === 'save'} onClick={() => { void write('save') }}>Guardar borrador</Button>
            </div>
          </>}
      </div>}>
      {notice && <p role="status" className="shrink-0 border-b border-qms-border bg-qms-surface px-5 py-2.5 text-sm text-qms-success sm:px-8">{notice}</p>}
      {initial.publicada ? <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-qms-surface p-6 sm:p-8">
        <p className="text-sm text-qms-muted">La respuesta ya fue publicada el {caseDate(initial.publicada.publicado_at)}. Se conserva en modo de lectura.</p>
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        <h3 className="text-base font-medium">{initial.borrador?.correo_cuerpo ? 'Correo de acompañamiento' : 'Respuesta publicada'}</h3>
        {initial.borrador?.correo_asunto && <p className="text-sm"><span className="font-medium">Asunto: </span>{initial.borrador.correo_asunto}</p>}
        <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{initial.borrador?.correo_cuerpo ?? initial.publicada.respuesta}</p>
        <p className="break-words text-sm">Oficio: {snapshot.numero_oficio_resolucion || 'Registrado en el expediente'} · {props.adjuntos.find(file => file.id === initial.publicada?.adjunto_id)?.nombre || 'Documento oficial publicado'}</p>
      </div> : <div data-response-compose className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-qms-surface">
        {error && <div role="alert" className="shrink-0 border-b border-qms-border bg-soft-red-bg px-5 py-3 text-sm text-qms-danger sm:px-8">{error}</div>}
        <QuejaCorreoEditor id={'respuesta-correo-' + snapshot.id}
          destinatario={snapshot.email_cliente ?? ''} oficio={form.numeroOficio}
          onOficioChange={value => change({ numeroOficio: value })}
          correo={form.correo} onChange={correo => change({ correo })} disabled={disabled} />
        <section data-response-attachments aria-label="Adjuntos del correo" className="mt-3 shrink-0 border-t border-qms-border bg-qms-hover-bg/30 px-5 py-6 sm:mt-5 sm:px-8 sm:py-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-qms-muted uppercase"><Paperclip aria-hidden="true" className="size-4" />Adjuntos seleccionados</h3>
            <span className="text-xs text-qms-muted">Documento final en PDF</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <label htmlFor={'respuesta-documento-' + snapshot.id} className="sr-only">Seleccionar PDF oficial del expediente</label>
            <Select id={'respuesta-documento-' + snapshot.id} value={selectedFile?.id ?? ''}
              disabled={disabled || props.archivosLoading || props.archivosError} wrapperClassName="min-w-0 flex-1 basis-56"
              onChange={event => change({ adjuntoId: event.target.value || null })}>
              <option value="">Seleccionar PDF oficial</option>
              {[...files].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(file =>
                <option key={file.id} value={file.id}>{file.nombre}</option>)}
            </Select>
            <Button size="sm" variant="secondary" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" className="size-4" />Subir archivo
            </Button>
            <Button size="sm" variant="secondary" disabled={!selectedFile || disabled} onClick={() => setPreviewFile(selectedFile)}>
              <Eye aria-hidden="true" className="size-4" />Visualizar
            </Button>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" aria-label="Subir PDF oficial del cliente" className="sr-only"
              disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
          </div>
          {selectedFile && <div data-response-selected-file className="mt-4 inline-flex max-w-full items-center gap-2 rounded-button border border-qms-border bg-qms-surface px-3 py-2 shadow-sm">
            <FileText aria-hidden="true" className="size-4 shrink-0 text-qms-danger" />
            <button type="button" title={'Previsualizar ' + selectedFile.nombre} onClick={() => setPreviewFile(selectedFile)}
              className="min-w-0 max-w-[220px] cursor-pointer truncate text-left text-sm font-medium text-qms-dark hover:text-qms-primary sm:max-w-[480px]">{selectedFile.nombre}</button>
            <button type="button" aria-label="Quitar PDF seleccionado" title="Quitar archivo seleccionado" disabled={disabled}
              className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-button text-qms-muted hover:bg-qms-hover-bg hover:text-qms-danger disabled:opacity-50"
              onClick={() => change({ adjuntoId: null })}><X aria-hidden="true" className="size-4" /></button>
          </div>}
          {noProcede && <div className="mt-4 border-t border-qms-border/60 pt-3">
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => {
              const visit = scope.capture(), context = scope.captureContext()
              reportIsCurrent.current = () => visit() && context()
              setEditingReport(true)
            }}><Pencil aria-hidden="true" className="size-4" />Preparar documento de no procedencia</Button>
          </div>}
          {props.archivosError && <p role="alert" className="mt-3 text-xs text-qms-danger">No se pudieron cargar los archivos. <Button size="sm" variant="link" onClick={props.onReintentar}>Reintentar</Button></p>}
        </section>
      </div>}
    </Modal>
    {editingReport && <QuejaInformeModal queja={{ ...snapshot, numero_oficio_resolucion: form.numeroOficio, ...(form.noProcede ? { resolucion: form.noProcede.justificacion, resolucion_formato: form.noProcede.formato } : {}) }} anexos={props.adjuntos} autor={props.autor} onClose={() => setEditingReport(false)} onSaved={result => { if (reportIsCurrent.current() && result.queja_id === snapshot.id) { setReport(result); setNotice('Informe guardado. Pulsá «Generar expediente» para preparar el archivo oficial cuando lo necesités.'); } }} />}
    {previewReport && report && <Modal open onClose={() => setPreviewReport(false)} title={'Vista previa del informe · ' + snapshot.folio} size="xl" variant="document"><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg p-4"><div className="mx-auto max-w-4xl bg-qms-surface p-5 sm:p-10"><RichTextContent value={report.contenido} format="markdown" /></div></div></Modal>}
    <AdjuntoPreviewModal adjunto={previewFile} onClose={() => setPreviewFile(null)} />
    <ConfirmDialog open={confirmPublish} title="Publicar respuesta al cliente" message={<>El cliente recibirá el correo que redactaste con <strong className="break-words">{usingInforme ? 'el Word del informe guardado' : selectedFile?.nombre}</strong>. Revisá que el mensaje y el documento estén listos para entregarlos. El expediente quedará Finalizado.</>}
      confirmLabel="Publicar respuesta" loading={busy === 'publish'} onCancel={() => setConfirmPublish(false)} onConfirm={() => { void write('publish') }} />
    <ConfirmDialog open={confirmClose} title="Borrador sin guardar" message="Hay cambios pendientes. Volvé al formulario para guardarlos o cerrá descartando estas ediciones." confirmLabel="Descartar cambios" danger onCancel={() => setConfirmClose(false)} onConfirm={props.onClose} />
  </>
}

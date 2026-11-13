'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, FileText, Paperclip, Plus, Reply, Send, Trash2, Upload, X, Pencil } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import RichTextContent from '@/components/ui/RichTextContent'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
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
  return <Modal open onClose={props.onClose} title={'Respuesta al cliente · ' + props.queja.folio} size="xl" variant="document">
    {query.isLoading || query.isFetching || informe.isLoading || informe.isFetching ? <LoadingSkeleton variant="list" label="Cargando informe y respuesta…" /> : <div className="p-5"><p role="alert" className="mb-3 text-sm text-qms-danger">No se pudo cargar el informe o la respuesta guardada.</p><Button variant="secondary" onClick={() => { void query.refetch(); void informe.refetch() }}>Reintentar</Button></div>}
  </Modal>
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
    return { respuesta,
      numeroOficio: compatibleDraft?.numero_oficio ?? (queja.numero_oficio_resolucion || queja.folio), adjuntoId: compatibleDraft?.adjunto_id ?? null,
      ...(noProcede ? { noProcede: { justificacion: motivoGuardado ?? respuesta, formato: motivoGuardado ? compatibleDraft?.motivo_no_procede_formato ?? 'plain' : 'plain' } } : {}),
      correo: { asunto: compatibleDraft?.correo_asunto ?? plantilla.asunto, cuerpo: compatibleDraft?.correo_cuerpo ?? plantilla.cuerpo } }
  })
  const [saved, setSaved] = useState(initial.borrador)
  const [report, setReport] = useState(initial.informe)
  const [usingInforme, setUsingInforme] = useState(!compatibleDraft?.adjunto_id && !!initial.informe)
  const [editingReport, setEditingReport] = useState(false)
  const [showDocumentPicker, setShowDocumentPicker] = useState(false)
  const [baseline, setBaseline] = useState(() => ({ form, usingInforme, reportVersion: report?.version }))
  const [previewReport, setPreviewReport] = useState(false)
  const [previewFile, setPreviewFile] = useState<QuejaAdjunto | null>(null)
  const [uploaded, setUploaded] = useState<QuejaAdjunto[]>([])
  const [busy, setBusy] = useState<'save' | 'publish' | 'finish' | 'upload' | 'generate' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const scope = useEntityRequestGuard(snapshot.id)
  const queryClient = useQueryClient()
  const draftGeneration = useRef(0)
  const reportIsCurrent = useRef<() => boolean>(() => false)
  const files = [...props.adjuntos, ...uploaded.filter(file => !props.adjuntos.some(existing => existing.id === file.id))]
    .filter(file => esOficioPublicableQueja(file, snapshot.id))
  const selectedFile = files.find(file => file.id === form.adjuntoId) ?? null
  const dirty = !initial.publicada && (usingInforme !== baseline.usingInforme || form.respuesta !== baseline.form.respuesta
    || form.numeroOficio !== baseline.form.numeroOficio || form.adjuntoId !== baseline.form.adjuntoId
    || form.correo.asunto !== baseline.form.correo.asunto || form.correo.cuerpo !== baseline.form.correo.cuerpo)
    || !initial.publicada && (form.noProcede?.justificacion !== baseline.form.noProcede?.justificacion || form.noProcede?.formato !== baseline.form.noProcede?.formato)
    || !initial.publicada && usingInforme && report?.version !== baseline.reportVersion
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
      const officialFile = usingInforme ? null : selectedFile
      if (kind === 'publish' && !officialFile) throw new Error('Primero generá el expediente o seleccioná un documento oficial antes de publicar.')
      if (kind === 'save') {
        const result = await guardarRespuestaClienteBorrador(snapshot, saved?.version ?? 0, nextForm)
        committed = true
        if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: respuestaClienteKey(snapshot.id) })
        if (operation.isCurrent() && generation === draftGeneration.current) {
          const savedForm = { respuesta: result.respuesta, numeroOficio: result.numero_oficio, adjuntoId: result.adjunto_id,
            ...(noProcede ? { noProcede: { justificacion: result.motivo_no_procede ?? nextForm.noProcede!.justificacion, formato: result.motivo_no_procede_formato ?? nextForm.noProcede!.formato } } : {}),
            correo: { asunto: result.correo_asunto ?? nextForm.correo.asunto, cuerpo: result.correo_cuerpo ?? nextForm.correo.cuerpo } }
          setSaved(result); setForm(savedForm); setBaseline({ form: savedForm, usingInforme, reportVersion: report?.version }); setNotice('Borrador guardado. Podés continuar después desde el expediente.')
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
      if (operation.isCurrent()) { setConfirmPublish(false); if (committed) setNotice('El archivo quedó adjunto. Comprobá el borrador y la publicación antes de repetir la operación.'); setError(errorMsg(caught, 'No se pudo completar la operación. El borrador se conserva.')) }
    } finally { if (operation.isCurrent()) setBusy(null); operation.finish() }
  }

  async function upload(file: File) {
    const operation = scope.start('response-upload')
    if (!operation) return
    setBusy('upload')
    try {
      const result = await props.onSubir(file)
      if (operation.isCurrent() && result) { setUploaded(current => [...current, result]); setUsingInforme(false); change({ adjuntoId: result.id }) }
    } catch (caught) {
      if (operation.isCurrent()) setError(errorMsg(caught, 'No se pudo adjuntar el oficio. La respuesta se conserva.'))
    } finally { if (operation.isCurrent()) setBusy(null); operation.finish() }
  }


  // La conversión a Word y su subida solo ocurren al pulsar Generar expediente.
  // Guardar borrador y Publicar respuesta nunca generan ni suben un informe.
  async function generarExpediente() {
    if (disabled) return
    if (!report?.contenido.trim()) {
      const visit = scope.capture(), context = scope.captureContext()
      reportIsCurrent.current = () => visit() && context()
      setEditingReport(true)
      return
    }
    const operation = scope.start('response-generate')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setBusy('generate'); setError(''); setNotice('')
    try {
      const { crearInformeWord } = await import('@/lib/utils/quejaInformeWord')
      const blob = await crearInformeWord(report.contenido)
      if (!operation.isCurrent() || !isContextCurrent()) return
      const name = informeFilename(snapshot.folio).replace(/\.docx$/, `-v${report.version}.docx`)
      const file = await props.onSubir(new File([blob], name, { type: blob.type }))
      if (!operation.isCurrent() || !isContextCurrent()) return
      if (!file) throw new Error('No se pudo confirmar el archivo generado.')
      setUploaded(current => [...current, file])
      draftGeneration.current++
      setForm(current => ({ ...current, adjuntoId: file.id }))
      setUsingInforme(false)
      setShowDocumentPicker(false)
      setNotice('Expediente generado y adjuntado. Revisá el mensaje antes de publicarlo.')
    } catch (caught) {
      if (operation.isCurrent()) setError(errorMsg(caught, 'No se pudo generar el expediente. No se publicó ningún correo.'))
    } finally { if (operation.isCurrent()) setBusy(null); operation.finish() }
  }

  function requestPublish() {
    if (disabled) return
    try { validarCorreoQueja(form.correo, true) } catch (caught) { setError(errorMsg(caught, 'Revisá el asunto y el mensaje del correo.')); return }
    if (!form.numeroOficio.trim() || usingInforme || !selectedFile) {
      setError('Completá el número de oficio y generá el expediente o seleccioná el archivo oficial.'); return
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
              <Button variant="ghost" size="icon" aria-label="Elegir adjunto" title="Elegir adjunto" disabled={disabled}
                aria-expanded={showDocumentPicker} onClick={() => setShowDocumentPicker(value => !value)}>
                <Paperclip aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
              <Button size="sm" variant="ghost" disabled={disabled} onClick={close}><Trash2 aria-hidden="true" className="size-4" />Descartar</Button>
              <Button size="sm" variant="secondary" disabled={disabled || !!saved && !dirty} loading={busy === 'save'} onClick={() => { void write('save') }}>Guardar borrador</Button>
            </div>
          </>}
      </div>}>
      {notice && <p role="status" className="shrink-0 border-b border-qms-border bg-qms-surface px-4 py-2 text-sm text-qms-success sm:px-6">{notice}</p>}
      {initial.publicada ? <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-qms-surface p-5 sm:p-6">
        <p className="text-sm text-qms-muted">La respuesta ya fue publicada el {caseDate(initial.publicada.publicado_at)}. Se conserva en modo de lectura.</p>
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        <h3 className="text-base font-medium">{initial.borrador?.correo_cuerpo ? 'Correo de acompañamiento' : 'Respuesta publicada'}</h3>
        {initial.borrador?.correo_asunto && <p className="text-sm"><span className="font-medium">Asunto: </span>{initial.borrador.correo_asunto}</p>}
        <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{initial.borrador?.correo_cuerpo ?? initial.publicada.respuesta}</p>
        <p className="break-words text-sm">Oficio: {snapshot.numero_oficio_resolucion || 'Registrado en el expediente'} · {props.adjuntos.find(file => file.id === initial.publicada?.adjunto_id)?.nombre || 'Documento oficial publicado'}</p>
      </div> : <div data-response-compose className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-qms-surface">
        {error && <div role="alert" className="shrink-0 border-b border-qms-border bg-soft-red-bg px-4 py-3 text-sm text-qms-danger sm:px-6">{error}</div>}
        <QuejaCorreoEditor id={'respuesta-correo-' + snapshot.id} destinatario={snapshot.email_cliente ?? ''} correo={form.correo} onChange={correo => change({ correo })} disabled={disabled} />
        <div data-response-attachments className="shrink-0 border-t border-qms-border bg-qms-hover-bg/30 px-4 py-4 sm:px-6">
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
            <label htmlFor={'respuesta-oficio-' + snapshot.id} className="shrink-0 text-xs font-medium text-qms-muted">N.º de oficio</label>
            <input id={'respuesta-oficio-' + snapshot.id} value={form.numeroOficio} required maxLength={120} disabled={disabled}
              className="min-w-0 flex-1 border-b border-qms-border bg-transparent px-1 py-1 text-sm text-qms-dark outline-none focus-visible:border-qms-primary disabled:opacity-65"
              placeholder="Oficio oficial de ECA" onChange={event => change({ numeroOficio: event.target.value })} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Paperclip aria-hidden="true" className="size-3.5 text-qms-muted" />
            <h3 className="text-xs font-semibold tracking-wide text-qms-muted uppercase">Adjuntos seleccionados</h3>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {selectedFile && !usingInforme && <div data-response-selected-file className="inline-flex max-w-full items-center gap-2 rounded-button border border-qms-border bg-qms-surface px-3 py-2 text-sm shadow-sm">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-qms-danger" />
              <button type="button" className="min-w-0 max-w-[240px] cursor-pointer truncate font-medium text-qms-dark hover:text-qms-primary sm:max-w-[420px]"
                title={'Vista previa de ' + selectedFile.nombre} onClick={() => setPreviewFile(selectedFile)}>{selectedFile.nombre}</button>
              <button type="button" aria-label="Quitar adjunto seleccionado" title="Quitar adjunto" disabled={disabled}
                className="ml-1 inline-flex size-5 cursor-pointer items-center justify-center rounded-button text-qms-muted hover:bg-qms-hover-bg hover:text-qms-danger disabled:opacity-50"
                onClick={() => { change({ adjuntoId: null }); setShowDocumentPicker(true) }}><X aria-hidden="true" className="size-3.5" /></button>
            </div>}
            {usingInforme && report && <span className="inline-flex max-w-full items-center gap-2 rounded-button border border-qms-border bg-qms-surface px-3 py-2 text-xs text-qms-muted">
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              Informe guardado · pendiente de generar archivo
            </span>}
            {!selectedFile && !usingInforme && <span className="text-sm text-qms-muted">Sin documento oficial seleccionado.</span>}
            <button type="button" aria-expanded={showDocumentPicker} aria-controls={'respuesta-documentos-' + snapshot.id}
              onClick={() => setShowDocumentPicker(value => !value)} disabled={disabled}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-button border border-dashed border-qms-border px-3 py-2 text-xs font-medium text-qms-muted transition-colors hover:border-qms-primary hover:bg-qms-primary-soft hover:text-qms-primary disabled:cursor-not-allowed disabled:opacity-50">
              <Plus aria-hidden="true" className="size-3.5" />Cambiar o subir archivo
            </button>
            <Button data-response-generate size="sm" variant="secondary" disabled={disabled || props.archivosLoading || props.archivosError}
              loading={busy === 'generate'} onClick={() => { void generarExpediente() }}><FileText aria-hidden="true" className="size-4" />Generar expediente</Button>
          </div>
          {showDocumentPicker && <div id={'respuesta-documentos-' + snapshot.id} className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-qms-border pt-3">
            <label htmlFor={'respuesta-documento-' + snapshot.id} className="text-xs text-qms-muted">Documento oficial</label>
            <Select id={'respuesta-documento-' + snapshot.id} value={usingInforme ? 'informe' : form.adjuntoId ?? ''}
              disabled={disabled || props.archivosLoading || props.archivosError} wrapperClassName="min-w-0 flex-1 basis-52"
              onChange={event => { const value = event.target.value; if (value === 'informe') { setUsingInforme(true); change({ adjuntoId: null }) } else { setUsingInforme(false); change({ adjuntoId: value || null }) } }}>
              <option value="">Seleccionar documento</option>
              {report && <option value="informe">Informe guardado · generar Word</option>}
              {[...files].sort((a, b) => Number(b.tipo_mime === 'application/pdf') - Number(a.tipo_mime === 'application/pdf')).map(file => <option key={file.id} value={file.id}>{file.nombre}</option>)}
            </Select>
            <label className={'ui-button ui-button-secondary ui-button-sm ' + (disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
              <Upload aria-hidden="true" className="size-4" />Subir
              <input type="file" aria-label="Adjuntar documento oficial" className="sr-only" disabled={disabled}
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
            </label>
            <Button variant="secondary" size="sm" disabled={disabled || (usingInforme ? !report?.contenido.trim() : !selectedFile)}
              onClick={() => { if (usingInforme) setPreviewReport(true); else setPreviewFile(selectedFile) }}><Eye aria-hidden="true" className="size-4" />Visualizar</Button>
            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => {
              const visit = scope.capture(), context = scope.captureContext()
              reportIsCurrent.current = () => visit() && context()
              setEditingReport(true)
            }}><Pencil aria-hidden="true" className="size-4" />Editar informe</Button>
          </div>}
          {props.archivosError && <p role="alert" className="mt-2 text-xs text-qms-danger">No se pudieron cargar los archivos. <Button size="sm" variant="link" onClick={props.onReintentar}>Reintentar</Button></p>}
        </div>
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

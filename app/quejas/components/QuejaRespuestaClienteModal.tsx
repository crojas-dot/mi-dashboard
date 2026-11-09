'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import RichTextContent from '@/components/ui/RichTextContent'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import QuejaInformeHoja from '@/app/quejas/components/QuejaInformeHoja'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'
import { useRespuestaCliente, respuestaClienteKey, type RespuestaClienteContext } from '@/lib/queries/useQuejaRespuestaCliente'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQuejaInforme, quejaInformeKey } from '@/lib/queries/useQuejaInforme'
import { guardarQuejaInforme } from '@/lib/services/quejaInformeService'
import { crearPlantillaInforme, informeFilename, type QuejaInforme } from '@/lib/utils/quejaInforme'
import { esOficioPublicableQueja, guardarRespuestaClienteBorrador, publicarRespuestaAprobada, transicionarQueja, type RespuestaClienteDraftInput } from '@/lib/services/quejaWorkflowService'
import { errorMsg } from '@/lib/services/errorToast'
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
  onUpdated: (updated?: Queja, isCurrent?: () => boolean) => void
  onClose: () => void
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
  const [form, setForm] = useState<RespuestaClienteDraftInput>(() => ({ respuesta: initial.borrador?.respuesta ?? 'La resolución de su solicitud se detalla en el informe oficial adjunto, disponible también en el seguimiento privado del expediente.',
    numeroOficio: initial.borrador?.numero_oficio ?? queja.numero_oficio_resolucion ?? '', adjuntoId: initial.borrador?.adjunto_id ?? null }))
  const [saved, setSaved] = useState(initial.borrador)
  const [report, setReport] = useState(initial.informe)
  const [contenido, setContenido] = useState(() => initial.informe?.contenido ?? crearPlantillaInforme(queja, props.adjuntos, props.autor))
  const [usingInforme, setUsingInforme] = useState(!initial.borrador?.adjunto_id)
  const [uploaded, setUploaded] = useState<QuejaAdjunto[]>([])
  const [busy, setBusy] = useState<'save' | 'publish' | 'finish' | 'upload' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const scope = useEntityRequestGuard(snapshot.id)
  const queryClient = useQueryClient()
  const draftGeneration = useRef(0)
  const generatedFileId = useRef<string | null>(null)
  const files = [...props.adjuntos, ...uploaded.filter(file => !props.adjuntos.some(existing => existing.id === file.id))]
    .filter(file => esOficioPublicableQueja(file, snapshot.id))
  const approved = initial.aprobacion ? { value: initial.aprobacion.propuesta, format: initial.aprobacion.propuesta_formato }
    : { value: snapshot.resolucion || 'Sin resolución histórica registrada.', format: snapshot.resolucion_formato }
  const reportDirty = !report || report.contenido !== contenido
  const dirty = !initial.publicada && (reportDirty || usingInforme || form.respuesta !== (saved?.respuesta ?? form.respuesta)
    || form.numeroOficio !== (saved?.numero_oficio ?? snapshot.numero_oficio_resolucion ?? '') || form.adjuntoId !== (saved?.adjunto_id ?? null))
  const disabled = !!busy || props.subiendo
  const change = (patch: Partial<RespuestaClienteDraftInput>) => { draftGeneration.current++; setForm(current => ({ ...current, ...patch })); setError(''); setNotice('') }

  async function write(kind: 'save' | 'publish' | 'finish') {
    const operation = scope.start('response-write')
    if (!operation) return
    const isContextCurrent = scope.captureContext(), generation = draftGeneration.current
    setBusy(kind); setError(''); setNotice('')
    let committed = false
    try {
      let nextForm = form
      let selectedFile = files.find(file => file.id === form.adjuntoId) ?? null
      if (kind !== 'finish') {
        let latestReport = report
        if (reportDirty) {
          latestReport = await guardarQuejaInforme({ quejaId: snapshot.id, version: report?.version ?? 0, fuenteRevision: report?.fuente_revision ?? snapshot.revision, contenido })
          committed = true
          if (isContextCurrent()) queryClient.setQueryData(quejaInformeKey(snapshot.id), latestReport)
          if (!operation.isCurrent() || !isContextCurrent()) return
          setReport(latestReport)
        }
        if (usingInforme) {
          const { crearInformeWord } = await import('@/lib/utils/quejaInformeWord')
          const blob = await crearInformeWord(contenido)
          if (!operation.isCurrent() || !isContextCurrent()) return
          const name = informeFilename(snapshot.folio).replace(/\.docx$/, `-v${latestReport!.version}.docx`)
          const file = await props.onSubir(new File([blob], name, { type: blob.type }))
          if (!operation.isCurrent() || !isContextCurrent()) return
          if (!file) throw new Error('No se pudo confirmar el archivo del informe. El texto guardado se conserva.')
          setUploaded(current => [...current, file]); setUsingInforme(false)
          generatedFileId.current = file.id
          selectedFile = file
          nextForm = { ...form, adjuntoId: file.id }; setForm(nextForm)
        }
      }
      if (kind === 'save') {
        const result = await guardarRespuestaClienteBorrador(snapshot, saved?.version ?? 0, nextForm)
        committed = true
        if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: respuestaClienteKey(snapshot.id) })
        if (operation.isCurrent() && generation === draftGeneration.current) {
          setSaved(result); setForm({ respuesta: result.respuesta, numeroOficio: result.numero_oficio, adjuntoId: result.adjunto_id }); setNotice('Borrador guardado. Podés continuar después desde el expediente.')
        }
      } else {
        const updated = kind === 'finish' ? await transicionarQueja(snapshot, 'Finalizado')
          : await publicarRespuestaAprobada(snapshot, saved?.version ?? 0, nextForm, selectedFile)
        committed = true
        if (isContextCurrent()) props.onUpdated(updated, operation.isCurrent)
        if (operation.isCurrent()) props.onClose()
      }
    } catch (caught) {
      if (operation.isCurrent()) { setConfirmPublish(false); if (committed) setNotice('El informe quedó guardado. Comprobá el borrador y la publicación antes de repetir la operación.'); setError(errorMsg(caught, 'No se pudo completar la operación. El texto se conserva.')) }
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

  function requestPublish() {
    if (disabled) return
    if (!form.numeroOficio.trim() || (usingInforme ? !contenido.trim() : !files.some(file => file.id === form.adjuntoId))) {
      setError('Completá el número de oficio y el informe o documento oficial.'); return
    }
    setConfirmPublish(true)
  }
  const close = () => { if (disabled) return; if (dirty) setConfirmClose(true); else props.onClose() }
  return <>
    <Modal open onClose={close} title={'Informe de respuesta al cliente · ' + snapshot.folio} size="xl" variant="document" dismissOnBackdrop={false}
      footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={disabled} onClick={close}>Cerrar</Button>{initial.publicada
        ? <Button disabled={disabled} loading={busy === 'finish'} onClick={() => { void write('finish') }}>Finalizar expediente</Button>
        : <><Button variant="secondary" disabled={disabled || !dirty} loading={busy === 'save'} onClick={() => { void write('save') }}>Guardar borrador</Button><Button disabled={disabled || props.archivosLoading || props.archivosError} loading={busy === 'publish'} onClick={requestPublish}>Publicar respuesta</Button></>}</div>}>
      {notice && <p role="status" className="shrink-0 px-4 py-2 text-sm text-qms-success">{notice}</p>}
      {initial.publicada ? <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <p className="text-sm text-qms-muted">La respuesta ya fue publicada el {caseDate(initial.publicada.publicado_at)}. Se conserva en modo de lectura.</p>
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        <h3 className="text-base font-medium">Respuesta publicada</h3><p className="whitespace-pre-wrap break-words text-base leading-relaxed">{initial.publicada.respuesta}</p>
        <p className="break-words text-sm">Oficio: {snapshot.numero_oficio_resolucion || 'Registrado en el expediente'} · {props.adjuntos.find(file => file.id === initial.publicada?.adjunto_id)?.nombre || 'Documento oficial publicado'}</p>
        <details><summary className="cursor-pointer py-2 text-sm font-medium text-qms-primary">Consultar resolución aprobada</summary><RichTextContent value={approved.value} format={approved.format} /></details>
      </div> : <>
        <div className="max-h-[34dvh] shrink-0 space-y-2 overflow-y-auto overscroll-contain border-b border-qms-border bg-qms-surface px-4 py-3">
          {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(0,2fr)]">
            <Field id={'respuesta-oficio-' + snapshot.id} label="N.º de oficio emitido por ECA"><Input id={'respuesta-oficio-' + snapshot.id} required maxLength={120} value={form.numeroOficio} disabled={disabled} onChange={event => change({ numeroOficio: event.target.value })} /></Field>
            <Field id={'respuesta-documento-' + snapshot.id} label="Informe que recibirá el cliente"><div className="flex min-w-0 flex-wrap gap-2">
              <Select id={'respuesta-documento-' + snapshot.id} value={usingInforme ? 'informe' : form.adjuntoId ?? ''} disabled={disabled || props.archivosLoading || props.archivosError} wrapperClassName="min-w-0 flex-1 basis-48" onChange={event => { const value = event.target.value; setUsingInforme(value === 'informe'); if (value !== 'informe') change({ adjuntoId: value || null }); else { draftGeneration.current++; setError('') } }}>
                <option value="informe">Informe editable actual · Word (.docx)</option><option value="">Seleccionar archivo del expediente</option>
                {[...files].sort((a,b) => Number(b.tipo_mime === 'application/pdf') - Number(a.tipo_mime === 'application/pdf')).map(file => <option key={file.id} value={file.id}>{file.nombre}</option>)}
              </Select>
              <label className={`ui-button ui-button-secondary ui-button-sm shrink-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>Adjuntar PDF u oficio<input type="file" aria-label="Adjuntar PDF u oficio" className="sr-only" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} /></label>
            </div></Field>
          </div>
          <p className="text-xs text-qms-muted">El correo utiliza la plantilla institucional. {usingInforme ? 'Se adjuntará el Word de este informe.' : 'Se enviará el archivo seleccionado; las ediciones de abajo se guardan en el informe del expediente.'}</p>
          {report && report.fuente_revision < snapshot.revision && <p className="text-xs text-qms-muted">El informe parte de una revisión anterior del caso. Revisá su contenido antes de enviarlo.</p>}
          {props.archivosError && <p role="alert" className="text-xs text-qms-danger">No se pudieron cargar los archivos. <Button size="sm" variant="link" onClick={props.onReintentar}>Reintentar</Button></p>}
        </div>
        <QuejaInformeHoja id={'respuesta-informe-' + snapshot.id} contenido={contenido} disabled={disabled} onChange={value => { draftGeneration.current++; setContenido(value); if (generatedFileId.current && form.adjuntoId === generatedFileId.current) setUsingInforme(true); setError(''); setNotice('') }} />
      </>}
    </Modal>
    <ConfirmDialog open={confirmPublish} title="Publicar respuesta al cliente" message={<>El cliente recibirá el correo institucional con <strong className="break-words">{usingInforme ? 'el Word del informe que estás editando' : files.find(file => file.id === form.adjuntoId)?.nombre}</strong>. Revisá que el documento esté listo para entregarlo. El expediente quedará Finalizado.</>}
      confirmLabel="Publicar respuesta" loading={busy === 'publish'} onCancel={() => setConfirmPublish(false)} onConfirm={() => { void write('publish') }} />
    <ConfirmDialog open={confirmClose} title="Borrador sin guardar" message="Hay cambios pendientes. Volvé al formulario para guardarlos o cerrá descartando estas ediciones." confirmLabel="Descartar cambios" danger onCancel={() => setConfirmClose(false)} onConfirm={props.onClose} />
  </>
}

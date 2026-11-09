import { Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import RichTextContent from '@/components/ui/RichTextContent'
import type { RichTextFormat } from '@/lib/utils/richText'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import { REGISTRO_QUEJA_LIMITES } from '@/lib/constants/quejas'

interface Props {
  id: string
  respuesta: string
  onRespuestaChange: (value: string) => void
  oficio: string
  onOficioChange: (value: string) => void
  adjuntos: QuejaAdjunto[]
  adjuntoId: string
  onAdjuntoChange: (value: string) => void
  archivosLoading: boolean
  archivosError: boolean
  onReintentar: () => void
  onSubir: (file: File) => void
  subiendo: boolean
  disabled: boolean
  error?: string | null
  resolucionAprobada?: { value: string; format?: RichTextFormat }
}

/** El cliente ve únicamente esta redacción explícita y el archivo elegido, nunca el análisis. */
export default function QuejaPublicacionPanel(props: Props) {
  const prefix = `queja-publicacion-${props.id}`
  const archivos = [...props.adjuntos].sort((a, b) => Number(b.tipo_mime === 'application/pdf') - Number(a.tipo_mime === 'application/pdf'))
  return <section aria-label="Comunicación al cliente" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain [will-change:transform] px-4 py-4 sm:px-6">
      <p className="text-sm text-qms-muted">Esta respuesta y el oficio seleccionado serán visibles para el cliente.</p>
      {props.error && <p role="alert" className="text-sm text-qms-danger">{props.error}</p>}
      <div>
        <label htmlFor={`${prefix}-respuesta`} className="mb-2 block text-sm font-medium">Respuesta al cliente</label>
        <Textarea id={`${prefix}-respuesta`} required maxLength={10000} rows={7} value={props.respuesta} disabled={props.disabled}
          placeholder="Redactá la comunicación oficial para el cliente…" className="min-h-40 w-full resize-y px-3 py-2 text-base leading-relaxed"
          aria-describedby={`${prefix}-contador`} onChange={event => props.onRespuestaChange(event.target.value)} />
        <p id={`${prefix}-contador`} className="mt-1 text-right text-xs text-qms-muted">{props.respuesta.length.toLocaleString('es-CR')} / 10.000</p>
      </div>
        <Field id={`${prefix}-oficio`} label="N.º de oficio emitido por ECA">
          <Input id={`${prefix}-oficio`} required maxLength={REGISTRO_QUEJA_LIMITES.oficio} value={props.oficio}
            disabled={props.disabled} onChange={event => props.onOficioChange(event.target.value)} />
        </Field>
        <Field id={`${prefix}-archivo`} label="Documento oficial">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <Select id={`${prefix}-archivo`} required value={props.adjuntoId} disabled={props.disabled || props.archivosLoading || props.archivosError || props.subiendo}
              wrapperClassName="min-w-0 flex-1 basis-48" className="w-full" onChange={event => props.onAdjuntoChange(event.target.value)}>
              <option value="">{props.archivosLoading ? 'Cargando archivos…' : 'Seleccionar oficio adjunto'}</option>
              {archivos.map(adjunto => <option key={adjunto.id} value={adjunto.id}>{adjunto.nombre}</option>)}
            </Select>
            <label title="Adjuntar oficio" className={`ui-button ui-button-secondary ui-button-sm shrink-0 ${props.disabled || props.subiendo ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <Upload className="size-4" aria-hidden="true" />
              <span>Adjuntar oficio</span>
              <input type="file" className="sr-only" aria-label="Adjuntar oficio" disabled={props.disabled || props.subiendo}
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) props.onSubir(file) }} />
            </label>
          </div>
        </Field>
      {props.subiendo ? <p role="status" className="text-xs text-qms-muted">Subiendo oficio…</p> : props.archivosError
        ? <p role="alert" className="text-xs text-qms-danger">No se pudieron cargar los archivos. <Button size="sm" variant="link" onClick={props.onReintentar}>Reintentar</Button></p>
        : <p className="text-xs text-qms-muted">PDF recomendado. Se conservan los formatos admitidos en el expediente. Solo se publica el oficio seleccionado.</p>}
      {props.resolucionAprobada && <details className="pb-4"><summary className="cursor-pointer py-2 text-sm font-medium text-qms-primary">Consultar resolución aprobada</summary><div className="pt-2"><RichTextContent value={props.resolucionAprobada.value} format={props.resolucionAprobada.format} /></div></details>}
  </section>
}

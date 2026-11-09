import RichTextEditor from '@/components/ui/RichTextEditor'
import { INFORME_MAX_LENGTH } from '@/lib/utils/quejaInforme'

/** La misma hoja se edita al generar expediente y al preparar el informe oficial. */
export default function QuejaInformeHoja({ id, contenido, onChange, onInitialized, disabled }: { id: string; contenido: string; onChange: (value: string) => void; onInitialized?: (value: string) => void; disabled: boolean }) {
  return <RichTextEditor id={id} label="Contenido del informe" value={contenido} format="markdown" onChange={onChange} onInitialized={onInitialized} variant="document" layout="fill" pagination disabled={disabled} maxLength={INFORME_MAX_LENGTH} minHeight={900} className="queja-informe-editor" />
}

import type { Queja } from '@/lib/types'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import type { RichTextFormat } from '@/lib/utils/richText'

export const INFORME_MAX_LENGTH = 100000

export interface QuejaInforme {
  queja_id: string
  version: number
  contenido: string
  fuente_revision: number
  creado_por: string
  created_at: string
}

// Los datos plain siguen siendo literales al incorporarlos a una plantilla Markdown.
export function informeLiteral(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~\-])/g, '\\$1')
}

function documento(value: string | null | undefined, format?: RichTextFormat): string {
  return value?.trim() ? (format === 'markdown' ? value : informeLiteral(value)) : 'Sin información registrada.'
}

export function crearPlantillaInforme(queja: Queja, anexos: readonly { nombre: string }[], autor: string, fecha = new Date()): string {
  const analysis = getQuejaAnalysis(queja)
  const date = (value: Date) => new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeZone: 'America/Costa_Rica' }).format(value)
  const receivedValue = queja.fecha_recepcion_gc || queja.fecha
  // DATE civil no debe retroceder un día al interpretarse como medianoche UTC.
  const received = new Date(/^\d{4}-\d{2}-\d{2}$/.test(receivedValue) ? receivedValue + 'T12:00:00-06:00' : receivedValue)
  const lines = [
    '## ENTE COSTARRICENSE DE ACREDITACIÓN',
    '**Gestión de Calidad**',
    `**INFORME N°:** ${informeLiteral(queja.numero_oficio_resolucion || 'Pendiente de asignar')}`,
    `**A:** ${informeLiteral(queja.cliente_nombre)}`,
    `**DE:** ${informeLiteral(autor || 'Gestión de Calidad')}`,
    `**FECHA:** ${date(fecha)}`,
    `**ASUNTO:** ${informeLiteral((queja.tipo || queja.categoria) + ' · Folio ' + queja.folio)}`,
    '## 1. Antecedentes del expediente',
    `**Folio:** ${informeLiteral(queja.folio)}`,
    `**Recepción:** ${Number.isNaN(received.getTime()) ? 'Sin fecha registrada' : date(received)}`,
    `**Estado al generar:** ${informeLiteral(queja.estado)}`,
    `**Área afectada:** ${informeLiteral(queja.area_afectada || 'Sin asignar')}`,
    '### Descripción',
    documento(queja.descripcion),
    '## 2. Evaluación e investigación',
    '### Evaluación de procedencia · Gestión de Calidad',
    documento(queja.justificacion_procede, queja.justificacion_procede_formato),
    ...(analysis ? ['### Hallazgos del análisis', documento(analysis.value, analysis.format)] : []),
    ...(queja.resolucion?.trim() ? ['### Propuesta o resolución registrada', documento(queja.resolucion, queja.resolucion_formato)] : []),
    '## 3. Conclusión y Resolución Final',
    '&nbsp;\n\n&nbsp;',
    '## Anexos',
    ...(anexos.length ? anexos.map((file, index) => `- Anexo ${index + 1}: ${informeLiteral(file.nombre.replace(/[\r\n]+/g, ' '))}`) : ['Sin archivos adjuntos registrados.']),
  ]
  return lines.join('\n\n')
}

export function informeFilename(folio: string): string {
  return `Expediente-${folio.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 100) || 'sin-folio'}.docx`
}

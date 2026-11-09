import type { Queja } from '@/lib/types'
import { richTextFormat, type RichTextFormat } from '@/lib/utils/richText'

interface QuejaAnalysis {
  value: string
  format: RichTextFormat
}

/** Lectura de notas: conserva su formato, sin deducir Markdown por sus caracteres. */
export function getQuejaAnalysis(queja: Pick<Queja, 'notas' | 'notas_formato' | 'justificacion_procede'>): QuejaAnalysis | null {
  let notes = queja.notas ?? ''
  const justification = queja.justificacion_procede?.trim()
  const format = richTextFormat(queja.notas_formato)

  // El motor antiguo concatena esta copia literal incluso cuando el wrapper ya
  // guardó la justificación por separado. Ocultar solo una coincidencia completa
  // evita duplicarla; no borra DB ni confunde otros análisis/reaperturas con ella.
  // Un documento marcado explícitamente Markdown pertenece al autor; una cita o
  // un ejemplo con [Procede] no se trata como el apéndice plain del motor antiguo.
  if (justification && format === 'plain') {
    const compatibilityCopy = '[Procede] ' + justification
    let offset = 0
    while (offset < notes.length) {
      const start = notes.indexOf(compatibilityCopy, offset)
      if (start < 0) break
      const end = start + compatibilityCopy.length
      const startsLine = start === 0 || notes[start - 1] === '\n' || notes[start - 1] === '\r'
      const endsLine = end === notes.length || notes[end] === '\n' || notes[end] === '\r'
      if (startsLine && endsLine) {
        // También pertenece al apéndice el salto añadido delante de [Procede].
        const separatorStart = start > 0 ? start - (notes[start - 1] === '\n' && notes[start - 2] === '\r' ? 2 : 1) : start
        notes = notes.slice(0, separatorStart) + notes.slice(end)
        offset = separatorStart
      } else {
        offset = end
      }
    }
  }

  return notes.trim() ? { value: notes, format } : null
}

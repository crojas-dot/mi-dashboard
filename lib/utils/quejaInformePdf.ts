import { MarkdownManager } from '@tiptap/markdown'
import type { JSONContent } from '@tiptap/core'
import { jsPDF } from 'jspdf'
import { richTextExtensions } from '@/lib/utils/richTextExtensions'

// Medidas en puntos: A4 y márgenes equivalentes al Word.
const MARGIN_X = 62
const MARGIN_TOP = 66
const MARGIN_BOTTOM = 66
const BODY_SIZE = 11
const LINE_HEIGHT = 15.5
const BLUE: [number, number, number] = [21, 52, 92]
const TEXT: [number, number, number] = [37, 43, 53]
const MUTED: [number, number, number] = [100, 116, 139]
const SOFT_BLUE: [number, number, number] = [230, 239, 251]

const LABELS = /^(INFORME N[°ºo]\.?(?:\s*)|A|DE|FECHA|ASUNTO|Folio|Recepción|Estado al generar|Área afectada):\s*(.*)$/i
const SECTION = /^(?:\d+(?:\.\d+)*[.)]?\s+\S|Anexos\s*$)/i

type Span = { text: string; bold: boolean; italic: boolean }
type Line = { items: Span[]; width: number }

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(textOf).join('')
}

function visibleText(node: JSONContent): string {
  return textOf(node).replace(/\u00a0|&nbsp;/gi, ' ').replace(/[\u200b\ufeff]/g, '').trim()
}

function isBoldOnly(node: JSONContent): boolean {
  const items = (node.content ?? []).filter(child => child.type === 'text' && child.text?.trim())
  return items.length > 0 && items.every(child => child.marks?.some(mark => mark.type === 'bold'))
}

function isInstitution(text: string): boolean {
  return /^ENTE COSTARRICENSE DE ACREDITACI[ÓO]N$/i.test(text.trim())
}

function spansOf(nodes: JSONContent[] = [], inherited = { bold: false, italic: false }): Span[] {
  const spans: Span[] = []
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      spans.push({ text: '\n', ...inherited })
    } else if (node.type === 'text') {
      spans.push({
        text: (node.text ?? '').replace(/\u00a0|&nbsp;/gi, ' ').replace(/[\u200b\ufeff]/g, ''),
        bold: inherited.bold || Boolean(node.marks?.some(mark => mark.type === 'bold')),
        italic: inherited.italic || Boolean(node.marks?.some(mark => mark.type === 'italic')),
      })
    } else if (node.content) {
      spans.push(...spansOf(node.content, inherited))
    }
  }
  return spans
}

export async function crearInformePdf(contenido: string): Promise<Blob> {
  const tree = new MarkdownManager({ extensions: richTextExtensions() }).parse(contenido)
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN_X * 2
  const maxY = pageHeight - MARGIN_BOTTOM
  let y = MARGIN_TOP

  const setText = (size = BODY_SIZE, color: [number, number, number] = TEXT, bold = false, italic = false) => {
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'))
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  const ensureSpace = (height: number) => {
    if (y + height > maxY && y > MARGIN_TOP) {
      doc.addPage()
      y = MARGIN_TOP
    }
  }

  const addSpace = (amount: number) => {
    // No crear una página vacía por separación entre párrafos.
    y = Math.min(maxY, y + amount)
  }

  const measure = (span: Span, text: string, size: number) => {
    setText(size, TEXT, span.bold, span.italic)
    return doc.getTextWidth(text)
  }

  const wrapSpans = (segments: Span[], width: number, size: number): Line[] => {
    const lines: Line[] = [{ items: [], width: 0 }]
    const current = () => lines[lines.length - 1]!
    const newLine = () => lines.push({ items: [], width: 0 })
    const append = (text: string, span: Span) => {
      if (!text) return
      const line = current()
      const measured = measure(span, text, size)
      line.items.push({ ...span, text })
      line.width += measured
    }

    for (const segment of segments) {
      const tokens = segment.text.replace(/\r\n?/g, '\n').split(/(\n|[ \t]+)/g)
      for (const token of tokens) {
        if (!token) continue
        if (token === '\n') {
          newLine()
          continue
        }
        const blank = /^[ \t]+$/.test(token)
        let rest = blank ? ' ' : token
        if (blank && !current().items.length) continue

        while (rest) {
          if (blank && !current().items.length) break
          const available = width - current().width
          const measured = measure(segment, rest, size)
          if (measured <= available + 0.1) {
            append(rest, segment)
            break
          }
          if (current().items.length) {
            newLine()
            if (blank) break
            continue
          }
          // Una palabra extremadamente larga también debe ajustarse al ancho.
          let end = 1
          while (end < rest.length && measure(segment, rest.slice(0, end + 1), size) <= width) end++
          append(rest.slice(0, end), segment)
          rest = rest.slice(end)
          if (rest) newLine()
        }
      }
    }
    // No generar líneas vacías de cierre por hardBreak al final.
    while (lines.length > 1 && !lines[lines.length - 1]!.items.length) lines.pop()
    return lines
  }

  const paintLines = (lines: Line[], x: number, size = BODY_SIZE, lineHeight = LINE_HEIGHT, color: [number, number, number] = TEXT) => {
    for (const line of lines) {
      ensureSpace(lineHeight)
      let advance = 0
      for (const span of line.items) {
        setText(size, color, span.bold, span.italic)
        doc.text(span.text, x + advance, y + size)
        advance += doc.getTextWidth(span.text)
      }
      y += lineHeight
    }
  }

  const drawMetadata = (label: string, value: string) => {
    const column = 120
    setText(10.5, BLUE, true)
    const wrapped = wrapSpans([{ text: value, bold: false, italic: false }], contentWidth - column, 11)
    // La etiqueta y su valor comienzan siempre en la misma línea.
    for (const [i, line] of wrapped.entries()) {
      ensureSpace(LINE_HEIGHT)
      if (i === 0) {
        setText(10.5, BLUE, true)
        doc.text(label, MARGIN_X, y + 11)
      }
      let advance = 0
      for (const part of line.items) {
        setText(11, TEXT, part.bold, part.italic)
        doc.text(part.text, MARGIN_X + column + advance, y + 11)
        advance += doc.getTextWidth(part.text)
      }
      y += LINE_HEIGHT
    }
    addSpace(3)
  }

  const drawParagraph = (node: JSONContent, indent = 0, prefix?: string) => {
    const text = visibleText(node)
    if (!text) return
    const metadata = node.type === 'paragraph' && !prefix ? text.match(LABELS) : null
    if (metadata) {
      drawMetadata(`${metadata[1].trim()}:`, metadata[2])
      return
    }
    const prefixWidth = prefix ? 22 : 0
    const lines = wrapSpans(spansOf(node.content), contentWidth - indent - prefixWidth, BODY_SIZE)
    if (prefix) {
      ensureSpace(LINE_HEIGHT)
      setText(11, TEXT)
      doc.text(prefix, MARGIN_X + indent, y + 11)
    }
    paintLines(lines, MARGIN_X + indent + prefixWidth)
    addSpace(prefix ? 5 : 8)
  }

  const drawHeading = (node: JSONContent) => {
    const title = visibleText(node)
    if (!title) return
    if (isInstitution(title)) {
      const size = 15
      const lines = wrapSpans([{ text: title, bold: true, italic: false }], contentWidth, size)
      ensureSpace(lines.length * 19 + 18)
      paintLines(lines, MARGIN_X, size, 19, BLUE)
      addSpace(5)
      return
    }
    if (SECTION.test(title)) {
      const size = 12
      const lines = wrapSpans([{ text: title, bold: true, italic: false }], contentWidth - 20, size)
      const bandHeight = Math.max(27, lines.length * 16 + 10)
      ensureSpace(bandHeight + 27)
      addSpace(12)
      ensureSpace(bandHeight + 15)
      doc.setFillColor(...SOFT_BLUE)
      doc.roundedRect(MARGIN_X, y, contentWidth, bandHeight, 3, 3, 'F')
      const bandTop = y
      y += 5
      paintLines(lines, MARGIN_X + 9, size, 16, BLUE)
      y = bandTop + bandHeight
      addSpace(9)
      return
    }
    const size = title === 'Gestión de Calidad' ? 10.5 : 11
    const lines = wrapSpans([{ text: title, bold: true, italic: false }], contentWidth, size)
    ensureSpace(lines.length * 15 + 18)
    if (title !== 'Gestión de Calidad') addSpace(6)
    paintLines(lines, MARGIN_X, size, 15, BLUE)
    addSpace(5)
  }

  const visit = (nodes: JSONContent[] = [], depth = 0): void => {
    for (const node of nodes) {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        const ordered = node.type === 'orderedList'
        const start = Math.max(1, Number(node.attrs?.start ?? 1) || 1)
        for (const [i, item] of (node.content ?? []).entries()) {
          let first = true
          for (const child of item.content ?? []) {
            if (child.type === 'paragraph') {
              if (!visibleText(child)) continue
              drawParagraph(child, 14 + depth * 16, first ? (ordered ? `${start + i}.` : '•') : undefined)
              first = false
            } else if (child.type === 'orderedList' || child.type === 'bulletList') {
              visit([child], Math.min(depth + 1, 8))
            } else {
              visit([child], depth)
            }
          }
        }
        continue
      }

      if (node.type === 'blockquote') {
        for (const child of node.content ?? []) {
          if (child.type === 'paragraph') drawParagraph(child, 18)
          else visit([child], depth)
        }
        continue
      }

      if (node.type === 'horizontalRule') {
        ensureSpace(20)
        addSpace(7)
        ensureSpace(13)
        doc.setDrawColor(213, 221, 232)
        doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
        addSpace(13)
        continue
      }

      if (node.type === 'heading' || (node.type === 'paragraph' && isBoldOnly(node) && visibleText(node).length < 120 && !LABELS.test(visibleText(node)))) {
        drawHeading(node)
        continue
      }

      if (node.type === 'paragraph') {
        drawParagraph(node)
        continue
      }

      if (node.content?.length) visit(node.content, depth)
    }
  }

  // No exportar los párrafos vacíos que la paginación visual deja en Markdown.
  visit(tree.content)

  // Pie de página del archivo real, sin alterar el contenido.
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    setText(8.5, MUTED)
    doc.text(`Página ${i} de ${total}`, pageWidth - MARGIN_X, pageHeight - 34, { align: 'right' })
  }

  return doc.output('blob') as Blob
}

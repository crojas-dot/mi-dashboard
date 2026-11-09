import { MarkdownManager } from '@tiptap/markdown'
import type { JSONContent } from '@tiptap/core'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  type INumberingOptions,
  type IParagraphOptions,
} from 'docx'
import { richTextExtensions } from '@/lib/utils/richTextExtensions'

// Diseño de exportación A4 equivalente al PDF. Medidas Word en twips.
const BLUE = '15345C'
const TEXT = '252B35'
const MUTED = '64748B'
const SOFT_BLUE = 'E6EFFB'
const BORDER = 'D5DDE8'
const FONT = 'Arial'

const LABELS = /^(INFORME N[°ºo]\.?(?:\s*)|A|DE|FECHA|ASUNTO|Folio|Recepción|Estado al generar|Área afectada):\s*(.*)$/i
const SECTION = /^(?:\d+(?:\.\d+)*[.)]?\s+\S|Anexos\s*$)/i

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(textOf).join('')
}

function visibleText(node: JSONContent): string {
  return textOf(node).replace(/\u00a0|&nbsp;/gi, ' ').replace(/[\u200b\ufeff]/g, '').trim()
}

function isEmpty(node: JSONContent): boolean {
  return (node.type === 'paragraph' || node.type === 'heading') && !visibleText(node)
}

function isBoldOnly(node: JSONContent): boolean {
  const items = (node.content ?? []).filter(child => child.type === 'text' && child.text?.trim())
  return items.length > 0 && items.every(child => child.marks?.some(mark => mark.type === 'bold'))
}

function isInstitution(text: string): boolean {
  return /^ENTE COSTARRICENSE DE ACREDITACI[ÓO]N$/i.test(text.trim())
}

function styledRuns(nodes: JSONContent[] = []): TextRun[] {
  const result: TextRun[] = []
  const content = [...nodes]
  while (content.length && (content[content.length - 1]?.type === 'hardBreak' || !visibleText(content[content.length - 1]!))) {
    content.pop()
  }
  for (const node of content) {
    if (node.type === 'hardBreak') {
      result.push(new TextRun({ break: 1 }))
    } else if (node.type === 'text') {
      const chunks = (node.text ?? '').split('\n')
      chunks.forEach((chunk, index) => {
        if (index) result.push(new TextRun({ break: 1 }))
        if (!chunk) return
        result.push(new TextRun({
          text: chunk,
          bold: Boolean(node.marks?.some(mark => mark.type === 'bold')),
          italics: Boolean(node.marks?.some(mark => mark.type === 'italic')),
        }))
      })
    } else if (node.content) {
      result.push(...styledRuns(node.content))
    }
  }
  return result
}

export async function crearInformeWord(contenido: string): Promise<Blob> {
  const tree = new MarkdownManager({ extensions: richTextExtensions() }).parse(contenido)
  const paragraphs: Paragraph[] = []
  const numbering: INumberingOptions['config'][number][] = []
  let listCounter = 0

  const addParagraph = (
    node: JSONContent,
    options: IParagraphOptions = {},
  ) => {
    if (isEmpty(node)) return
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      widowControl: true,
      spacing: { line: 310, after: 150 },
      children: styledRuns(node.content),
      ...options,
    }))
  }

  const addTextBlock = (node: JSONContent, numberingInfo?: { reference: string; level: number }, quote = false) => {
    if (isEmpty(node)) return
    const text = visibleText(node)
    const metadata = node.type === 'paragraph' ? text.match(LABELS) : null

    if (metadata) {
      const label = `${metadata[1].trim()}:`
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: label, bold: true, color: BLUE }),
          new TextRun({ children: [new Tab()] }),
          new TextRun({ text: metadata[2] || '' }),
        ],
        alignment: AlignmentType.LEFT,
        tabStops: [{ type: TabStopType.LEFT, position: 2400 }],
        spacing: { line: 300, after: 85 },
        widowControl: true,
      }))
      return
    }

    if (node.type === 'heading' || (isBoldOnly(node) && text.length < 120 && !numberingInfo)) {
      if (isInstitution(text)) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text, bold: true, color: BLUE, size: 30 })],
          spacing: { before: 0, after: 100, line: 340 },
          keepNext: true,
          keepLines: true,
        }))
        return
      }

      if (SECTION.test(text)) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text, bold: true, color: BLUE, size: 24 })],
          shading: { fill: SOFT_BLUE },
          indent: { left: 135, right: 135 },
          spacing: { before: 195, after: 145, line: 330 },
          keepNext: true,
          keepLines: true,
        }))
        return
      }

      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, color: BLUE, size: text === 'Gestión de Calidad' ? 21 : 22 })],
        spacing: { before: text === 'Gestión de Calidad' ? 0 : 170, after: 105, line: 300 },
        keepNext: true,
        keepLines: true,
      }))
      return
    }

    addParagraph(node, {
      ...(quote ? { indent: { left: 340 } } : {}),
      ...(numberingInfo ? { numbering: numberingInfo, spacing: { line: 310, after: 105 } } : {}),
    })
  }

  const visit = (nodes: JSONContent[] = [], level = 0, quote = false): void => {
    for (const node of nodes) {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        const ordered = node.type === 'orderedList'
        const reference = `eca-informe-lista-${++listCounter}`
        const start = Math.max(1, Number(node.attrs?.start ?? 1) || 1)
        numbering.push({
          reference,
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: ordered ? `%${i + 1}.` : '•',
            start,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 440 * (i + 1), hanging: 220 } } },
          })),
        })
        for (const item of node.content ?? []) {
          let first = true
          for (const child of item.content ?? []) {
            if (child.type === 'paragraph') {
              if (isEmpty(child)) continue
              addTextBlock(child, first ? { reference, level: Math.min(level, 8) } : undefined, quote)
              first = false
            } else if (child.type === 'bulletList' || child.type === 'orderedList') {
              visit([child], Math.min(level + 1, 8), quote)
            } else {
              visit([child], level, quote)
            }
          }
        }
        continue
      }

      if (node.type === 'blockquote') {
        visit(node.content, level, true)
        continue
      }

      if (node.type === 'horizontalRule') {
        paragraphs.push(new Paragraph({
          children: [],
          border: { bottom: { color: BORDER, style: BorderStyle.SINGLE, size: 5 } },
          spacing: { before: 65, after: 155 },
        }))
        continue
      }

      if (node.type === 'paragraph' || node.type === 'heading') {
        addTextBlock(node, undefined, quote)
        continue
      }

      // Si aparece otro contenedor de Tiptap, conservar su texto.
      if (node.content?.length) visit(node.content, level, quote)
    }
  }

  // Se omiten los párrafos vacíos producidos por Enter repetidos al paginar.
  // Los espacios normales entre bloques los controlan los estilos del documento.
  visit(tree.content)

  const doc = new Document({
    creator: 'ECA-QMS',
    title: 'Informe del expediente',
    description: 'Informe del expediente del módulo de Quejas',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: TEXT },
          paragraph: { spacing: { line: 310, after: 150 } },
        },
      },
    },
    numbering: { config: numbering },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1320, right: 1240, bottom: 1320, left: 1240, footer: 620 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
                font: FONT,
                size: 17,
                color: MUTED,
              }),
            ],
          })],
        }),
      },
      children: paragraphs.length ? paragraphs : [new Paragraph('')],
    }],
  })

  return Packer.toBlob(doc)
}

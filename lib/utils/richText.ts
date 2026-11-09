export type RichTextFormat = 'plain' | 'markdown'

export interface RichTextDocument {
  type: string
  text?: string
  content?: RichTextDocument[]
}

// Un documento histórico es texto literal: ** y <...> no implican formato.
// JSON evita que Tiptap interprete etiquetas o Markdown al abrirlo por primera vez.
export function plainTextDocument(value: string): RichTextDocument {
  return {
    type: 'doc',
    content: value.split(/\r\n|\n|\r/).map(line => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
}

export function richTextFormat(value: unknown): RichTextFormat {
  return value === 'markdown' ? 'markdown' : 'plain'
}

import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

// El formato persistido se limita al subconjunto que también acepta el lector.
// No hay enlaces, imágenes remotas, HTML crudo ni adjuntos dentro del editor.
export function richTextExtensions() {
  return [StarterKit.configure({
    heading: { levels: [2, 3] }, link: false, underline: false, strike: false,
    code: false, codeBlock: false,
    trailingNode: false,
  }), Markdown]
}

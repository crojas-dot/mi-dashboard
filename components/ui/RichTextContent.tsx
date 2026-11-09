import ReactMarkdown from 'react-markdown'
import type { RichTextFormat } from '@/lib/utils/richText'

// Los marcadores quedan dentro del padding del documento; el párrafo de cada
// ítem es inline para que la viñeta no aparezca en una línea aislada.
export const richTextClasses = 'min-w-0 break-words text-base leading-relaxed text-qms-dark [&_p]:my-2 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:inline [&_li>p]:m-0 [&_strong]:font-semibold [&_blockquote]:my-4 [&_blockquote]:border-l-3 [&_blockquote]:border-qms-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-qms-muted [&_hr]:my-6 [&_hr]:border-qms-border'

interface RichTextContentProps {
  value: string
  format?: RichTextFormat
  className?: string
}

export default function RichTextContent({ value, format = 'plain', className = '' }: RichTextContentProps) {
  if (format !== 'markdown') return <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>{value}</div>
  return (
    <div className={`${richTextClasses} ${className}`}>
      <ReactMarkdown skipHtml allowedElements={['p', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'br', 'blockquote', 'hr']} unwrapDisallowed>{value}</ReactMarkdown>
    </div>
  )
}

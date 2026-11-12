'use client'

import dynamic from 'next/dynamic'
import Skeleton from '@/components/ui/Skeleton'
import type { RichTextFormat } from '@/lib/utils/richText'

export interface RichTextEditorProps {
  id: string
  label: string
  value: string
  format?: RichTextFormat
  onChange: (value: string, format: RichTextFormat) => void
  onInitialized?: (value: string) => void
  disabled?: boolean
  /** Lectura del mismo documento, sin atenuarlo ni remontar el editor. */
  readOnly?: boolean
  /** Enfoca al habilitar el editor, incluso si su carga lazy termina después. */
  autoFocus?: boolean
  placeholder?: string
  required?: boolean
  variant?: 'field' | 'document'
  /** fill mantiene la barra visible y desplaza solo el documento en un lienzo fijo. */
  layout?: 'content' | 'fill'
  /** Añade paginación A4 visual solo a los documentos que la solicitan. */
  pagination?: boolean
  minHeight?: number
  maxLength?: number
  className?: string
}

// Las bandejas no descargan ProseMirror: el paquete llega solo al montar el editor.
const Editor = dynamic(() => import('@/components/ui/RichTextEditorBody'), {
  ssr: false,
  loading: () => <div aria-busy="true" className="ui-panel space-y-3 p-3"><Skeleton className="h-9 w-56" /><Skeleton className="h-32 w-full" /></div>,
})

export default function RichTextEditor(props: RichTextEditorProps) {
  return <Editor {...props} />
}

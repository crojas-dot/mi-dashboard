
'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Extension, type Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { PaginationPlus } from 'tiptap-pagination-plus'
import {
  Bold,
  Italic,
  Quote,
  Minus,
  RemoveFormatting,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { richTextClasses } from '@/components/ui/RichTextContent'
import { plainTextDocument } from '@/lib/utils/richText'
import { richTextExtensions } from '@/lib/utils/richTextExtensions'
import type { RichTextEditorProps } from '@/components/ui/RichTextEditor'

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const PAGE_GAP = 28
const WORKSPACE_BG = '#f3f5f8'
const PAGE_EDGE = '#d5dce5'

type PageFrame = {
  top: number
  height: number
}

function BordesDePagina({ editor }: { editor: Editor }) {
  const layerRef = useRef<HTMLDivElement>(null)

  const [frames, setFrames] = useState<PageFrame[]>([
    { top: 0, height: PAGE_HEIGHT },
  ])
  const [left, setLeft] = useState(0)
  const [top, setTop] = useState(0)
  const [width, setWidth] = useState(PAGE_WIDTH)

  useEffect(() => {
    const root = editor.view.dom
    const layer = layerRef.current
    if (!layer) return

    let raf = 0

    const measure = () => {
      raf = 0

      const rootRect = root.getBoundingClientRect()
      const layerRect = layer.getBoundingClientRect()

      if (!rootRect.width) return

      const newLeft = rootRect.left - layerRect.left
      const newTop = rootRect.top - layerRect.top
      const newWidth = rootRect.width

      setLeft(old =>
        Math.abs(old - newLeft) < 0.5 ? old : newLeft
      )
      setTop(old =>
        Math.abs(old - newTop) < 0.5 ? old : newTop
      )
      setWidth(old =>
        Math.abs(old - newWidth) < 0.5 ? old : newWidth
      )

      const gaps = Array.from(
        root.querySelectorAll<HTMLElement>('.rm-pagination-gap')
      )
        .filter(gap => getComputedStyle(gap).display !== 'none')
        .map(gap => gap.getBoundingClientRect())
        .filter(rect => rect.height > 1)
        .sort((a, b) => a.top - b.top)

      const next: PageFrame[] = []
      let start = 0

      for (const gap of gaps) {
        const end = gap.top - rootRect.top

        if (end > start + 100) {
          next.push({
            top: start,
            height: end - start,
          })
        }

        start = gap.bottom - rootRect.top
      }

      // Ajuste visual para el borde de la última hoja.
      // No modifica las medidas ni los saltos de PaginationPlus.
      const remainingHeight = rootRect.height - start

      const correction = Math.max(
        0,
        Math.min(20, remainingHeight - PAGE_HEIGHT)
      )

      next.push({
        top: start,
        height: PAGE_HEIGHT + correction,
      })

      setFrames(old => {
        if (
          old.length === next.length &&
          old.every(
            (item, i) =>
              Math.abs(item.top - next[i]!.top) < 0.5 &&
              Math.abs(item.height - next[i]!.height) < 0.5
          )
        ) {
          return old
        }

        return next
      })
    }

    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(measure)
      }
    }

    const mutations = new MutationObserver(schedule)

    mutations.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    const resize = new ResizeObserver(schedule)
    resize.observe(root)
    resize.observe(layer)

    schedule()

    return () => {
      mutations.disconnect()
      resize.disconnect()

      if (raf) cancelAnimationFrame(raf)
    }
  }, [editor])

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
    >
      {frames.map((frame, index) => (
        <div
          key={index}
          className="absolute box-border border border-solid"
          style={{
            left,
            top: top + frame.top,
            width,
            height: frame.height,
            borderColor: PAGE_EDGE,
          }}
        />
      ))}
    </div>
  )
}

function documentLimits(callbacks: {
  maximum: number
  onLimit: (blocked: boolean) => void
}) {
  return Extension.create({
    name: 'qmsDocumentLimits',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction: (transaction, state) => {
            if (
              !transaction.docChanged ||
              transaction.getMeta('preventUpdate')
            ) {
              return true
            }

            const manager = this.editor.storage.markdown.manager

            const nextLength = manager.serialize(
              transaction.doc.toJSON()
            ).length

            const previousLength = manager.serialize(
              state.doc.toJSON()
            ).length

            const allowed =
              nextLength <= callbacks.maximum ||
              nextLength < previousLength

            callbacks.onLimit(!allowed)

            return allowed
          },
        }),
      ]
    },
  })
}

let mountedPagedEditors = 0

function paginationStyleLifecycle() {
  let mounted = false

  return Extension.create({
    name: 'qmsPaginationStyleLifecycle',

    onCreate() {
      if (mounted) return

      mounted = true
      mountedPagedEditors += 1
    },

    onDestroy() {
      if (!mounted) return

      mounted = false

      mountedPagedEditors = Math.max(
        0,
        mountedPagedEditors - 1
      )

      if (mountedPagedEditors === 0) {
        document
          .querySelectorAll('style[data-rm-pagination-style]')
          .forEach(style => style.remove())
      }
    },
  })
}

function toolbarSnapshot(editor: Editor | null) {
  if (!editor) return null

  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    heading: editor.isActive('heading', { level: 2 }),
    subheading: editor.isActive('heading', { level: 3 }),
    quote: editor.isActive('blockquote'),
    bullet: editor.isActive('bulletList'),
    ordered: editor.isActive('orderedList'),
    undo: editor.can().undo(),
    redo: editor.can().redo(),
    empty: editor.isEmpty,
  }
}

export default function RichTextEditorBody({
  id,
  label,
  value,
  format = 'plain',
  variant = 'field',
  layout = 'content',
  pagination = false,
  onChange,
  onInitialized,
  disabled = false,
  autoFocus = false,
  placeholder,
  required,
  minHeight = 240,
  maxLength = 10000,
  className = '',
}: RichTextEditorProps) {
  const isDocument = variant === 'document'
  const isPagedDocument = isDocument && pagination
  const fill = layout === 'fill'

  const latest = useRef({
    onChange,
    onInitialized,
    maxLength,
  })

  // Un render descartado no debe publicar callbacks nuevos al editor activo.
  useLayoutEffect(() => {
    latest.current = { onChange, onInitialized, maxLength }
  }, [onChange, onInitialized, maxLength])

  const emitted = useRef({ value, format })
  const initialized = useRef(false)
  const [limitReached, setLimitReached] = useState(false)

  const limits = useMemo(
    () =>
      documentLimits({
        maximum: maxLength,
        onLimit: setLimitReached,
      }),
    [maxLength]
  )

  const extensions = useMemo(
    () => [
      ...richTextExtensions(),
      limits,

      ...(isPagedDocument
        ? [
            PaginationPlus.configure({
              pageWidth: PAGE_WIDTH,
              pageHeight: PAGE_HEIGHT,
              marginTop: 88,
              marginBottom: 88,
              marginLeft: 82,
              marginRight: 82,
              contentMarginTop: 0,
              contentMarginBottom: 0,
              pageGap: PAGE_GAP,
              pageGapBorderSize: 0,
              pageGapBorderColor: PAGE_EDGE,
              pageBreakBackground: WORKSPACE_BG,
              footerRight: 'Página {page}',
            }),
            paginationStyleLifecycle(),
          ]
        : []),
    ],
    [limits, isPagedDocument]
  )

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !disabled,
    extensions,

    content:
      format === 'markdown'
        ? value
        : plainTextDocument(value),

    ...(format === 'markdown'
      ? { contentType: 'markdown' as const }
      : {}),

    onCreate: ({ editor: current }) => {
      if (initialized.current) return

      initialized.current = true

      const markdown = current.getMarkdown()

      emitted.current = {
        value: markdown,
        format: 'markdown',
      }

      latest.current.onInitialized?.(markdown)
    },

    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        'aria-required': String(Boolean(required)),
        'aria-describedby': `${id}-help`,

        class: [
          richTextClasses,
          '[&>:first-child]:mt-0',
          '[&>:last-child]:mb-0',
          fill && !isPagedDocument ? 'flex-1' : '',

          isDocument
            ? isPagedDocument
              ? 'focus:outline-none'
              : 'px-5 py-4 sm:px-8 sm:py-6 focus:outline-none'
            : 'px-4 py-3 focus:outline-none',
        ].join(' '),
      },

      handleDrop: (_view, event) =>
        event.dataTransfer?.files.length ? true : false,
    },

    onUpdate: ({ editor: current }) => {
      const next = current.getMarkdown()

      if (
        next === emitted.current.value &&
        emitted.current.format === 'markdown'
      ) {
        return
      }

      emitted.current = {
        value: next,
        format: 'markdown',
      }

      latest.current.onChange(next, 'markdown')
    },
  })

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled, false)
    }
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return

    if (
      value === emitted.current.value &&
      format === emitted.current.format
    ) {
      return
    }

    emitted.current = { value, format }

    editor.commands.setContent(
      format === 'markdown'
        ? value
        : plainTextDocument(value),
      {
        emitUpdate: false,

        ...(format === 'markdown'
          ? { contentType: 'markdown' as const }
          : {}),
      }
    )

    setLimitReached(false)
  }, [editor, value, format])

  useEffect(() => {
    if (editor && autoFocus && !disabled) {
      editor.commands.focus('end')
    }
  }, [editor, autoFocus, disabled])

  const reactiveState = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      toolbarSnapshot(current),
  })

  const state = reactiveState ?? toolbarSnapshot(editor)

  const actions = [
    {
      name: 'Negrita',
      icon: Bold,
      active: state?.bold,
      command: () =>
        editor?.chain().focus().toggleBold().run(),
    },
    {
      name: 'Cursiva',
      icon: Italic,
      active: state?.italic,
      command: () =>
        editor?.chain().focus().toggleItalic().run(),
    },
    {
      name: 'Lista con viñetas',
      icon: List,
      active: state?.bullet,
      command: () =>
        editor?.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'Lista numerada',
      icon: ListOrdered,
      active: state?.ordered,
      command: () =>
        editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'Cita',
      icon: Quote,
      active: state?.quote,
      command: () =>
        editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      name: 'Separador',
      icon: Minus,
      command: () =>
        editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      name: 'Quitar formato',
      icon: RemoveFormatting,
      command: () =>
        editor
          ?.chain()
          .focus()
          .clearNodes()
          .unsetAllMarks()
          .run(),
    },
    {
      name: 'Deshacer',
      icon: Undo2,
      unavailable: !state?.undo,
      command: () =>
        editor?.chain().focus().undo().run(),
    },
    {
      name: 'Rehacer',
      icon: Redo2,
      unavailable: !state?.redo,
      command: () =>
        editor?.chain().focus().redo().run(),
    },
  ]

  return (
    <div
      data-qms-richtext-editor
      data-qms-paginated={
        isPagedDocument ? 'true' : undefined
      }
      className={[
        'min-w-0',
        fill ? 'flex min-h-0 flex-1 flex-col' : '',
        isDocument
          ? 'qms-rich-text-document'
          : 'qms-rich-text-field',
        isPagedDocument
          ? 'qms-rich-text-paginated'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <label
        htmlFor={id}
        className={
          isDocument
            ? 'sr-only'
            : 'mb-2 block text-base font-medium text-qms-dark'
        }
      >
        {label}

        {required &&
          !label.trimEnd().endsWith('*') && (
            <span aria-hidden="true"> *</span>
          )}
      </label>

      <div
        className={[
          isDocument
            ? 'overflow-hidden bg-qms-surface'
            : 'ui-panel overflow-hidden focus-within:border-qms-primary',

          fill
            ? 'flex min-h-0 flex-1 flex-col'
            : '',

          disabled ? 'opacity-70' : '',
        ].filter(Boolean).join(' ')}
      >
        <div
          data-rich-text-toolbar
          role="group"
          aria-label={`Formato de ${label}`}
          className="flex shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-qms-border bg-qms-surface px-2 py-1"
        >
          <Select
            aria-label="Estilo de texto"
            wrapperClassName="mr-1 w-40 shrink-0"
            className="h-9 text-sm"
            value={
              state?.heading
                ? 'h2'
                : state?.subheading
                  ? 'h3'
                  : 'paragraph'
            }
            disabled={disabled || !editor}
            onChange={event => {
              const selected = event.target.value

              if (selected === 'paragraph') {
                editor
                  ?.chain()
                  .focus()
                  .setParagraph()
                  .run()
              } else {
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({
                    level: selected === 'h2' ? 2 : 3,
                  })
                  .run()
              }
            }}
          >
            <option value="paragraph">
              Texto normal
            </option>
            <option value="h2">
              Título
            </option>
            <option value="h3">
              Subtítulo
            </option>
          </Select>

          {actions.map(
            ({
              name,
              icon: Icon,
              active,
              unavailable,
              command,
            }) => (
              <Button
                key={name}
                variant="ghost"
                size="icon"
                aria-label={name}
                title={name}
                aria-pressed={
                  active === undefined
                    ? undefined
                    : Boolean(active)
                }
                disabled={
                  disabled ||
                  !editor ||
                  unavailable
                }
                onMouseDown={event =>
                  event.preventDefault()
                }
                onClick={command}
                className={`h-9 w-9 shrink-0 ${
                  active
                    ? 'bg-qms-primary-soft text-qms-primary'
                    : ''
                }`}
              >
                <Icon
                  size={17}
                  aria-hidden="true"
                />
              </Button>
            )
          )}
        </div>

        <div
          data-rich-text-viewport
          className={[
            'relative',
            fill
              ? 'min-h-0 flex-1 overflow-auto overscroll-contain'
              : '',
            isPagedDocument
              ? 'qms-rich-text-workspace'
              : '',
          ].filter(Boolean).join(' ')}
          style={fill ? undefined : { minHeight }}
        >
          {placeholder &&
            state?.empty &&
            !isPagedDocument && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute text-base leading-relaxed text-qms-muted ${
                  isDocument
                    ? 'left-5 right-5 top-4 sm:left-8 sm:right-8 sm:top-6'
                    : 'left-4 right-4 top-3'
                }`}
              >
                {placeholder}
              </span>
            )}

          {isPagedDocument ? (
            <div className="relative">
              <EditorContent
                editor={editor}
                className="qms-rich-text-content"
                style={
                  fill
                    ? undefined
                    : { minHeight }
                }
              />

              {editor && (
                <BordesDePagina editor={editor} />
              )}
            </div>
          ) : (
            <EditorContent
              editor={editor}
              className={`qms-rich-text-content ${fill ? 'flex min-h-full flex-col' : ''}`}
              style={
                fill
                  ? undefined
                  : { minHeight }
              }
            />
          )}
        </div>
      </div>

      {!isPagedDocument || limitReached ? (
        <p
          id={`${id}-help`}
          role={
            limitReached
              ? 'status'
              : undefined
          }
          className={`mt-1 shrink-0 text-xs ${
            isDocument
              ? 'px-5 py-1 sm:px-8'
              : ''
          } ${
            limitReached
              ? 'text-qms-danger'
              : 'text-qms-muted'
          }`}
        >
          {limitReached
            ? `El contenido admite hasta ${maxLength.toLocaleString('es-CR')} caracteres. Reducí el texto para continuar.`
            : 'Títulos, listas, citas y separadores. Ctrl+Z para deshacer.'}
        </p>
      ) : (
        <p
          id={`${id}-help`}
          className="sr-only"
        >
          Editor de documento con paginación A4.
        </p>
      )}

      {isPagedDocument && (
        <style>{`
          .qms-rich-text-paginated .qms-rich-text-workspace {
            background: ${WORKSPACE_BG};
            padding: 0 24px 24px;
          }

          .qms-rich-text-paginated .qms-rich-text-content {
            min-height: 0 !important;
          }

          .qms-rich-text-paginated .tiptap {
            box-sizing: border-box !important;
            width: ${PAGE_WIDTH}px !important;
            max-width: none !important;
            min-height: ${PAGE_HEIGHT}px;

            margin: 24px auto 40px !important;

            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;

            background: #ffffff !important;

            color: var(--color-qms-dark, #253040);
            font-family: inherit;
            font-size: 16px !important;
            line-height: 1.55 !important;

            outline: 0 !important;
          }

          .qms-rich-text-paginated .tiptap:focus,
          .qms-rich-text-paginated .tiptap:focus-visible {
            outline: 0 !important;
            box-shadow: none !important;
          }

          .qms-rich-text-paginated .tiptap :is(
            p,
            li,
            blockquote
          ) {
            font-size: inherit;
            line-height: 1.55;
          }

          .qms-rich-text-paginated .tiptap p {
            margin-bottom: 10px;
          }

          .qms-rich-text-paginated .tiptap :is(h2, h3) {
            line-height: 1.35;
          }

          .qms-rich-text-paginated .rm-pagination-gap,
          .qms-rich-text-paginated .tiptap-pagination-gap {
            background: ${WORKSPACE_BG} !important;
            border: 0 !important;
            box-shadow: none !important;
            outline: 0 !important;
          }

          .qms-rich-text-paginated .rm-page-break .breaker {
            border: 0 !important;
            box-shadow: none !important;
          }

          .qms-rich-text-paginated .tiptap-page-header,
          .qms-rich-text-paginated .tiptap-page-footer {
            color: var(--color-qms-muted, #64748b);
            font-size: 12px;
          }

          .qms-rich-text-field .tiptap {
            width: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            background-color: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 12px 16px !important;
          }
        `}</style>
      )}
    </div>
  )
}

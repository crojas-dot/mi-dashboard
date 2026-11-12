'use client'

import { preconnect } from 'react-dom'
import { File, FileImage, FileSpreadsheet, FileText, Eye, Download, Trash2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatBytes } from '@/lib/utils/format'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

interface ListaAdjuntosProps {
  adjuntos: QuejaAdjunto[]
  onPreview: (a: QuejaAdjunto) => void
  onDownload: (a: QuejaAdjunto) => void
  puedeEliminar?: (a: QuejaAdjunto) => boolean
  onEliminar?: (a: QuejaAdjunto) => void
  layout?: 'list' | 'cards' | 'rows'
}

function filePresentation(adjunto: QuejaAdjunto) {
  const extension = adjunto.nombre.split('.').pop()?.toLowerCase() ?? ''
  const mime = (adjunto.tipo_mime ?? '').toLowerCase()
  if (mime === 'application/pdf' || extension === 'pdf') {
    return { Icon: FileText, label: 'PDF', color: 'bg-soft-red-bg text-qms-danger' }
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    const label = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension) ? extension.toUpperCase() : 'Imagen'
    return { Icon: FileImage, label, color: 'bg-soft-purple-bg text-qms-purple' }
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)) {
    return { Icon: FileSpreadsheet, label: extension === 'csv' ? 'CSV' : 'Excel', color: 'bg-soft-green-bg text-qms-success' }
  }
  if (mime.includes('word') || ['doc', 'docx', 'txt', 'odt'].includes(extension)) {
    return { Icon: FileText, label: extension === 'txt' ? 'TXT' : 'Documento', color: 'bg-qms-primary-soft text-qms-primary' }
  }
  return { Icon: File, label: 'Archivo', color: 'bg-qms-hover-bg text-qms-muted' }
}

export default function ListaAdjuntos({
  adjuntos,
  onPreview,
  onDownload,
  puedeEliminar,
  onEliminar,
  layout = 'list',
}: ListaAdjuntosProps) {
  const cliente = adjuntos.filter((a) => !a.usuario_id)
  const analisis = adjuntos.filter((a) => a.usuario_id)

  const renderGrupo = (lista: QuejaAdjunto[], esAnalisis: boolean, titulo: string) => {
    if (lista.length === 0) return null
    return (
      <div className="mt-3">
        <p className="mb-2 text-xs font-medium tracking-wide text-qms-muted uppercase">{titulo}</p>
        <ul className={layout === 'cards' ? 'flex flex-wrap gap-2' : layout === 'rows' ? 'divide-y divide-qms-border overflow-hidden rounded-card border border-qms-border bg-qms-surface' : 'space-y-1'}>
          {lista.map((a) => {
            const { Icon, label, color } = filePresentation(a)
            const preparePreviewConnection = () => {
              // Anticipar solo la conexión al origen: no descarga archivos ni guarda permisos.
              if (!a.storage_path.includes('/')) preconnect('https://drive.google.com')
            }
            const previewIntent = {
              onPointerEnter: preparePreviewConnection,
              onFocus: preparePreviewConnection,
              onPointerDown: preparePreviewConnection,
            }
            return layout === 'cards' ? (
              <li key={a.id} className="group w-full min-w-0 max-w-64 rounded-card bg-qms-hover-bg transition-colors hover:bg-qms-primary-soft focus-within:bg-qms-primary-soft">
                {/* Solo metadatos e iconos estáticos: listar archivos no descarga vistas previas. */}
                <button
                  {...previewIntent}
                  type="button"
                  onClick={() => onPreview(a)}
                  className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-card px-3 pt-3 pb-1 text-left"
                  title={a.nombre}
                  aria-label={`Vista previa de ${a.nombre}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-button ${color}`} aria-hidden="true">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-qms-dark">{a.nombre}</span>
                    <span className="block truncate text-xs text-qms-muted">{label} · {formatBytes(a.tamano)}</span>
                  </span>
                </button>
                <div className="flex items-center justify-end gap-0.5 px-2 pb-1">
                  <Button {...previewIntent} size="icon" variant="ghost" onClick={() => onPreview(a)} title="Vista previa" aria-label={`Vista previa de ${a.nombre}`}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDownload(a)} title="Descargar" aria-label={`Descargar ${a.nombre}`}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {onEliminar && puedeEliminar?.(a) && (
                    <Button size="icon" variant="ghost" onClick={() => onEliminar(a)} title="Eliminar adjunto" aria-label={`Eliminar ${a.nombre}`} className="text-qms-danger">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ) : layout === 'rows' ? (
              <li key={a.id} data-attachment-row className="flex min-w-0 items-start gap-3 px-3 py-3 transition-colors hover:bg-qms-hover-bg">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-button ${color}`} aria-hidden="true">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <button {...previewIntent} type="button" onClick={() => onPreview(a)}
                    title={a.nombre} aria-label={`Vista previa de ${a.nombre}`}
                    className="block w-full cursor-pointer text-left text-sm font-medium leading-relaxed text-qms-dark hover:text-qms-primary hover:underline break-words [overflow-wrap:anywhere]">
                    {a.nombre}
                  </button>
                  <p className="mt-1 text-xs text-qms-muted">{label} · {formatBytes(a.tamano)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button {...previewIntent} size="icon" variant="ghost" onClick={() => onPreview(a)} title="Vista previa" aria-label={`Vista previa de ${a.nombre}`}><Eye className="size-4" aria-hidden="true" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDownload(a)} title="Descargar" aria-label={`Descargar ${a.nombre}`}><Download className="size-4" aria-hidden="true" /></Button>
                  {onEliminar && puedeEliminar?.(a) && <Button size="icon" variant="ghost" onClick={() => onEliminar(a)} title="Eliminar adjunto" aria-label={`Eliminar ${a.nombre}`} className="text-qms-danger"><Trash2 className="size-4" aria-hidden="true" /></Button>}
                </div>
              </li>
            ) : (
              <li key={a.id} className="flex select-text items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <FileText className={`h-4 w-4 shrink-0 ${esAnalisis ? 'text-blue-500' : 'text-gray-400'}`} />
              <button
                {...previewIntent}
                type="button"
                onClick={() => onPreview(a)}
                className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-gray-700 hover:text-qms-primary-hover hover:underline"
                title="Vista previa"
              >
                {a.nombre}
              </button>
              {esAnalisis && <Badge variant="blue">Análisis</Badge>}
              <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{formatBytes(a.tamano)}</span>
              <button {...previewIntent} type="button" onClick={() => onPreview(a)} className="shrink-0 cursor-pointer text-gray-500 hover:text-qms-primary" title="Vista previa">
                <Eye className="h-4 w-4" />
              </button>
              <span className="hidden whitespace-nowrap text-xs text-gray-400 sm:inline">
                {new Date(a.created_at).toLocaleDateString('es-ES')}
              </span>
              <button type="button" onClick={() => onDownload(a)} className="shrink-0 cursor-pointer text-gray-500 hover:text-qms-primary" title="Descargar">
                <Download className="h-4 w-4" />
              </button>
              {onEliminar && puedeEliminar?.(a) && (
                <button type="button" onClick={() => onEliminar(a)} className="shrink-0 text-gray-400 hover:text-red-600" title="Eliminar adjunto">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <>
      {renderGrupo(cliente, false, 'Evidencias del cliente')}
      {renderGrupo(analisis, true, 'Evidencias de análisis')}
    </>
  )
}

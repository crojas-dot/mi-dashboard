'use client'

import { FileText, Eye, Download, Trash2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { formatBytes } from '@/lib/utils/format'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

interface ListaAdjuntosProps {
  adjuntos: QuejaAdjunto[]
  onPreview: (a: QuejaAdjunto) => void
  onDownload: (a: QuejaAdjunto) => void
  puedeEliminar?: (a: QuejaAdjunto) => boolean
  onEliminar?: (a: QuejaAdjunto) => void
}

export default function ListaAdjuntos({
  adjuntos,
  onPreview,
  onDownload,
  puedeEliminar,
  onEliminar,
}: ListaAdjuntosProps) {
  const cliente = adjuntos.filter((a) => !a.usuario_id)
  const analisis = adjuntos.filter((a) => a.usuario_id)

  const renderGrupo = (lista: QuejaAdjunto[], esAnalisis: boolean, titulo: string) => {
    if (lista.length === 0) return null
    return (
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{titulo}</p>
        <ul className="space-y-1">
          {lista.map((a) => (
            <li key={a.id} className="flex select-text items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <FileText className={`h-4 w-4 shrink-0 ${esAnalisis ? 'text-blue-500' : 'text-gray-400'}`} />
              <button
                type="button"
                onClick={() => onPreview(a)}
                className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-gray-700 hover:text-blue-700 hover:underline"
                title="Vista previa"
              >
                {a.nombre}
              </button>
              {esAnalisis && <Badge variant="blue">Análisis</Badge>}
              <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{formatBytes(a.tamano)}</span>
              <button type="button" onClick={() => onPreview(a)} className="shrink-0 cursor-pointer text-gray-500 hover:text-blue-600" title="Vista previa">
                <Eye className="h-4 w-4" />
              </button>
              <span className="hidden whitespace-nowrap text-xs text-gray-400 sm:inline">
                {new Date(a.created_at).toLocaleDateString('es-ES')}
              </span>
              <button type="button" onClick={() => onDownload(a)} className="shrink-0 cursor-pointer text-gray-500 hover:text-blue-600" title="Descargar">
                <Download className="h-4 w-4" />
              </button>
              {onEliminar && puedeEliminar?.(a) && (
                <button type="button" onClick={() => onEliminar(a)} className="shrink-0 text-gray-400 hover:text-red-600" title="Eliminar adjunto">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
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

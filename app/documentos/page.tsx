'use client'

import { useState } from 'react'
import { Plus, FileText, BookOpen, History, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDocumentos, documentosKey, type Documento } from '@/lib/queries/useDocumentos'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import NuevoDocumentoModal from './components/NuevoDocumentoModal'

const estadoVariant: Record<string, string> = { Borrador: 'gray', Publicado: 'green', Archivado: 'red', 'En Revisión': 'amber' }

export default function DocumentosPage() {
  const { data: documentos = [], isLoading: loading } = useDocumentos()
  const queryClient = useQueryClient()
  const invalidateDocumentos = () => queryClient.invalidateQueries({ queryKey: documentosKey })
  const [tab, setTab] = useState<'todos' | 'maestra' | 'edicion'>('todos')
  const [historialOpen, setHistorialOpen] = useState<Documento | null>(null)
  const [editVersion, setEditVersion] = useState('')
  const [nuevoOpen, setNuevoOpen] = useState(false)

  const publicados = documentos.filter((d) => d.estado === 'Publicado')
  const borradores = documentos.filter((d) => d.estado === 'Borrador')
  const display = tab === 'maestra' ? publicados : tab === 'edicion' ? borradores : documentos

  const handleSaveVersion = async () => {
    if (!historialOpen || !editVersion) return
    await supabase.from('documentos').update({ version_actual: editVersion }).eq('id', historialOpen.id)
    setHistorialOpen(null)
    setEditVersion('')
    invalidateDocumentos()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documentos" description="Gestión documental del SGC">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nuevo Documento</Button>
      </PageHeader>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {(['todos', 'maestra', 'edicion'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'}`}>
            {t === 'todos' && <FileText className="h-4 w-4" />}
            {t === 'maestra' && <BookOpen className="h-4 w-4" />}
            {t === 'edicion' && <History className="h-4 w-4" />}
            {t === 'todos' ? 'Todos' : t === 'maestra' ? 'Lista Maestra' : 'Edición Viva'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Código</TableHeaderCell>
            <TableHeaderCell>Título</TableHeaderCell>
            <TableHeaderCell>Versión</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Fecha Publicación</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {display.length === 0 ? <EmptyState message="No hay documentos en esta categoría" /> : (
            display.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell><span className="font-mono text-xs">{doc.codigo_doc}</span></TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">{doc.titulo}</TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">v{doc.version_actual}</TableCell>
                <TableCell><Badge variant={estadoVariant[doc.estado] || 'gray'}>{doc.estado}</Badge></TableCell>
                <TableCell className="text-gray-500">{doc.fecha_publicacion ? new Date(doc.fecha_publicacion).toLocaleDateString('es-ES') : '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {doc.estado === 'Borrador' && (
                      <Button size="sm" variant="secondary" onClick={() => setHistorialOpen(doc)}>Editar</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setHistorialOpen(doc)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevoDocumentoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateDocumentos() }} />

      <Modal open={!!historialOpen} onClose={() => setHistorialOpen(null)} title={`Historial - ${historialOpen?.codigo_doc}`} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Versión actual: v{historialOpen?.version_actual}</p>
          <div className="flex items-center gap-3">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="Nueva versión (ej: 2.1)"
              value={editVersion}
              onChange={(e) => setEditVersion(e.target.value)}
            />
            <Button size="sm" onClick={handleSaveVersion}>Guardar</Button>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
            Historial de cambios se mostrará aquí
          </div>
        </div>
      </Modal>
    </div>
  )
}

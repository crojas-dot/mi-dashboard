import { useEffect, useRef } from 'react'
import { ChevronRight, MoreVertical, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'
import type { QuejaActividad } from '@/lib/queries/useQuejaActividad'

interface NotasProps {
  notas: QuejaActividad[]
  loading: boolean
  error: boolean
}

export function QuejaNotasCard({ notas, loading, error, onOpen }: NotasProps & { onOpen: () => void }) {
  const ultima = notas.at(-1)
  return <button type="button" data-investigation-notes-card aria-label="Ver notas de investigación" onClick={onOpen} className="w-full min-w-0 cursor-pointer rounded-card border border-qms-border bg-qms-surface p-4 text-left shadow-sm transition-colors hover:bg-qms-hover-bg">
    <span className="flex items-start gap-2"><NotebookPen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-purple" /><span className="min-w-0 flex-1 text-sm font-semibold">Notas de investigación</span>{!loading && !error && <span className="rounded-button bg-soft-purple-bg px-1.5 py-0.5 text-xs font-medium text-qms-purple">{notas.length}</span>}</span>
    <span className="mt-3 block text-xs leading-relaxed text-qms-muted">{loading ? 'Cargando notas…' : error ? 'No se pudieron cargar las notas.' : ultima ? <>Última nota: <time dateTime={ultima.created_at}>{caseDate(ultima.created_at)}</time></> : 'Sin notas todavía'}</span>
    <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-qms-primary">Ver notas<ChevronRight aria-hidden="true" className="size-4 shrink-0" /></span>
  </button>
}

interface Props extends NotasProps {
  open: boolean
  folio: string
  onClose: () => void
  onRetry: () => void
  canEdit: boolean
  nota: string
  maxLength: number
  saving: boolean
  onChange: (nota: string) => void
  onAdd: () => void
  /** Solo las notas propias de esta investigación admiten edición o borrado. */
  puedeModificar: (nota: QuejaActividad) => boolean
  menuId: string | null
  editingId: string | null
  editValue: string
  deletingId: string | null
  operating: boolean
  onToggleMenu: (id: string) => void
  onEdit: (nota: QuejaActividad) => void
  onEditChange: (value: string) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onRequestDelete: (id: string) => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

// La consulta y el borrador pertenecen a la visita del expediente, no al panel.
export default function QuejaNotasPanel(props: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { menuId, onToggleMenu } = props
  // El menú de una nota se cierra al pulsar fuera, igual que los demás popovers.
  useEffect(() => {
    if (!menuId) return
    const outside = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      onToggleMenu(menuId)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [menuId, onToggleMenu])
  return <Modal open={props.open} onClose={props.onClose} title={`Notas de investigación · ${props.folio}`} variant="dialog" size="lg" fixedHeight
    footer={props.canEdit && <div className="min-w-0">
      <label htmlFor="investigation-note" className="mb-2 block text-sm font-medium">Nueva nota</label>
      <div className="relative">
        <textarea id="investigation-note" aria-label="Nueva nota de investigación" rows={2} maxLength={props.maxLength} placeholder="Registrá un avance o comentario de tu investigación..." className="ui-textarea w-full resize-none px-3 py-2 pr-14 text-sm" value={props.nota} disabled={props.saving} onChange={event => props.onChange(event.target.value)} />
        <Button size="icon" aria-label="Agregar nota" title="Agregar nota" className="absolute right-2 bottom-2 size-9!" onClick={props.onAdd} disabled={!props.nota.trim() || props.saving} loading={props.saving}><Plus aria-hidden="true" className="size-4" /></Button>
      </div>
    </div>}>
    <div data-investigation-notes-scroll role="region" aria-label="Lista de notas de investigación" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
    {props.loading ? <LoadingSkeleton variant="list" label="Cargando notas…" framed={false} /> : props.error ? <div role="alert"><p className="text-sm text-qms-muted">No se pudieron cargar las notas.</p><Button size="sm" variant="ghost" onClick={props.onRetry}>Reintentar notas</Button></div> : props.notas.length ? <ol className="space-y-3">{props.notas.map(item => {
      const editable = props.puedeModificar(item)
      const editing = props.editingId === item.id
      return <li key={item.id} data-investigation-note className="rounded-card border border-qms-border bg-qms-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <time className="text-xs text-qms-muted" dateTime={item.created_at}>{caseDate(item.created_at)}</time>
          {editable && !editing && <div ref={props.menuId === item.id ? menuRef : undefined} className="relative -mt-1 -mr-1">
            <Button size="icon" variant="ghost" aria-label="Opciones de la nota" title="Opciones de la nota" aria-haspopup="menu" aria-expanded={props.menuId === item.id} onClick={() => props.onToggleMenu(item.id)}><MoreVertical aria-hidden="true" className="size-4" /></Button>
            {props.menuId === item.id && <div role="menu" aria-label="Opciones de la nota" className="absolute top-9 right-0 z-10 w-44 rounded-card border border-qms-border bg-qms-surface p-1 shadow-lg" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.onToggleMenu(item.id) } }}>
              {props.deletingId === item.id
                ? <><p className="px-2 py-1 text-xs text-qms-muted">¿Eliminar esta nota?</p><Button role="menuitem" size="sm" variant="danger" className="w-full justify-start" loading={props.operating} onClick={props.onConfirmDelete}><Trash2 aria-hidden="true" className="size-4" />Eliminar</Button><Button role="menuitem" size="sm" variant="ghost" className="mt-1 w-full justify-start" disabled={props.operating} onClick={props.onCancelDelete}>Cancelar</Button></>
                : <><Button role="menuitem" size="sm" variant="ghost" className="w-full justify-start" onClick={() => props.onEdit(item)}><Pencil aria-hidden="true" className="size-4" />Editar</Button><Button role="menuitem" size="sm" variant="ghost" className="mt-1 w-full justify-start text-qms-danger" onClick={() => props.onRequestDelete(item.id)}><Trash2 aria-hidden="true" className="size-4" />Eliminar</Button></>}
            </div>}
          </div>}
        </div>
        {editing ? <div className="mt-2">
          <textarea aria-label="Editar nota de investigación" rows={4} maxLength={props.maxLength} className="ui-textarea w-full px-3 py-2 text-sm" value={props.editValue} disabled={props.operating} onChange={event => props.onEditChange(event.target.value)} />
          <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={props.onCancelEdit} disabled={props.operating}>Cancelar</Button><Button size="sm" onClick={props.onSaveEdit} loading={props.operating} disabled={!props.editValue.trim()}>Guardar cambios</Button></div>
        </div> : <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.descripcion}</p>}
      </li>
    })}</ol> : <p className="text-sm text-qms-muted">Sin notas todavía</p>}
    </div>
  </Modal>
}

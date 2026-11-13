import { useEffect, useRef } from 'react'
import { ChevronRight, LoaderCircle, MoreVertical, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
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
  return <button type="button" data-investigation-notes-card aria-label="Ver mis notas" onClick={onOpen} className="w-full min-w-0 cursor-pointer rounded-card border border-qms-border bg-qms-surface p-4 text-left shadow-sm transition-colors hover:bg-qms-hover-bg">
    <span className="flex items-start gap-2"><NotebookPen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-purple" /><span className="min-w-0 flex-1 text-sm font-semibold">Mis notas</span>{!loading && !error && <span className="rounded-button bg-soft-purple-bg px-1.5 py-0.5 text-xs font-medium text-qms-purple">{notas.length}</span>}</span>
    <span className="mt-3 block text-xs leading-relaxed text-qms-muted">{loading ? 'Cargando notas…' : error ? 'No se pudieron cargar las notas.' : ultima ? <>Última nota: <time dateTime={ultima.created_at}>{caseDate(ultima.created_at)}</time></> : 'Sin notas todavía'}</span>
    <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-qms-primary">Ver mis notas<ChevronRight aria-hidden="true" className="size-4 shrink-0" /></span>
  </button>
}

interface Props extends NotasProps {
  open: boolean
  folio: string
  currentUser?: { id: string; nombre: string }
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
  return <Modal open={props.open} onClose={props.onClose} title="Mis notas" titleSuffix={props.folio} variant="dialog" size="lg" fixedHeight headerLeading={<NotebookPen aria-hidden="true" className="size-4 text-qms-muted" />}
    footer={props.canEdit && <div className="relative min-w-0">
      <textarea id="investigation-note" aria-label="Nueva nota de investigación" rows={2} maxLength={props.maxLength} placeholder="Registrá un avance o comentario de tu investigación..." className="ui-textarea block h-24! min-h-0! w-full resize-none rounded-card border-qms-border bg-qms-surface p-3 pr-14 text-sm shadow-sm focus:border-qms-primary focus:outline-none focus:ring-1 focus:ring-qms-primary" value={props.nota} disabled={props.saving} onChange={event => props.onChange(event.target.value)} />
      <button type="button" aria-label="Agregar nota" title="Agregar nota" aria-busy={props.saving} onClick={props.onAdd} disabled={!props.nota.trim() || props.saving} className="absolute right-3 bottom-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-button border border-qms-primary bg-qms-primary text-white shadow-sm transition-colors hover:border-qms-primary-hover hover:bg-qms-primary-hover disabled:cursor-not-allowed disabled:opacity-65">
        {props.saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
      </button>
    </div>}>
    <div data-investigation-notes-scroll role="region" aria-label="Lista de notas de investigación" tabIndex={0} className="qms-compact-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
    {props.loading ? <LoadingSkeleton variant="list" label="Cargando notas…" framed={false} /> : props.error ? <div role="alert"><p className="text-sm text-qms-muted">No se pudieron cargar las notas.</p><Button size="sm" variant="ghost" onClick={props.onRetry}>Reintentar notas</Button></div> : props.notas.length ? <ol className="space-y-3">{props.notas.map(item => {
      const editable = props.puedeModificar(item)
      const editing = props.editingId === item.id
      const propia = !!item.usuario_id && item.usuario_id === props.currentUser?.id
      return <li key={item.id} data-investigation-note className="rounded-card border border-qms-border bg-qms-surface p-4 shadow-sm">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <time className="min-w-0 text-xs text-qms-muted" dateTime={item.created_at}>{caseDate(item.created_at)}</time>
          {propia && !editing && <div ref={props.menuId === item.id ? menuRef : undefined} className="relative -mr-1">
            <button type="button" aria-label="Opciones de la nota" title="Opciones de la nota" aria-haspopup="menu" aria-expanded={props.menuId === item.id} onClick={() => props.onToggleMenu(item.id)}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-button text-qms-muted transition-colors hover:bg-qms-hover-bg hover:text-qms-dark focus-visible:outline-2 focus-visible:outline-qms-primary">
              <MoreVertical aria-hidden="true" className="size-5" />
            </button>
            {props.menuId === item.id && <div role="menu" aria-label="Opciones de la nota" className="absolute right-0 bottom-full z-30 mb-1 w-52 rounded-card border border-qms-border bg-qms-surface p-2 shadow-lg" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.onToggleMenu(item.id) } }}>
              {!editable && <p className="mb-2 border-b border-qms-border px-2 pb-2 text-xs leading-relaxed text-qms-muted">Podés editar o eliminar tus notas mientras el caso esté En Investigación.</p>}
              {editable && props.deletingId === item.id
                ? <><p className="px-2 py-1 text-xs text-qms-muted">¿Eliminar esta nota?</p><Button role="menuitem" size="sm" variant="danger" className="w-full justify-start" loading={props.operating} onClick={props.onConfirmDelete}><Trash2 aria-hidden="true" className="size-4" />Eliminar</Button><Button role="menuitem" size="sm" variant="ghost" className="mt-1 w-full justify-start" disabled={props.operating} onClick={props.onCancelDelete}>Cancelar</Button></>
                : <><Button role="menuitem" size="sm" variant="ghost" className="w-full justify-start" disabled={!editable || props.operating} onClick={() => props.onEdit(item)}><Pencil aria-hidden="true" className="size-4" />Editar</Button><Button role="menuitem" size="sm" variant="ghost" className="mt-1 w-full justify-start text-qms-danger" disabled={!editable || props.operating} onClick={() => props.onRequestDelete(item.id)}><Trash2 aria-hidden="true" className="size-4" />Eliminar</Button></>}
            </div>}
          </div>}
        </div>
        {editing ? <div className="mt-2">
          <textarea aria-label="Editar nota de investigación" rows={4} maxLength={props.maxLength} className="ui-textarea w-full px-3 py-2 text-sm" value={props.editValue} disabled={props.operating} onChange={event => props.onEditChange(event.target.value)} />
          <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={props.onCancelEdit} disabled={props.operating}>Cancelar</Button><Button size="sm" onClick={props.onSaveEdit} loading={props.operating} disabled={!props.editValue.trim()}>Guardar cambios</Button></div>
        </div> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.descripcion}</p>}
      </li>
    })}</ol> : <p className="text-sm text-qms-muted">Sin notas todavía</p>}
    </div>
  </Modal>
}

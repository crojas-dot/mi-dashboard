'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Settings2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import AreaCatalogoPicker from '@/app/quejas/components/AreaCatalogoPicker'
import { useAuthStore } from '@/lib/store/auth-store'
import { useCatalogos, useCatalogoTipo, catalogosKey, catalogoTipoKey, type CatalogoValor } from '@/lib/queries/useCatalogos'
import { guardarAreaQueja } from '@/lib/services/quejaWorkflowService'
import { actualizarAreaCatalogo } from '@/lib/services/quejaAreaCatalogService'
import { REGISTRO_QUEJA_LIMITES } from '@/lib/constants/quejas'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { showError } from '@/lib/services/errorToast'

const normalizar = (value: string) => value.trim().toLocaleLowerCase('es')

export default function AreaQuejaCatalogo({ quejaId, disabled = false, onPendingChange }: { quejaId: string; disabled?: boolean; onPendingChange?: (busy: boolean) => void }) {
  const role = useAuthStore(state => state.user?.rol)
  const [open, setOpen] = useState(false)
  if (role !== 'admin' && role !== 'calidad') return null
  return <div className="@container w-full max-w-md">
    <Button size="sm" variant="ghost" disabled={disabled} aria-expanded={open} onClick={() => setOpen(value => !value)} className="gap-2 text-qms-muted"><Settings2 aria-hidden="true" className="size-4" />Catálogo de áreas<ChevronDown aria-hidden="true" className={`size-3.5 ${open ? 'rotate-180' : ''}`} /></Button>
    {open && <AreaQuejaCatalogEditor quejaId={quejaId} canManage={role === 'admin'} disabled={disabled} onPendingChange={onPendingChange} />}
  </div>
}

/** El catálogo nunca asigna áreas al expediente ni reescribe sus valores históricos. */
export function AreaQuejaCatalogEditor({ quejaId, canManage, disabled, onPendingChange }: { quejaId: string; canManage: boolean; disabled: boolean; onPendingChange?: (busy: boolean) => void }) {
  const role = useAuthStore(state => state.user?.rol)
  const allowed = role === 'admin' || role === 'calidad'
  const admin = canManage && role === 'admin'
  const all = useCatalogos(admin)
  const active = useCatalogoTipo('area_afectada', 'quejas')
  const rows = (all.data ?? []).filter(row => row.modulo === 'quejas' && row.tipo === 'area_afectada')
  const visibleRows = admin ? rows.map(row => ({ row, valor: row.valor })) : (active.data ?? []).map(item => ({ row: null, valor: item.valor }))
  const client = useQueryClient()
  const scope = useEntityRequestGuard(quejaId)
  const [editor, setEditor] = useState<{ row: CatalogoValor | null; value: string } | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [confirm, setConfirm] = useState<CatalogoValor | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [visit, setVisit] = useState({ quejaId, role })
  const loading = admin ? all.isLoading : active.isLoading
  const error = admin ? all.error : active.error
  const unavailable = disabled || loading || !!error
  const blocked = unavailable || busy || !!editor || !!confirm
  const selected = visibleRows.find(item => (item.row?.id ?? item.valor) === selectedKey)
  // Una visita nueva no hereda el editor o el bloqueo de una operación anterior.
  // La operación enviada conserva su efecto remoto, pero su respuesta no edita otra visita.
  if (visit.quejaId !== quejaId || visit.role !== role) {
    setVisit({ quejaId, role }); setSelectedKey(''); setEditor(null); setConfirm(null); setBusy(false); setStatus('')
  }
  useEffect(() => { onPendingChange?.(busy); return () => onPendingChange?.(false) }, [busy, onPendingChange])

  const save = async (row: CatalogoValor | null, change: { valor?: string; activo?: boolean }) => {
    if (!allowed || unavailable || busy || (row && !admin)) return
    const value = change.valor?.trim()
    if (value !== undefined && (!value || value.length > REGISTRO_QUEJA_LIMITES.area)) { showError(null, 'Escribí un área de hasta 150 caracteres.'); return }
    const duplicate = value !== undefined && (admin ? rows.filter(item => item.id !== row?.id) : active.data ?? []).some(item => normalizar(item.valor) === normalizar(value))
    if (duplicate) { showError(null, 'Ya existe un área con ese nombre. Podés seleccionarla o restaurarla.'); return }
    const operation = scope.start('area-catalog')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setBusy(true); setStatus('')
    let confirmed = false
    try {
      const saved = row ? (await actualizarAreaCatalogo(row, change), { valor: value ?? row.valor }) : await guardarAreaQueja(value ?? '')
      confirmed = true
      if (isContextCurrent()) {
        // Retirar lecturas anteriores antes de publicar la lista confirmada evita
        // que una respuesta vieja reemplace las opciones recién guardadas.
        await client.cancelQueries({ queryKey: catalogosKey })
        if (isContextCurrent()) {
          const activeKey = catalogoTipoKey('area_afectada', 'quejas')
          client.setQueryData<{ valor: string; color: string }[]>(activeKey, previous => {
            const list = (previous ?? []).filter(item => !row || item.valor !== row.valor)
            const enabled = change.activo ?? row?.activo !== false
            return !enabled || list.some(item => normalizar(item.valor) === normalizar(saved.valor)) ? list : [...list, { valor: saved.valor, color: row?.color ?? '' }]
          })
          if (row) client.setQueryData<CatalogoValor[]>(catalogosKey, previous => previous?.map(item => item.id === row.id ? { ...item, ...change, ...(value !== undefined ? { valor: value } : {}) } : item))
        }
      }
      if (operation.isCurrent() && isContextCurrent()) { setEditor(null); setConfirm(null); setStatus(change.activo === false ? 'Área eliminada de la lista. Los expedientes anteriores se conservan.' : change.activo === true ? 'Área restaurada en la lista.' : 'Catálogo guardado. Seleccioná el área en el documento cuando corresponda.') }
      if (isContextCurrent()) await client.invalidateQueries({ queryKey: catalogosKey })
    } catch (cause) {
      if (operation.isCurrent() && isContextCurrent()) showError(cause, confirmed ? 'El área se guardó, pero no se pudo actualizar la lista. Volvé a abrir el catálogo.' : 'No se pudo guardar el catálogo de áreas')
    } finally {
      if (operation.isCurrent()) setBusy(false)
      operation.finish()
    }
  }

  if (!allowed) return null
  return <section aria-label="Administrar catálogo de áreas" className="mt-1 space-y-2 border-t border-qms-border pt-2">
    <div className="flex min-w-0 items-end gap-2">
      <div className="min-w-0 flex-1"><Field id={`area-catalog-select-${quejaId}`} label="Área del catálogo"><AreaCatalogoPicker key={`${quejaId}:${role}`} id={`area-catalog-select-${quejaId}`} rows={visibleRows} value={selected ? selectedKey : ''} disabled={blocked || !visibleRows.length} loading={loading} canManage={admin}
        onChange={key => { if (!blocked) { setSelectedKey(key); setStatus('') } }}
        onEdit={row => { if (admin && !blocked) { setEditor({ row, value: row.valor }); setStatus('') } }}
        onRemove={row => { if (admin && !blocked) { setConfirm(row); setStatus('') } }}
        onRestore={row => { if (admin && !blocked) void save(row, { activo: true }) }}
      /></Field></div>
      <Button size="sm" variant="link" className="shrink-0" disabled={unavailable || busy || !!editor || !!confirm} onClick={() => { if (!unavailable && !busy && !confirm) { setEditor({ row: null, value: '' }); setStatus('') } }}><Plus aria-hidden="true" className="size-3.5" />Añadir área</Button>
    </div>
    {editor && <form onSubmit={event => { event.preventDefault(); void save(editor.row, { valor: editor.value }) }} className="grid items-end gap-2 @min-[400px]:grid-cols-[minmax(0,1fr)_auto]">
      <Field id={`area-catalog-name-${quejaId}`} label={editor.row ? 'Nombre del área' : 'Nueva área'}><Input id={`area-catalog-name-${quejaId}`} maxLength={REGISTRO_QUEJA_LIMITES.area} autoComplete="off" autoFocus required disabled={unavailable || busy} value={editor.value} onChange={event => setEditor({ ...editor, value: event.target.value })} /></Field>
      <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button size="sm" type="submit" loading={busy} disabled={unavailable || !editor.value.trim()}>{editor.row ? 'Guardar nombre' : 'Añadir'}</Button></div>
    </form>}
    {error && <div role="alert" className="text-sm"><p>No se pudo cargar el catálogo.</p><Button size="sm" variant="link" onClick={() => void (admin ? all : active).refetch()}>Reintentar</Button></div>}
    {!loading && !error && !visibleRows.length && <p className="text-sm text-qms-muted">Todavía no hay áreas guardadas.</p>}
    {confirm && <div className="space-y-2 border-t border-qms-border pt-2"><p className="text-sm">¿Eliminar «{confirm.valor}» de la lista? Los expedientes que ya usan esta área se conservan. Podrás restaurarla después.</p><div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</Button><Button size="sm" variant="danger" loading={busy} disabled={unavailable} onClick={() => void save(confirm, { activo: false })}>Eliminar área</Button></div></div>}
    {status && <p role="status" className="text-xs text-qms-muted">{status}</p>}
  </section>
}

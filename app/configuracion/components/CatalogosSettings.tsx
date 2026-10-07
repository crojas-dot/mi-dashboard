'use client'

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import { useCatalogos, catalogosKey, type CatalogoValor } from '@/lib/queries/useCatalogos'
import { guardarValorCatalogo, eliminarValorCatalogo } from '@/lib/services/configuracionService'
import { presentarNombre } from '@/lib/utils/configuracion'
import { showError, showSuccess } from '@/lib/services/errorToast'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import ErrorState from '@/components/ui/ErrorState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

const modulos = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'general']
const colores = { blue: 'Azul', green: 'Verde', amber: 'Ámbar', orange: 'Naranja', red: 'Rojo', purple: 'Morado', gray: 'Gris' }

export default function CatalogosSettings({ active }: { active: boolean }) {
  const query = useCatalogos(active)
  const catalogos = query.data ?? []
  const client = useQueryClient()
  const [modulo, setModulo] = useState('quejas')
  const [tipo, setTipo] = useState('')
  const [editor, setEditor] = useState<Partial<CatalogoValor> | null>(null)
  const [eliminar, setEliminar] = useState<CatalogoValor | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  // La administración incluye tipos inactivos para poder reactivarlos.
  const tipos = [...new Set(catalogos.filter(c => c.modulo === modulo).map(c => c.tipo))].sort()
  const actual = tipos.includes(tipo) ? tipo : tipos[0] ?? ''
  const filas = catalogos.filter(c => c.modulo === modulo && c.tipo === actual)

  const ejecutar = async (borrar: boolean) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (borrar && eliminar) await eliminarValorCatalogo(eliminar.id)
      else if (editor) await guardarValorCatalogo(editor)
      else return
      showSuccess(borrar ? 'Valor eliminado' : 'Catálogo guardado')
      setEditor(null)
      setEliminar(null)
      await client.invalidateQueries({ queryKey: catalogosKey })
    } catch (error) { showError(error as Error, 'No se pudo actualizar el catálogo') }
    finally { savingRef.current = false; setSaving(false) }
  }

  if (query.isPending) return <LoadingSkeleton label="Cargando catálogos…" />
  if (query.error) return <ErrorState onRetry={() => void query.refetch()} />

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
      <Field id="catalogo-modulo" label="Módulo">
        <Select id="catalogo-modulo" value={modulo} disabled={!!editor || saving} onChange={event => { setModulo(event.target.value); setTipo('') }}>
          {modulos.map(m => <option key={m} value={m}>{presentarNombre(m)}</option>)}
        </Select>
      </Field>
      <Field id="catalogo-tipo" label="Catálogo">
        <Select id="catalogo-tipo" value={actual} disabled={!!editor || saving} onChange={event => setTipo(event.target.value)}>
          {!tipos.length && <option value="">Sin catálogos disponibles</option>}
          {tipos.map(t => <option key={t} value={t}>{presentarNombre(t)}</option>)}
        </Select>
      </Field>
      <Button disabled={!actual || !!editor || saving} onClick={() => setEditor({ modulo, tipo: actual, valor: '', color: 'gray', orden: 0, activo: true })}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar valor</Button>
    </div>

    {editor && <form className="ui-panel space-y-4 border-qms-primary/20 bg-qms-primary-soft p-5" onSubmit={event => { event.preventDefault(); void ejecutar(false) }}>
      <h3 className="text-base font-medium">{editor.id ? 'Editar valor' : 'Nuevo valor'} · {presentarNombre(editor.tipo ?? actual)}</h3>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_100px_auto]">
        <Field id="catalogo-valor" label="Valor"><Input id="catalogo-valor" required value={editor.valor ?? ''} onChange={event => setEditor({ ...editor, valor: event.target.value })} /></Field>
        <Field id="catalogo-color" label="Color"><Select id="catalogo-color" value={editor.color ?? 'gray'} onChange={event => setEditor({ ...editor, color: event.target.value })}>{Object.entries(colores).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
        <Field id="catalogo-orden" label="Orden"><Input id="catalogo-orden" required type="number" min={0} step={1} value={editor.orden ?? ''} onChange={event => setEditor({ ...editor, orden: Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber })} /></Field>
        <div className="flex items-end gap-2 pb-2"><Switch aria-label="Valor activo" checked={editor.activo !== false} onChange={activo => setEditor({ ...editor, activo })} /><span className="text-sm">Activo</span></div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" loading={saving} disabled={!editor.valor?.trim()}><Save className="h-4 w-4" aria-hidden="true" /> Guardar valor</Button></div>
    </form>}

    <div className="ui-panel overflow-x-auto"><table className="ui-table">
      <caption className="sr-only">{presentarNombre(actual || 'catalogos')} de {presentarNombre(modulo)}</caption>
      <thead><tr><th scope="col">Valor</th><th scope="col">Color</th><th scope="col">Orden</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{filas.length ? filas.map(c => <tr key={c.id}>
        <td className="font-medium">{c.valor}</td><td><Badge variant={c.color || 'gray'}>{colores[c.color as keyof typeof colores] ?? c.color ?? 'Gris'}</Badge></td><td>{c.orden}</td>
        <td><Badge variant={c.activo !== false ? 'green' : 'gray'}>{c.activo !== false ? 'Activo' : 'Inactivo'}</Badge></td>
        <td><div className="flex gap-1"><Button size="sm" variant="link" disabled={saving} onClick={() => setEditor(c)} aria-label={`Editar ${c.valor}`}>Editar</Button><Button size="sm" variant="danger" disabled={saving} onClick={() => setEliminar(c)} aria-label={`Eliminar ${c.valor}`}>Eliminar</Button></div></td>
      </tr>) : <tr><td colSpan={5} className="py-10! text-center text-qms-muted">No hay valores en este catálogo.</td></tr>}</tbody>
    </table></div>
    <ConfirmDialog open={!!eliminar} title="Eliminar valor del catálogo" message={<>Se eliminará «{eliminar?.valor}». Los registros que ya usan este valor se conservan.</>} confirmLabel="Eliminar valor" danger loading={saving} onCancel={() => setEliminar(null)} onConfirm={() => void ejecutar(true)} />
  </div>
}

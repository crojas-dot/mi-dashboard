'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import { useSLAConfig, slaConfigKey, type SLAConfig } from '@/lib/queries/useQuejas'
import { guardarPlazo, eliminarPlazo } from '@/lib/services/configuracionService'
import { presentarNombre, validarPlazos } from '@/lib/utils/configuracion'
import { showError, showSuccess } from '@/lib/services/errorToast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
import Badge from '@/components/ui/Badge'
import ErrorState from '@/components/ui/ErrorState'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

const procesos = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision_direccion']

export default function PlazosSettings({ active }: { active: boolean }) {
  const query = useSLAConfig(undefined, active)
  const client = useQueryClient()
  const [editor, setEditor] = useState<Partial<SLAConfig> | null>(null)
  const [eliminar, setEliminar] = useState<SLAConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const validacion = editor ? validarPlazos(editor.dias_alerta ?? NaN, editor.dias_vencimiento ?? NaN) : null

  const ejecutar = async (borrar: boolean) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (borrar && eliminar) await eliminarPlazo(eliminar.id)
      else if (editor) await guardarPlazo(editor)
      else return
      showSuccess(borrar ? 'Plazo eliminado' : 'Plazo guardado')
      setEditor(null); setEliminar(null)
      await client.invalidateQueries({ queryKey: slaConfigKey })
    } catch (error) { showError(error as Error, 'No se pudo actualizar el plazo') }
    finally { savingRef.current = false; setSaving(false) }
  }

  if (query.isPending) return <p role="status" className="p-6 text-sm text-qms-muted">Cargando plazos…</p>
  if (query.error) return <ErrorState onRetry={() => void query.refetch()} />

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-xl text-sm text-qms-muted">Definí cuándo advertir sobre un caso y cuántos días tiene el equipo para atenderlo.</p>
      <Button disabled={saving || !!editor} onClick={() => setEditor({ proceso: 'quejas', prioridad: '', dias_alerta: 3, dias_vencimiento: 7 })}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar plazo</Button>
    </div>
    {editor && <form className="ui-panel space-y-4 border-qms-primary/20 bg-qms-primary-soft p-5" onSubmit={event => { event.preventDefault(); void ejecutar(false) }}>
      <h3 className="font-medium">{editor.id ? 'Editar plazo' : 'Nuevo plazo'}</h3>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <Field id="plazo-proceso" label="Proceso"><Select id="plazo-proceso" required value={editor.proceso ?? ''} onChange={event => setEditor({ ...editor, proceso: event.target.value })}>{procesos.map(p => <option key={p} value={p}>{presentarNombre(p)}</option>)}</Select></Field>
        <Field id="plazo-prioridad" label="Prioridad"><Input id="plazo-prioridad" required placeholder="Ej.: Alta" value={editor.prioridad ?? ''} onChange={event => setEditor({ ...editor, prioridad: event.target.value })} /></Field>
        <Field id="plazo-alerta" label="Alerta después de (días)" hint="Tiempo transcurrido antes de mostrar la advertencia.">
          <Input id="plazo-alerta" aria-describedby="plazo-alerta-hint" required min={0} step={1} type="number" value={editor.dias_alerta ?? ''} onChange={event => setEditor({ ...editor, dias_alerta: Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber })} />
        </Field>
        <Field id="plazo-vencimiento" label="Vencimiento después de (días)" hint="Debe ser igual o posterior al día de alerta.">
          <Input id="plazo-vencimiento" aria-describedby="plazo-vencimiento-hint" required min={1} step={1} type="number" value={editor.dias_vencimiento ?? ''} onChange={event => setEditor({ ...editor, dias_vencimiento: Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber })} />
        </Field>
      </fieldset>
      {validacion && <p role="status" className="text-sm text-qms-danger">{validacion}</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" loading={saving} disabled={!!validacion || !editor.prioridad?.trim()}><Save className="h-4 w-4" aria-hidden="true" /> Guardar plazo</Button></div>
    </form>}
    <div className="ui-panel overflow-x-auto"><table className="ui-table">
      <caption className="sr-only">Plazos de atención por proceso y prioridad</caption>
      <thead><tr><th scope="col">Proceso</th><th scope="col">Prioridad</th><th scope="col">Alerta</th><th scope="col">Vencimiento</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{query.data?.length ? query.data.map(s => <tr key={s.id}>
        <td className="font-medium">{presentarNombre(s.proceso)}</td><td><Badge variant="gray">{s.prioridad}</Badge></td><td>{s.dias_alerta} días</td><td>{s.dias_vencimiento} días</td>
        <td><div className="flex gap-1"><Button size="sm" variant="link" disabled={saving} onClick={() => setEditor(s)} aria-label={`Editar plazo de ${presentarNombre(s.proceso)}, ${s.prioridad}`}>Editar</Button><Button size="sm" variant="danger" disabled={saving} onClick={() => setEliminar(s)} aria-label={`Eliminar plazo de ${presentarNombre(s.proceso)}, ${s.prioridad}`}>Eliminar</Button></div></td>
      </tr>) : <tr><td colSpan={5} className="py-10! text-center text-qms-muted">No hay plazos configurados.</td></tr>}</tbody>
    </table></div>
    <ConfirmDialog open={!!eliminar} title="Eliminar plazo" message={<>Se eliminará el plazo de {presentarNombre(eliminar?.proceso ?? '')} con prioridad «{eliminar?.prioridad}». Revisá que el proceso conserve los plazos que necesita.</>} confirmLabel="Eliminar plazo" danger loading={saving} onCancel={() => setEliminar(null)} onConfirm={() => void ejecutar(true)} />
  </div>
}

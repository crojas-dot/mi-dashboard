'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { queryKeys } from '@/lib/queries/queryKeys'
import { fetchConfiguracionesGenerales, guardarConfiguracionGeneral, type ConfigGeneral } from '@/lib/services/configuracionService'
import { parsearValorConfiguracion, presentarNombre } from '@/lib/utils/configuracion'
import { showError, showSuccess } from '@/lib/services/errorToast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
import ErrorState from '@/components/ui/ErrorState'
import ZonaHorariaEditor from './ZonaHorariaEditor'

const key = [...queryKeys.configuraciones, 'general'] as const
const serializar = (valor: unknown) => typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2)
const sensible = (clave: string) => /secret|password|api.?key|private.?key|token/i.test(clave)

export default function GeneralSettings({ active }: { active: boolean }) {
  const query = useQuery({ queryKey: key, queryFn: fetchConfiguracionesGenerales, enabled: active })
  const client = useQueryClient()
  const [editor, setEditor] = useState<{ config: ConfigGeneral; texto: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorValor, setErrorValor] = useState('')
  const savingRef = useRef(false)
  const configs = (query.data ?? []).filter(config => config.clave !== 'org.zona_horaria')
  const categorias = [...new Set(configs.map(config => config.categoria || 'general'))]

  const guardar = async () => {
    if (!editor || savingRef.current) return
    let valor: unknown
    try { valor = parsearValorConfiguracion(editor.texto, editor.config.valor) }
    catch { setErrorValor('El valor debe ser JSON válido y conservar su tipo original.'); return }
    savingRef.current = true; setSaving(true); setErrorValor('')
    try {
      await guardarConfiguracionGeneral({ clave: editor.config.clave, valor })
      showSuccess('Configuración guardada')
      setEditor(null)
      await client.invalidateQueries({ queryKey: queryKeys.configuraciones })
    } catch (error) { showError(error as Error, 'No se pudo guardar la configuración') }
    finally { savingRef.current = false; setSaving(false) }
  }

  if (query.isPending) return <p role="status" className="p-6 text-sm text-qms-muted">Cargando ajustes…</p>
  if (query.error) return <ErrorState onRetry={() => void query.refetch()} />

  return <div className="space-y-5">
    <ZonaHorariaEditor active={active} />
    {!configs.length && <p className="ui-panel p-6 text-sm text-qms-muted">No hay otros ajustes generales disponibles.</p>}
    {categorias.map(categoria => <section key={categoria} className="ui-panel overflow-hidden" aria-label={presentarNombre(categoria)}>
      <h3 className="border-b border-qms-border bg-qms-table-head px-5 py-3 text-sm font-semibold">{presentarNombre(categoria)}</h3>
      <div className="divide-y divide-qms-border">{configs.filter(config => (config.categoria || 'general') === categoria).map(config => <div key={config.clave} className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><h4 className="text-base font-medium">{presentarNombre(config.clave)}</h4><p className="mt-1 text-sm text-qms-muted">{config.descripcion || 'Ajuste general del sistema.'}</p></div>
          {editor?.config.clave !== config.clave && <Button size="sm" variant="secondary" disabled={saving || !!editor} onClick={() => { setEditor({ config, texto: serializar(config.valor) }); setErrorValor('') }}>Editar</Button>}
        </div>
        {editor?.config.clave === config.clave ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void guardar() }}>
          <Field id="config-valor" label="Valor" hint={typeof config.valor === 'object' ? 'Conservá la estructura JSON del ajuste.' : undefined}>
            {typeof config.valor === 'boolean' ? <Select id="config-valor" disabled={saving} value={editor.texto} onChange={event => setEditor({ ...editor, texto: event.target.value })}><option value="true">Habilitado</option><option value="false">Deshabilitado</option></Select>
              : typeof config.valor === 'object' ? <Textarea id="config-valor" aria-describedby="config-valor-hint" aria-invalid={!!errorValor} disabled={saving} value={editor.texto} className="font-mono" onChange={event => setEditor({ ...editor, texto: event.target.value })} />
                : <Input id="config-valor" type={sensible(config.clave) ? 'password' : 'text'} autoComplete="off" aria-invalid={!!errorValor} disabled={saving} value={editor.texto} onChange={event => setEditor({ ...editor, texto: event.target.value })} />}
          </Field>
          {errorValor && <p role="alert" className="text-sm text-qms-danger">{errorValor}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" loading={saving}><Save className="h-4 w-4" aria-hidden="true" /> Guardar cambios</Button></div>
        </form> : <p className="select-text break-words rounded-button bg-qms-hover-bg px-3 py-2 text-sm whitespace-pre-wrap">{sensible(config.clave) ? '•••••••• · Valor protegido' : typeof config.valor === 'boolean' ? config.valor ? 'Habilitado' : 'Deshabilitado' : serializar(config.valor)}</p>}
      </div>)}</div>
    </section>)}
  </div>
}

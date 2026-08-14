'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Save, Trash2, RotateCcw, Loader2, Tag, Clock, Settings as SettingsIcon, ChevronDown, Check, X, Link as LinkIcon, ShieldCheck, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCatalogos, type CatalogoValor } from '@/lib/queries/useCatalogos'
import { useSLAConfig, slaConfigKey, type SLAConfig } from '@/lib/queries/useQuejas'
import { useFormulariosPublicos, useCrearFormularioPublico, useToggleFormularioPublico, useEliminarFormularioPublico, type FormularioPublico } from '@/lib/queries/useFormulariosPublicos'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/Modal'
import RolesAccesos from './components/RolesAccesos'
import ModoVistaActiva from './components/ModoVistaActiva'

type Tab = 'catalogos' | 'sla' | 'general' | 'formularios' | 'roles' | 'vistas'

interface ConfigGeneral { clave: string; valor: any; descripcion: string; categoria: string }

const modulos = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'general']

const procesosSLA = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision_direccion']

const coloresBadge = ['red', 'amber', 'green', 'blue', 'orange', 'purple', 'gray']

export default function ConfiguracionPage() {
  const { data: catalogos = [], isLoading: loading } = useCatalogos()
  const { data: slas = [] } = useSLAConfig()
  const queryClient = useQueryClient()
  const invalidateCatalogos = () => queryClient.invalidateQueries({ queryKey: ['catalogos'] })
  const invalidateSLA = () => queryClient.invalidateQueries({ queryKey: slaConfigKey })
  const invalidateConfigs = () => queryClient.invalidateQueries({ queryKey: ['configuraciones_sistema'] })
  const [tab, setTab] = useState<Tab>('catalogos')
  const [configs, setConfigs] = useState<ConfigGeneral[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [moduloSel, setModuloSel] = useState(modulos[0])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [editCatalogo, setEditCatalogo] = useState<Partial<CatalogoValor>>({})
  const [editSLA, setEditSLA] = useState<Partial<SLAConfig>>({})
  const [editConfig, setEditConfig] = useState<Partial<ConfigGeneral>>({})
  const [nuevoFormOpen, setNuevoFormOpen] = useState(false)
  const [nuevoFormNombre, setNuevoFormNombre] = useState('')

  const { data: formularios = [], isLoading: formulariosLoading } = useFormulariosPublicos()
  const crearFormulario = useCrearFormularioPublico()
  const toggleFormulario = useToggleFormularioPublico()
  const eliminarFormulario = useEliminarFormularioPublico()

  const loadConfigs = async () => {
    setConfigsLoading(true)
    const { data } = await supabase.from('configuraciones_sistema').select('*').order('categoria').order('clave')
    if (data) setConfigs(data as ConfigGeneral[])
    setConfigsLoading(false)
  }
  useEffect(() => { loadConfigs() }, [])

  const tiposDisponibles = useMemo(() => {
    const tipos = new Set<string>()
    for (const c of catalogos) if (c.modulo === moduloSel && (c.activo === null || c.activo === true)) tipos.add(c.tipo)
    return [...tipos].sort()
  }, [catalogos, moduloSel])

  useEffect(() => {
    if (!tiposDisponibles.includes(filtroTipo)) setFiltroTipo(tiposDisponibles[0] || '')
  }, [tiposDisponibles])

  const catalogosFiltrados = catalogos.filter((c) => c.modulo === moduloSel && c.tipo === filtroTipo)

  const guardarCatalogo = async () => {
    if (!editCatalogo.valor?.trim()) return
    const payload = { modulo: editCatalogo.modulo || moduloSel, tipo: filtroTipo, valor: editCatalogo.valor, color: editCatalogo.color || 'gray', orden: editCatalogo.orden ?? 0, activo: editCatalogo.activo ?? true }
    const { error } = editCatalogo.id
      ? await supabase.from('catalogos').update(payload).eq('id', editCatalogo.id)
      : await supabase.from('catalogos').insert([payload])
    if (error) { showError(error, 'No se pudo guardar el catálogo'); return }
    showSuccess(editCatalogo.id ? 'Catálogo actualizado' : 'Valor agregado al catálogo')
    setEditCatalogo({})
    invalidateCatalogos()
  }

  const eliminarCatalogo = async (id: string) => {
    const { error } = await supabase.from('catalogos').delete().eq('id', id)
    if (error) { showError(error, 'No se pudo eliminar el valor'); return }
    showSuccess('Valor eliminado')
    invalidateCatalogos()
  }

  const guardarSLA = async () => {
    if (!editSLA.proceso?.trim() || !editSLA.prioridad?.trim()) return
    const payload = { proceso: editSLA.proceso, prioridad: editSLA.prioridad, dias_alerta: editSLA.dias_alerta ?? 0, dias_vencimiento: editSLA.dias_vencimiento ?? 0 }
    const { error } = editSLA.id
      ? await supabase.from('sla_config').update(payload).eq('id', editSLA.id)
      : await supabase.from('sla_config').insert([payload])
    if (error) { showError(error, 'No se pudo guardar la configuración SLA'); return }
    showSuccess('Configuración SLA guardada')
    setEditSLA({})
    invalidateSLA()
  }

  const eliminarSLA = async (id: string) => {
    const { error } = await supabase.from('sla_config').delete().eq('id', id)
    if (error) { showError(error, 'No se pudo eliminar la configuración SLA'); return }
    showSuccess('Configuración SLA eliminada')
    invalidateSLA()
  }

  const guardarConfig = async () => {
    if (!editConfig.clave?.trim() || !editConfig.valor?.trim()) return
    const payload = { valor: editConfig.valor, descripcion: editConfig.descripcion || '', categoria: editConfig.categoria || 'general' }
    const { error } = await supabase.from('configuraciones_sistema').update(payload).eq('clave', editConfig.clave)
    if (error) { showError(error, 'No se pudo guardar la configuración'); return }
    showSuccess('Configuración guardada')
    setEditConfig({})
    loadConfigs()
  }

  const tabs: { key: Tab; label: string; icon: typeof Tag }[] = [
    { key: 'catalogos', label: 'Catálogos', icon: Tag },
    { key: 'sla', label: 'SLA y Plazos', icon: Clock },
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'formularios', label: 'Formularios', icon: LinkIcon },
    { key: 'roles', label: 'Roles y Accesos', icon: ShieldCheck },
    { key: 'vistas', label: 'Vistas', icon: Eye },
  ]

  const { user, initialized } = useAuthStore()
  const router = useRouter()
  useEffect(() => {
    if (!initialized) return
    if (user?.rol !== 'admin') router.replace('/')
  }, [user, initialized, router])
  if (!initialized || user?.rol !== 'admin') {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Configuración" description="Catálogos, SLA y configuraciones del sistema">
        <Button size="sm" variant="secondary" onClick={() => { invalidateCatalogos(); invalidateSLA(); invalidateConfigs() }}><RotateCcw className="h-3.5 w-3.5" /> Recargar</Button>
      </PageHeader>

      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
           {tabs.map((t) => {
             const Icon = t.icon
             return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {loading || (tab === 'general' && configsLoading) || (tab === 'formularios' && formulariosLoading) ? (
          <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : tab === 'catalogos' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={moduloSel} onChange={(e) => setModuloSel(e.target.value)}>
                {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                {tiposDisponibles.length === 0 && <option value="">Sin tipos</option>}
                {tiposDisponibles.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </Select>
              <button onClick={() => setEditCatalogo({ modulo: moduloSel, valor: '', color: 'gray', orden: 0, activo: true })}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors" style={{ border: 'none', cursor: 'pointer' }}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            </div>

            {editCatalogo.valor !== undefined && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 flex-wrap">
                <input className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm flex-1" placeholder="Valor" value={editCatalogo.valor || ''} onChange={(e) => setEditCatalogo({ ...editCatalogo, valor: e.target.value })} />
                <Select value={editCatalogo.color || 'gray'} onChange={(e) => setEditCatalogo({ ...editCatalogo, color: e.target.value })}>
                  {coloresBadge.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-16" type="number" placeholder="Orden" value={editCatalogo.orden ?? 0} onChange={(e) => setEditCatalogo({ ...editCatalogo, orden: parseInt(e.target.value) || 0 })} />
                <label className="flex items-center gap-1.5 text-sm whitespace-nowrap"><input type="checkbox" checked={editCatalogo.activo ?? true} onChange={(e) => setEditCatalogo({ ...editCatalogo, activo: e.target.checked })} /> Activo</label>
                <button onClick={guardarCatalogo} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" style={{ border: 'none', cursor: 'pointer' }}><Save className="h-3.5 w-3.5 inline" /> Guardar</button>
                <button onClick={() => setEditCatalogo({})} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Cancelar</button>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
              <table className="w-full select-text text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#343a40' }}>
                    <th className="px-3 py-2 text-left font-semibold text-white">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Color</th>
                    <th className="px-3 py-2 text-left font-semibold text-white w-16">Orden</th>
                    <th className="px-3 py-2 text-left font-semibold text-white w-20">Activo</th>
                    <th className="px-3 py-2 text-center font-semibold text-white w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogosFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No hay valores en este catálogo</td></tr>
                  ) : catalogosFiltrados.map((c) => (
                    <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2">{c.valor}</td>
                      <td className="px-3 py-2"><Badge variant={c.color || 'gray'}>{c.color || 'gray'}</Badge></td>
                      <td className="px-3 py-2">{c.orden}</td>
                      <td className="px-3 py-2">{c.activo ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditCatalogo(c)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Editar</button>
                          <button onClick={() => eliminarCatalogo(c.id)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'sla' ? (
          <div className="space-y-4">
            <button onClick={() => setEditSLA({ proceso: '', prioridad: '', dias_alerta: 0, dias_vencimiento: 0 })}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors" style={{ border: 'none', cursor: 'pointer' }}>
              <Plus className="h-3.5 w-3.5" /> Nueva configuración SLA
            </button>

            {editSLA.proceso !== undefined && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 flex-wrap">
                <Select value={editSLA.proceso || ''} onChange={(e) => setEditSLA({ ...editSLA, proceso: e.target.value })}>
                  <option value="" disabled>Seleccionar proceso</option>
                  {procesosSLA.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </Select>
                <input className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="Prioridad" value={editSLA.prioridad || ''} onChange={(e) => setEditSLA({ ...editSLA, prioridad: e.target.value })} />
                <input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-20" type="number" placeholder="Alerta (días)" value={editSLA.dias_alerta ?? 0} onChange={(e) => setEditSLA({ ...editSLA, dias_alerta: parseInt(e.target.value) || 0 })} />
                <input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-24" type="number" placeholder="Vencimiento (días)" value={editSLA.dias_vencimiento ?? 0} onChange={(e) => setEditSLA({ ...editSLA, dias_vencimiento: parseInt(e.target.value) || 0 })} />
                <button onClick={guardarSLA} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" style={{ border: 'none', cursor: 'pointer' }}><Save className="h-3.5 w-3.5 inline" /> Guardar</button>
                <button onClick={() => setEditSLA({})} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Cancelar</button>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
              <table className="w-full select-text text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#343a40' }}>
                    <th className="px-3 py-2 text-left font-semibold text-white">Proceso</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Prioridad</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Alerta (días)</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Vencimiento (días)</th>
                    <th className="px-3 py-2 text-center font-semibold text-white w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {slas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No hay configuraciones SLA</td></tr>
                  ) : slas.map((s) => (
                    <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{s.proceso}</td>
                      <td className="px-3 py-2"><Badge variant={(s.prioridad || '').toLowerCase() === 'alta' ? 'red' : (s.prioridad || '').toLowerCase() === 'media' ? 'amber' : 'green'}>{s.prioridad}</Badge></td>
                      <td className="px-3 py-2">{s.dias_alerta}d</td>
                      <td className="px-3 py-2 font-semibold">{s.dias_vencimiento}d</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => eliminarSLA(s.id)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'formularios' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Enlaces públicos de registro de quejas. Cualquier persona con el enlace puede enviar una queja sin iniciar sesión.</p>
              <button onClick={() => setNuevoFormOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shrink-0" style={{ backgroundColor: '#0d6efd', height: '38px', padding: '0 14px', border: 'none', cursor: 'pointer' }}>
                <Plus className="h-4 w-4" /> Nuevo enlace
              </button>
            </div>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
              <table className="w-full select-text text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#343a40' }}>
                    <th className="px-3 py-2 text-left font-semibold text-white">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Estado</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Creado</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">URL</th>
                    <th className="px-3 py-2 text-center font-semibold text-white w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {formularios.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No hay enlaces de formularios</td></tr>
                  ) : formularios.map((f) => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${f.token}`
                    return (
                      <tr key={f.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{f.nombre}</td>
                        <td className="px-3 py-2">
                          <Badge variant={f.activo ? 'green' : 'gray'}>{f.activo ? 'Activo' : 'Inactivo'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{new Date(f.created_at).toLocaleDateString('es-ES')}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-gray-600 break-all">{url}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => {
                              navigator.clipboard?.writeText(url)
                              showSuccess('Enlace copiado')
                            }} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }} title="Copiar URL">
                              <LinkIcon className="h-3.5 w-3.5 inline" /> Copiar
                            </button>
                            <button onClick={async () => {
                              try { await toggleFormulario.mutateAsync({ id: f.id, activo: !f.activo }); showSuccess(f.activo ? 'Enlace desactivado' : 'Enlace activado') }
                              catch (e) { showError(e as Error, 'No se pudo cambiar el estado') }
                            }} className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>
                              {f.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button onClick={async () => {
                              if (!confirm('¿Eliminar este enlace? Las quejas ya enviadas se conservan.')) return
                              try { await eliminarFormulario.mutateAsync(f.id); showSuccess('Enlace eliminado') }
                              catch (e) { showError(e as Error, 'No se pudo eliminar el enlace') }
                            }} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5 inline" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Modal open={nuevoFormOpen} onClose={() => setNuevoFormOpen(false)} title="Nuevo enlace de formulario" size="sm">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                  <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={nuevoFormNombre} onChange={(e) => setNuevoFormNombre(e.target.value)} placeholder="Ej: Formulario web quejas 2026" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setNuevoFormOpen(false)}>Cancelar</Button>
                  <Button type="button" loading={crearFormulario.isPending} disabled={!nuevoFormNombre.trim()} onClick={async () => {
                    try {
                      const nuevo = await crearFormulario.mutateAsync({ nombre: nuevoFormNombre.trim(), creadoPor: user?.id ?? null })
                      setNuevoFormOpen(false)
                      setNuevoFormNombre('')
                      showSuccess('Enlace creado. Copialo para compartirlo.')
                      if (typeof window !== 'undefined') {
                        const url = `${window.location.origin}/q/${nuevo.token}`
                        navigator.clipboard?.writeText(url)
                      }
                    } catch (e) { showError(e as Error, 'No se pudo crear el enlace') }
                  }}>Crear</Button>
                </div>
              </div>
            </Modal>
          </div>
        ) : tab === 'roles' ? (
          <RolesAccesos />
        ) : tab === 'vistas' ? (
          <ModoVistaActiva />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#dee2e6' }}>
              <table className="w-full select-text text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#343a40' }}>
                    <th className="px-3 py-2 text-left font-semibold text-white">Clave</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Descripción</th>
                    <th className="px-3 py-2 text-left font-semibold text-white">Categoría</th>
                    <th className="px-3 py-2 text-center font-semibold text-white w-20">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No hay configuraciones del sistema</td></tr>
                  ) : configs.map((cfg) => (
                    <tr key={cfg.clave} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{cfg.clave}</td>
                      <td className="px-3 py-2">
                        {editConfig.clave === cfg.clave ? (
                          <div className="flex items-center gap-1">
                            <input className="rounded-md border border-gray-300 px-2 py-1 text-sm flex-1" value={editConfig.valor || ''} onChange={(e) => setEditConfig({ ...editConfig, valor: e.target.value })} />
                            <button onClick={guardarConfig} className="rounded bg-blue-600 px-2 py-1 text-xs text-white"><Save className="h-3 w-3" /></button>
                            <button onClick={() => setEditConfig({})} className="rounded px-2 py-1 text-xs text-gray-600">X</button>
                          </div>
                        ) : (
                          <span className="text-sm">{cfg.valor}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{cfg.descripcion}</td>
                      <td className="px-3 py-2"><Badge variant="gray">{cfg.categoria}</Badge></td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setEditConfig({ clave: cfg.clave, valor: cfg.valor, descripcion: cfg.descripcion, categoria: cfg.categoria })} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
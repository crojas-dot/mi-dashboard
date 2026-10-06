'use client'

import StageSettings from '@/components/configuracion/StageSettings'
import CalendarSettings from '@/components/configuracion/CalendarSettings'
import ErrorState from '@/components/ui/ErrorState'

import { CButton, CFormInput, CFormLabel, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell , CNav, CNavLink, CFormCheck, CCard, CCardHeader, CCardBody } from '@coreui/react'
import styles from './configuracion.module.css'
import { useState, useEffect, useMemo } from 'react'
import { Plus, Save, Trash2, Loader2, Tag, Clock, Settings as SettingsIcon, Check, X, Link as LinkIcon, ShieldCheck, Layers, Sparkles } from '@/components/ui/icons'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCatalogos, type CatalogoValor } from '@/lib/queries/useCatalogos'
import { useFormulariosPublicos, useCrearFormularioPublico, useToggleFormularioPublico, useEliminarFormularioPublico } from '@/lib/queries/useFormulariosPublicos'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useAuthStore } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'

// Editores disponibles con la ruta: cambiar de pestaña no descarga otro chunk.
import RolesAccesos from './components/RolesAccesos'
import ModoVistaActiva from './components/ModoVistaActiva'
import AIProvidersManager from '@/components/configuracion/AIProvidersManager'

type Tab = 'catalogos' | 'sla' | 'general' | 'formularios' | 'roles' | 'vistas' | 'ia'

interface ConfigGeneral { clave: string; valor: unknown; descripcion: string; categoria: string }

const modulos = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'general']


const descripciones: Record<Tab, string> = {"catalogos":"Organiza los valores disponibles en los formularios de cada módulo.","sla":"Define los tiempos de alerta y vencimiento de cada proceso.","general":"Administra los parámetros generales del sistema de calidad.","formularios":"Gestiona los enlaces públicos para recibir nuevas quejas.","roles":"Configura los permisos de lectura y edición por rol.","vistas":"Revisa la experiencia disponible para cada rol del sistema.","ia":"Administra proveedores, modelos y asignaciones del asistente."}

const coloresBadge = ['primary', 'info', 'success', 'warning', 'danger', 'secondary']

const CONFIG_META: Record<string, { label: string; descripcion: string }> = {
  'org.nombre': { label: 'Nombre de la organización', descripcion: 'Nombre que se muestra en el sistema y en los documentos generados.' },
  'org.logo_url': { label: 'Logo institucional', descripcion: 'URL de la imagen del logo que identifica al sistema.' },
  'org.zona_horaria': { label: 'Zona horaria', descripcion: 'Zona horaria usada para fechas, SLA y vencimientos.' },
  'quejas.folio_prefix': { label: 'Prefijo de folios de quejas', descripcion: 'Prefijo que se antepone al número de folio de cada queja.' },
  'sacp.folio_prefix': { label: 'Prefijo de folios de SACP', descripcion: 'Prefijo que se antepone al número de folio de cada acción SACP.' },
  'drive_folder_id_quejas': { label: 'Carpeta de adjuntos en Google Drive', descripcion: 'ID de la carpeta raíz de Drive donde se guardan los adjuntos de las quejas. Cada queja crea una subcarpeta con su folio.' },
  'ai_providers': { label: 'Proveedores de IA', descripcion: 'Conexiones y API keys del asistente de IA. Se administran en la pestaña IA.' },
  'ai_routing': { label: 'Enrutamiento de IA', descripcion: 'Proveedor y modelo asignados a cada módulo. Se administra en la pestaña IA.' },
  'ai_cache_ttl_minutes': { label: 'Caché de modelos (TTL)', descripcion: 'Duración en minutos de la caché de descubrimiento de modelos de IA.' },
}

const CONFIG_OCULTAS = ['ai_modelos_cache_', 'ai_ultimo_exito_', 'ai_fallos_', 'ai_test_resultado_']

function configValorTexto(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (clave === 'ai_providers' && Array.isArray(valor)) {
    const nombres = (valor as Array<{ nombre?: string }>).map((p) => p.nombre).filter(Boolean)
    return nombres.length ? `${nombres.length} proveedor(es): ${nombres.join(', ')}` : 'Sin proveedores'
  }
  if (clave === 'ai_routing' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const mods = Object.keys(valor)
    return mods.length ? `${mods.length} módulo(s) enrutados` : 'Sin enrutamiento'
  }
  return typeof valor === 'string' ? valor : JSON.stringify(valor)
}

export default function ConfiguracionPage() {
  const { data: catalogos = [], isLoading: loading, error: catalogosError, refetch: retryCatalogos } = useCatalogos()
  const queryClient = useQueryClient()
  const invalidateCatalogos = () => queryClient.invalidateQueries({ queryKey: ['catalogos'] })
  const [tab, setTab] = useState<Tab>('catalogos')
  const { data: configs = [], isLoading: configsLoading, error: configsError, refetch: loadConfigs } = useQuery({
    queryKey: ['configuraciones_sistema'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuraciones_sistema').select('*').order('categoria').order('clave')
      if (error) throw error
      return (data ?? []) as ConfigGeneral[]
    },
  })
  const configsGenerales = configs.filter((c) => c.clave !== 'org.zona_horaria' && !CONFIG_OCULTAS.some((p) => c.clave.startsWith(p)))
  const [moduloSel, setModuloSel] = useState(modulos[0])
  const [tipoSeleccionado, setFiltroTipo] = useState('')
  const [editCatalogo, setEditCatalogo] = useState<Partial<CatalogoValor>>({})
  const [editConfig, setEditConfig] = useState<Partial<Omit<ConfigGeneral, 'valor'> & { valor: string }>>({})
  const [nuevoFormOpen, setNuevoFormOpen] = useState(false)
  const [nuevoFormNombre, setNuevoFormNombre] = useState('')

  const { data: formularios = [], isLoading: formulariosLoading, error: formulariosError, refetch: retryFormularios } = useFormulariosPublicos()
  const crearFormulario = useCrearFormularioPublico()
  const toggleFormulario = useToggleFormularioPublico()
  const eliminarFormulario = useEliminarFormularioPublico()


  const tiposDisponibles = useMemo(() => {
    const tipos = new Set<string>()
    for (const c of catalogos) if (c.modulo === moduloSel && (c.activo === null || c.activo === true)) tipos.add(c.tipo)
    return [...tipos].sort()
  }, [catalogos, moduloSel])
  const filtroTipo = tiposDisponibles.includes(tipoSeleccionado) ? tipoSeleccionado : tiposDisponibles[0] ?? ''



  const catalogosFiltrados = catalogos.filter((c) => c.modulo === moduloSel && c.tipo === filtroTipo)

  const guardarCatalogo = async () => {
    if (!editCatalogo.valor?.trim()) return
    const payload = { modulo: editCatalogo.modulo || moduloSel, tipo: filtroTipo, valor: editCatalogo.valor, color: editCatalogo.color || 'secondary', orden: editCatalogo.orden ?? 0, activo: editCatalogo.activo ?? true }
    const { error } = editCatalogo.id
      ? await supabase.from('catalogos').update(payload).eq('id', editCatalogo.id)
      : await supabase.from('catalogos').insert([payload])
    if (error) { showError(error, 'No se pudo guardar el catálogo'); return }
    showSuccess(editCatalogo.id ? 'Catálogo actualizado' : 'Valor agregado al catálogo')
    setEditCatalogo({})
    invalidateCatalogos()
  }

  const eliminarCatalogo = async (id: string) => {
    const { error } = await supabase.from('catalogos').update({ activo: false }).eq('id', id)
    if (error) { showError(error, 'No se pudo desactivar el valor'); return }
    showSuccess('Valor desactivado')
    invalidateCatalogos()
  }

  const activarCatalogo = async (id: string) => {
    const { error } = await supabase.from('catalogos').update({ activo: true }).eq('id', id)
    if (error) { showError(error, 'No se pudo activar el valor'); return }
    showSuccess('Valor activado')
    invalidateCatalogos()
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
    { key: 'sla', label: 'Plazos y alertas', icon: Clock },
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'formularios', label: 'Formularios', icon: LinkIcon },
    { key: 'roles', label: 'Roles y Accesos', icon: ShieldCheck },
    { key: 'vistas', label: 'Vistas', icon: Layers },
    { key: 'ia', label: 'IA', icon: Sparkles },
  ]

  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const router = useRouter()
  useEffect(() => {
    if (!initialized) return
    if (user?.rol !== 'admin') router.replace('/')
  }, [user, initialized, router])
  if (!initialized || user?.rol !== 'admin') {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  return (
    <div className={`coreui-module ${styles.page}`}>
      <div className={styles.layout}>
        <CCard className={styles.navigation}>
          <p className={styles.navTitle}>Administración</p>
          <CNav as="nav" variant="pills" aria-label="Secciones de configuración">
            {tabs.map(t => { const Icon = t.icon; return <CNavLink key={t.key} as="button" active={tab === t.key} aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}><Icon size={20} />{t.label}</CNavLink> })}
          </CNav>
        </CCard>
        <CCard className={styles.content}>
          <CCardHeader className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>{tabs.map(t => { const Icon = t.icon; return t.key === tab ? <Icon key={t.key} size={24} /> : null })}</span>
            <div><h2>{tabs.find(t => t.key === tab)?.label}</h2><p>{descripciones[tab]}</p></div>
          </CCardHeader>
          <CCardBody className={styles.sectionBody}>
        {tab === 'catalogos' && catalogosError ? <ErrorState error={catalogosError} title="No se pudieron cargar los catálogos" onRetry={() => void retryCatalogos()} />
        : tab === 'general' && configsError ? <ErrorState error={configsError} title="No se pudo cargar la configuración" onRetry={() => void loadConfigs()} />
        : tab === 'formularios' && formulariosError ? <ErrorState error={formulariosError} title="No se pudieron cargar los formularios" onRetry={() => void retryFormularios()} />
        : (tab === 'catalogos' && loading) || (tab === 'general' && configsLoading) || (tab === 'formularios' && formulariosLoading) ? (
          <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : tab === 'catalogos' ? (
          <div className="space-y-4">
            <div className={styles.filters}>
              <div><CFormLabel htmlFor="catalogo-modulo">Módulo</CFormLabel>
              <Select id="catalogo-modulo" value={moduloSel} onChange={(e) => setModuloSel(e.target.value)}>
                {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select></div>
              <div><CFormLabel htmlFor="catalogo-tipo">Catálogo</CFormLabel>
              <Select id="catalogo-tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                {tiposDisponibles.length === 0 && <option value="">Sin tipos</option>}
                {tiposDisponibles.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </Select></div>
              <CButton disabled={filtroTipo.startsWith('estado_')} color="primary" onClick={() => setEditCatalogo({ modulo: moduloSel, valor: '', color: 'secondary', orden: 0, activo: true })}
                className="inline-flex items-center gap-1 px-3 py-1.5 font-medium transition-colors" title={filtroTipo.startsWith('estado_') ? 'Los estados del flujo se definen por migración' : 'Nuevo valor'}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </CButton>
            </div>
            {filtroTipo.startsWith('estado_') && (
              <p className="mb-0 small text-body-secondary">Los <strong>estados de flujo</strong> son fijos y siempre activos: puedes editar su nombre, color y orden, pero no desactivarlos ni crear nuevos.</p>
            )}

            {editCatalogo.valor !== undefined && (
              <div className={styles.editor}>
                <div><CFormLabel htmlFor="catalogo-valor">Valor</CFormLabel><CFormInput id="catalogo-valor" placeholder="Nombre del valor" value={editCatalogo.valor || ''} onChange={(e) => setEditCatalogo({ ...editCatalogo, valor: e.target.value })} /></div>
                <div><CFormLabel htmlFor="catalogo-color">Color</CFormLabel><Select id="catalogo-color" value={editCatalogo.color || 'secondary'} onChange={(e) => setEditCatalogo({ ...editCatalogo, color: e.target.value })}>
                  {coloresBadge.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select></div>
                <div><CFormLabel htmlFor="catalogo-orden">Orden</CFormLabel><CFormInput id="catalogo-orden" type="number" value={editCatalogo.orden ?? 0} onChange={(e) => setEditCatalogo({ ...editCatalogo, orden: parseInt(e.target.value) || 0 })} /></div>
                <div className={styles.editorActions}>
                {filtroTipo.startsWith('estado_')
                  ? <span className="small text-body-secondary">Siempre activo (flujo)</span>
                  : <CFormCheck id="catalogo-activo" label="Activo" checked={editCatalogo.activo ?? true} onChange={(e) => setEditCatalogo({ ...editCatalogo, activo: e.target.checked })} />}
                <CButton color="primary" onClick={guardarCatalogo} className="px-3 py-1.5 font-medium"><Save className="inline h-3.5 w-3.5" /> Guardar</CButton>
                <CButton color="secondary" variant="outline" onClick={() => setEditCatalogo({})} className="px-3 py-1.5">Cancelar</CButton>
                </div>
              </div>
            )}

            <div className="table-responsive">
              <CTable align="middle" hover className="w-full select-text">
                <CTableHead>
                  <CTableRow className="">
                    <CTableHeaderCell>ID interno</CTableHeaderCell><CTableHeaderCell className="px-3 py-2 text-left font-semibold">Nombre visible</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Color</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold w-16">Orden</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold w-20">Activo</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-center font-semibold w-24">Acciones</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {catalogosFiltrados.length === 0 ? (
                    <CTableRow><CTableDataCell colSpan={6} className="px-3 py-8 text-center">No hay valores en este catálogo</CTableDataCell></CTableRow>
                  ) : catalogosFiltrados.map((c) => (
                    <CTableRow key={c.id} className="">
                      <CTableDataCell className="font-monospace small">{c.codigo}</CTableDataCell><CTableDataCell className="px-3 py-2">{c.valor}</CTableDataCell>
                      <CTableDataCell className="px-3 py-2"><Badge variant={c.color || 'secondary'}>{c.color || 'secondary'}</Badge></CTableDataCell>
                      <CTableDataCell className="px-3 py-2">{c.orden}</CTableDataCell>
                      <CTableDataCell className="px-3 py-2">{c.activo ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}</CTableDataCell>
                      <CTableDataCell className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CButton color="primary" onClick={() => setEditCatalogo(c)} className="px-2 py-1 font-medium">Editar</CButton>
                          {c.tipo.startsWith('estado_') ? (
                            <span className="px-2 py-1 small text-body-secondary">Flujo</span>
                          ) : c.activo === false ? (
                            <CButton color="success" variant="outline" onClick={() => activarCatalogo(c.id)} className="px-2 py-1 font-medium">Activar</CButton>
                          ) : (
                            <CButton color="danger" variant="outline" onClick={() => eliminarCatalogo(c.id)} className="px-2 py-1 font-medium">Desactivar</CButton>
                          )}
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          </div>
        ) : tab === 'sla' ? (
<StageSettings />
        ) : tab === 'formularios' ? (
          <div className="space-y-4">
            <div className={styles.toolbar}>
              <p className="text-sm text-gray-600">Enlaces públicos de registro de quejas. Cualquier persona con el enlace puede enviar una queja sin iniciar sesión.</p>
              <CButton color="primary" onClick={() => setNuevoFormOpen(true)}
                className="inline-flex h-[38px] shrink-0 items-center gap-1.5 px-3.5 font-medium transition-colors">
                <Plus className="h-4 w-4" /> Nuevo enlace
              </CButton>
            </div>

            <div className="table-responsive">
              <CTable align="middle" hover className="w-full select-text">
                <CTableHead>
                  <CTableRow className="">
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Nombre</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Estado</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Creado</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">URL</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-center font-semibold w-36">Acciones</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {formularios.length === 0 ? (
                    <CTableRow><CTableDataCell colSpan={5} className="px-3 py-8 text-center">No hay enlaces de formularios</CTableDataCell></CTableRow>
                  ) : formularios.map((f) => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${f.token}`
                    return (
                      <CTableRow key={f.id} className="">
                        <CTableDataCell className="px-3 py-2 font-medium">{f.nombre}</CTableDataCell>
                        <CTableDataCell className="px-3 py-2">
                          <Badge variant={f.activo ? 'green' : 'gray'}>{f.activo ? 'Activo' : 'Inactivo'}</Badge>
                        </CTableDataCell>
                        <CTableDataCell className="px-3 py-2">{new Date(f.created_at).toLocaleDateString('es-ES')}</CTableDataCell>
                        <CTableDataCell className="px-3 py-2">
                          <span className="font-mono text-xs text-gray-600 break-all">{url}</span>
                        </CTableDataCell>
                        <CTableDataCell className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CButton color="primary" onClick={() => {
                              navigator.clipboard?.writeText(url)
                              showSuccess('Enlace copiado')
                            }} className="px-2 py-1 font-medium" title="Copiar URL">
                              <LinkIcon className="h-3.5 w-3.5 inline" /> Copiar
                            </CButton>
                            <CButton color="secondary" variant="outline" onClick={async () => {
                              try { await toggleFormulario.mutateAsync({ id: f.id, activo: !f.activo }); showSuccess(f.activo ? 'Enlace desactivado' : 'Enlace activado') }
                              catch (e) { showError(e as Error, 'No se pudo cambiar el estado') }
                            }} className="px-2 py-1 font-medium">
                              {f.activo ? 'Desactivar' : 'Activar'}
                            </CButton>
                            <CButton color="danger" onClick={async () => {
                              if (!confirm('¿Eliminar este enlace? Las quejas ya enviadas se conservan.')) return
                              try { await eliminarFormulario.mutateAsync(f.id); showSuccess('Enlace eliminado') }
                              catch (e) { showError(e as Error, 'No se pudo eliminar el enlace') }
                            }} className="px-2 py-1 font-medium" title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5 inline" />
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>

            <Modal open={nuevoFormOpen} onClose={() => setNuevoFormOpen(false)} title="Nuevo enlace de formulario" size="sm">
              <div className="space-y-4">
                <div>
                  <CFormLabel className="mb-1 block font-medium">Nombre</CFormLabel>
                  <CFormInput className="w-full px-3 py-2" value={nuevoFormNombre} onChange={(e) => setNuevoFormNombre(e.target.value)} placeholder="Ej: Formulario web quejas 2026" />
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
        ) : tab === 'ia' ? (
          <AIProvidersManager />
        ) : (
          <div className="space-y-4">
            <CalendarSettings />
            <div className="table-responsive">
              <CTable align="middle" hover className="w-full select-text">
                <CTableHead>
                  <CTableRow className="">
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Configuración</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Valor</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-left font-semibold">Descripción</CTableHeaderCell>
                    <CTableHeaderCell className="px-3 py-2 text-center font-semibold w-24">Acción</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {configsGenerales.length === 0 ? (
                    <CTableRow><CTableDataCell colSpan={4} className="px-3 py-8 text-center">No hay configuraciones del sistema</CTableDataCell></CTableRow>
                  ) : configsGenerales.map((cfg) => (
                    <CTableRow key={cfg.clave} className="">
                      <CTableDataCell className="px-3 py-2">
                        <p className="mb-1 font-medium">{CONFIG_META[cfg.clave]?.label ?? cfg.clave}</p>
                        <p className="m-0 font-mono text-xs text-qms-muted">{cfg.clave}</p>
                      </CTableDataCell>
                      <CTableDataCell className="px-3 py-2 max-w-xs">
                        {editConfig.clave === cfg.clave ? (
                          <div className="flex items-center gap-1">
                            <CFormInput className="px-2 py-1 flex-1" value={editConfig.valor || ''} onChange={(e) => setEditConfig({ ...editConfig, valor: e.target.value })} />
                            <CButton color="primary" onClick={guardarConfig} className="px-2 py-1" title="Guardar"><Save className="h-3.5 w-3.5" /></CButton>
                            <CButton color="secondary" variant="outline" onClick={() => setEditConfig({})} className="px-2 py-1" title="Cancelar">X</CButton>
                          </div>
                        ) : (
                          <span className="block truncate font-mono text-sm" title={configValorTexto(cfg.clave, cfg.valor)}>{configValorTexto(cfg.clave, cfg.valor) || '—'}</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="px-3 py-2">{CONFIG_META[cfg.clave]?.descripcion ?? cfg.descripcion}</CTableDataCell>
                      <CTableDataCell className="px-3 py-2 text-center">
                        <CButton color="primary" onClick={() => setEditConfig({ clave: cfg.clave, valor: typeof cfg.valor === 'string' ? cfg.valor : JSON.stringify(cfg.valor), descripcion: cfg.descripcion, categoria: cfg.categoria })} className="px-2 py-1 font-medium">Editar</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          </div>
        )}
          </CCardBody>
        </CCard>
      </div>
    </div>
  )
}

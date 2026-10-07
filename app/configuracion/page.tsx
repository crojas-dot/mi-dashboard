'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, Eye, Link as LinkIcon, RotateCcw, Settings2, ShieldCheck, Sparkles, Tag, type LucideIcon } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useAuthStore } from '@/lib/store/auth-store'
import { queryKeys } from '@/lib/queries/queryKeys'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import DeferredMount from '@/components/ui/DeferredMount'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
import CatalogosSettings from './components/CatalogosSettings'
import PlazosSettings from './components/PlazosSettings'
import GeneralSettings from './components/GeneralSettings'
import FormulariosSettings from './components/FormulariosSettings'
import RolesAccesos from './components/RolesAccesos'
import ModoVistaActiva from './components/ModoVistaActiva'
import AIProvidersManager from '@/components/configuracion/AIProvidersManager'

type Section = 'general' | 'catalogos' | 'sla' | 'formularios' | 'roles' | 'vistas' | 'ia'
interface SectionDefinition {
  id: Section; label: string; description: string; group: string; icon: LucideIcon
  component: ComponentType<{ active: boolean }>
}
const sections: SectionDefinition[] = [
  { id: 'general', label: 'Ajustes generales', description: 'Organización e integraciones del sistema.', group: 'Organización', icon: Settings2, component: GeneralSettings },
  { id: 'catalogos', label: 'Catálogos', description: 'Valores de los selectores de cada módulo.', group: 'Organización', icon: Tag, component: CatalogosSettings },
  { id: 'sla', label: 'Plazos de atención', description: 'Días de alerta y vencimiento por prioridad.', group: 'Organización', icon: Clock, component: PlazosSettings },
  { id: 'roles', label: 'Roles y accesos', description: 'Qué puede ver y editar cada rol.', group: 'Acceso', icon: ShieldCheck, component: RolesAccesos },
  { id: 'vistas', label: 'Vista por rol', description: 'Revisá cómo se presenta el panel a otro rol.', group: 'Acceso', icon: Eye, component: ModoVistaActiva },
  { id: 'formularios', label: 'Formularios públicos', description: 'Enlaces para recibir quejas sin iniciar sesión.', group: 'Servicios', icon: LinkIcon, component: FormulariosSettings },
  { id: 'ia', label: 'Asistente de IA', description: 'Proveedores, modelos y respaldo por módulo.', group: 'Servicios', icon: Sparkles, component: AIProvidersManager },
]
const groups = ['Organización', 'Acceso', 'Servicios']

export default function ConfiguracionPage() {
  const user = useAuthStore(state => state.user)
  const initialized = useAuthStore(state => state.initialized)
  const router = useRouter()
  const client = useQueryClient()
  const [section, setSection] = useState<Section>('catalogos')
  const [refreshing, setRefreshing] = useState(false)
  const selected = sections.find(item => item.id === section)!
  const Icon = selected.icon

  useEffect(() => {
    if (initialized && user?.rol !== 'admin') router.replace('/')
  }, [initialized, user, router])

  if (!initialized || user?.rol !== 'admin') return <LoadingSkeleton variant="form" label="Verificando acceso…" />

  const recargar = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.catalogos }),
        client.invalidateQueries({ queryKey: queryKeys.slaConfig }),
        client.invalidateQueries({ queryKey: queryKeys.configuraciones }),
        client.invalidateQueries({ queryKey: queryKeys.permisos }),
      ])
    } finally { setRefreshing(false) }
  }

  return <div className="flex h-full min-h-0 flex-col">
    <PageHeader title="Configuración" />
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:grid-rows-1">
      <nav aria-label="Secciones de configuración" className="ui-panel overflow-y-auto p-3 lg:overscroll-contain">
        <div className="lg:hidden"><Field id="settings-mobile-section" label="Sección de configuración">
          <Select id="settings-mobile-section" value={section} onChange={event => setSection(event.target.value as Section)}>
            {groups.map(group => <optgroup key={group} label={group}>{sections.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
          </Select>
        </Field></div>
        <div className="hidden lg:block">{groups.map(group => <div key={group} className="mb-3 last:mb-0">
          <p className="mb-1.5 px-3 text-xs font-medium text-qms-muted">{group}</p>
          <div className="flex flex-wrap gap-1 lg:flex-col">{sections.filter(item => item.group === group).map(item => {
            const ItemIcon = item.icon
            return <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined}
              aria-controls={`settings-panel-${item.id}`} onClick={() => setSection(item.id)}
              className={`flex items-start gap-2.5 rounded-card border px-3 py-2.5 text-left text-sm lg:w-full ${section === item.id ? 'border-qms-primary/20 bg-qms-primary-soft text-qms-primary' : 'border-transparent bg-transparent text-qms-muted hover:bg-qms-hover-bg hover:text-qms-dark'}`}>
              <ItemIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </button>
          })}</div>
        </div>)}</div>
      </nav>
      <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-1">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-qms-primary-soft text-qms-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 id="settings-section-title" className="text-xl font-medium text-qms-dark">{selected.label}</h2><p className="mt-1 text-sm text-qms-muted">{selected.description}</p></div>
          </div>
          {section !== 'ia' && section !== 'vistas' && <Button size="sm" variant="secondary" loading={refreshing} loadingLabel="Actualizando datos…" onClick={() => void recargar()}>{!refreshing && <RotateCcw className="h-4 w-4" aria-hidden="true" />} Actualizar datos</Button>}
        </div>
        {sections.map(item => {
          const Panel = item.component
          return <div key={item.id} id={`settings-panel-${item.id}`} role="region" aria-labelledby="settings-section-title" hidden={section !== item.id}>
            <DeferredMount active={section === item.id}><Panel active={section === item.id} /></DeferredMount>
          </div>
        })}
      </div>
    </div>
  </div>
}

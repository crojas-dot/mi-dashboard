/**
 * Sidebar — menú lateral de navegación.
 * Lee los módulos y grupos de lib/constants/modulos.ts (fuente única).
 * Filtra enlaces visibles con tienePermiso() según el rol del usuario.
 * Precarga datos del módulo destino con hover/focus (prefetchMap + useHoverPrefetch).
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { QueryFunctionContext } from '@tanstack/react-query'
import {
  ChartPie, MessageSquareText, FolderOpen, ListChecks,
  ShieldAlert, ClipboardCheck, Presentation, Workflow, Inbox,
  UsersRound, Settings2, ChartNoAxesCombined, ChevronLeft, ChevronRight,
  X, type LucideIcon,
} from 'lucide-react'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso } from '@/lib/permisos'
import { MODULOS, GRUPOS_NAVEGACION, type ModuloId, type ModuloIconKey } from '@/lib/constants/modulos'
import { useHoverPrefetch, type PrefetchConfig } from '@/hooks/useHoverPrefetch'
import { fetchQuejas, quejasKey } from '@/lib/queries/useQuejas'
import { paginaKey } from '@/lib/queries/pagination'
import { fetchDocumentos, documentosKey } from '@/lib/queries/useDocumentos'
import { fetchAcciones, accionesKey } from '@/lib/queries/useSACP'
import { fetchRiesgos, riesgosKey } from '@/lib/queries/useRiesgos'
import { fetchAuditorias, auditoriasKey } from '@/lib/queries/useAuditorias'
import { fetchReuniones, reunionesKey } from '@/lib/queries/useReuniones'
import { fetchProcesos, procesosKey } from '@/lib/queries/useProcesos'
import { fetchUsuarios, usuariosQueryKey } from '@/lib/queries/useUsuarios'
import { dashboardPrefetchOptions } from '@/lib/queries/useDashboard'

// Los iconos viven en UI: el registro compartido no incorpora Lucide al servidor.
const ICONOS_MODULO: Record<ModuloIconKey, LucideIcon> = {
  chartPie: ChartPie, messageSquareText: MessageSquareText, inbox: Inbox,
  folderOpen: FolderOpen, listChecks: ListChecks, shieldAlert: ShieldAlert,
  clipboardCheck: ClipboardCheck, presentation: Presentation, workflow: Workflow,
  usersRound: UsersRound, settings2: Settings2, chartNoAxesCombined: ChartNoAxesCombined,
}
const sections = GRUPOS_NAVEGACION.map(section => ({
  label: section.label,
  links: section.modulos.map(id => ({
    id,
    href: MODULOS[id].ruta,
    label: MODULOS[id].label,
    icon: ICONOS_MODULO[MODULOS[id].iconKey],
  })),
}))

const prefetchMap: Partial<Record<ModuloId, PrefetchConfig | PrefetchConfig[]>> = {
  dashboard:  dashboardPrefetchOptions(),
  quejas:     { queryKey: quejasKey({ page: 0, pageSize: 25 }), queryFn: ({ signal }) => fetchQuejas({ page: 0, pageSize: 25 }, signal) },
  documentos: { queryKey: paginaKey(documentosKey), queryFn: ({ signal }) => fetchDocumentos(0, '', signal) },
  sacp:       { queryKey: paginaKey(accionesKey), queryFn: ({ signal }) => fetchAcciones(0, '', signal) },
  riesgos:    { queryKey: paginaKey(riesgosKey), queryFn: ({ signal }) => fetchRiesgos(0, '', signal) },
  auditorias: { queryKey: paginaKey(auditoriasKey), queryFn: ({ signal }) => fetchAuditorias(0, '', signal) },
  revision:   { queryKey: paginaKey(reunionesKey), queryFn: ({ signal }) => fetchReuniones(0, '', signal) },
  procesos:   { queryKey: paginaKey(procesosKey), queryFn: ({ signal }) => fetchProcesos(0, '', signal) },
  usuarios:   { queryKey: usuariosQueryKey(), queryFn: ({ signal }) => fetchUsuarios(undefined, signal) },
}

export default function Sidebar({ expanded = false, onNavigate, className = '' }: { expanded?: boolean; onNavigate?: () => void; className?: string } = {}) {
  const pathname = usePathname()
  const { collapsed: storedCollapsed, toggle } = useSidebarStore()
  const collapsed = expanded ? false : storedCollapsed
  const user = useAuthStore((s) => s.user)
  const permisos = useAuthStore((s) => s.permisos)
  const prefetch = useHoverPrefetch()

  const prepareNavigation = (id: ModuloId) => {
    const config = id === 'mis_quejas' && user?.id
      ? { queryKey: quejasKey({ responsableId: user.id }), queryFn: ({ signal }: QueryFunctionContext) => fetchQuejas({ responsableId: user.id }, signal) }
      : prefetchMap[id]
    if (config) prefetch(config)
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-[250px]'} bg-qms-dark ${className}`}
    >
      <div className={`flex shrink-0 items-center justify-between px-3 ${expanded ? 'h-14 border-b border-white/10' : 'pt-3 pb-1'}`}>
        {!collapsed ? (
          <>
            <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 no-underline">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-qms-primary text-xs font-bold text-white">E</div>
              <div className="text-[17px] font-bold text-white">ECA-QMS</div>
            </Link>
            <button
              type="button"
              onClick={onNavigate ?? toggle}
              aria-label={onNavigate ? 'Cerrar menú de navegación' : 'Colapsar menú'}
              title={onNavigate ? 'Cerrar menú' : 'Colapsar menú'}
              className={`flex shrink-0 items-center justify-center rounded-card bg-transparent transition-colors hover:bg-white/[0.08] hover:text-white ${expanded ? 'h-11 w-11 text-white/70' : 'h-7 w-7 border border-white/10 text-white/35 hover:border-white/25'}`}
            >
              {expanded ? <X className="h-5 w-5" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
          </>
        ) : (
          <button
            onClick={toggle}
            title="Expandir menú"
            className="mx-auto mt-3 mb-1 flex h-7 w-7 items-center justify-center rounded-card border border-white/10 bg-transparent text-white/35 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white/70"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {!expanded && <hr className="mx-3 my-1.5 border-0 border-t border-white/10" />}

       <nav aria-label="Navegación principal" className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 ${expanded ? 'py-3' : ''}`}>
         {sections.map((section) => {
           const linksVisibles = section.links.filter((link) => tienePermiso(permisos, link.id, false, user?.rol))
           if (linksVisibles.length === 0) return null
           return (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {section.label}
              </p>
            )}
            {linksVisibles.map((link) => {
              const isActive = pathname === link.href
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  aria-label={link.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onNavigate}
                  className={`my-0.5 flex items-center gap-2.5 rounded-button py-2.5 text-base leading-6 no-underline transition-colors ${collapsed ? 'justify-center px-0' : 'px-[15px]'} ${isActive ? 'bg-qms-primary text-white' : 'text-white/75 hover:bg-qms-primary hover:text-white'}`}
                  onMouseEnter={() => prepareNavigation(link.id)}
                  onFocus={() => prepareNavigation(link.id)}
                  onTouchStart={() => prepareNavigation(link.id)}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              )
            })}
          </div>
           )
         })}
      </nav>

      {!expanded && <hr className="mx-3 my-1.5 border-0 border-t border-white/10" />}
    </aside>
  )
}

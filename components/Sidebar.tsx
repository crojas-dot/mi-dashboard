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
  UsersRound, Settings2, ChartNoAxesCombined, X, type LucideIcon,
} from 'lucide-react'
import EmpresaLogo from '@/components/EmpresaLogo'
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
  const { collapsed: storedCollapsed } = useSidebarStore()
  const collapsed = expanded ? false : storedCollapsed
  const user = useAuthStore((s) => s.user)
  const permisos = useAuthStore((s) => s.permisos)
  const prefetch = useHoverPrefetch()

  const prepareNavigation = (id: ModuloId) => {
    const config = id === 'mis_quejas' && user?.id
      ? { queryKey: quejasKey({ responsableId: user.id, soloFolio: true }), queryFn: ({ signal }: QueryFunctionContext) => fetchQuejas({ responsableId: user.id, soloFolio: true }, signal) }
      : prefetchMap[id]
    if (config) prefetch(config)
  }

  return (
    <aside
      id={expanded ? 'qms-mobile-navigation' : 'qms-main-sidebar'}
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-qms-dark text-white transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${collapsed ? 'w-16' : 'w-[250px]'} ${className}`}
    >
      <div className={`flex h-14 shrink-0 items-center ${expanded ? 'justify-between border-b border-white/10' : ''}`}>
        <Link href="/" onClick={onNavigate} aria-label="Ir al inicio" className="flex h-14 w-max shrink-0 items-center gap-2 pl-[18px] no-underline">
          <EmpresaLogo className="h-8 w-8 text-xs" />
          <span aria-hidden={collapsed} className={`block shrink-0 overflow-hidden whitespace-nowrap text-[17px] font-bold text-white transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
            ECA-QMS
          </span>
        </Link>
        {expanded && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Cerrar menú de navegación"
            title="Cerrar menú"
            className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-button text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {!expanded && <hr className="mx-3 border-0 border-t border-white/10" />}

       <nav aria-label="Navegación principal" className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pt-3 ${expanded ? 'pb-3' : ''}`}>
         {sections.map((section) => {
           const linksVisibles = section.links.filter((link) => tienePermiso(permisos, link.id, false, user?.rol))
           if (linksVisibles.length === 0) return null
           return (
          <div key={section.label} className="mb-2">
            <p aria-hidden={collapsed} className={`overflow-hidden whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50 transition-[max-height,opacity,margin] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? 'mb-0 max-h-0 opacity-0' : 'mb-1 max-h-7 opacity-100'}`}>
              {section.label}
            </p>
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
                  className={`my-0.5 flex h-11 items-center gap-2.5 overflow-hidden rounded-button pl-[15px] pr-2 text-base leading-6 no-underline transition-[width,background-color,color] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? 'w-12' : 'w-full'} ${isActive ? 'bg-qms-primary text-white' : 'text-white/75 hover:bg-qms-primary hover:text-white'}`}
                  onMouseEnter={() => prepareNavigation(link.id)}
                  onFocus={() => prepareNavigation(link.id)}
                  onTouchStart={() => prepareNavigation(link.id)}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span aria-hidden={collapsed} className={`block shrink-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[165px] opacity-100'}`}>{link.label}</span>
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

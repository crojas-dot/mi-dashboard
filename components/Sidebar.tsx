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
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react'
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

// SVG originales de CoreUI; máscara monocromática para heredar el color del menú.
const ICONOS_MODULO: Record<ModuloIconKey, string> = {
  chartPie: 'cil-speedometer',
  messageSquareText: 'cil-speech',
  inbox: 'cil-inbox',
  folderOpen: 'cil-folder-open',
  listChecks: 'cil-task',
  shieldAlert: 'cil-shield-alt',
  clipboardCheck: 'cil-list',
  presentation: 'cil-description',
  workflow: 'cil-layers',
  usersRound: 'cil-people',
  settings2: 'cil-settings',
  chartNoAxesCombined: 'cil-chart-line',
}

function CoreUIIcon({ name }: { name: string }) {
  const mask = `url("/coreui-icons/${name}.svg")`
  return (
    <span
      aria-hidden="true"
      className="coreui-nav-icon h-5 w-5 shrink-0"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  )
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
      ? { queryKey: quejasKey({ responsableId: user.id, soloFolio: true }), queryFn: ({ signal }: QueryFunctionContext) => fetchQuejas({ responsableId: user.id, soloFolio: true }, signal) }
      : prefetchMap[id]
    if (config) prefetch(config)
  }

  return (
    <aside
      className={`coreui-sidebar flex h-full shrink-0 flex-col text-white transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-[270px]'} ${className}`}
    >
      <div className="coreui-sidebar-brand flex h-[68px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
        {!collapsed ? (
          <>
            <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
              <EmpresaLogo className="h-10 w-10 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[17px] font-bold tracking-[0.025em] text-white">ECA-QMS</span>
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a6b4ca]">Gestión de calidad</span>
              </span>
            </Link>
            {expanded && <button type="button" aria-label="Cerrar menú" title="Cerrar menú" onClick={onNavigate} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#bbc5d5] hover:bg-white/10 hover:text-white"><X className="h-5 w-5" aria-hidden="true" /></button>}
          </>
        ) : (
          <Link href="/" aria-label="Inicio de ECA-QMS" title="Inicio" className="mx-auto flex items-center justify-center" onClick={onNavigate}><EmpresaLogo className="h-10 w-10" /></Link>
        )}
      </div>

      <nav aria-label="Navegación principal" className="coreui-sidebar-nav min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-5">
        {sections.map((section, index) => {
          const linksVisibles = section.links.filter(link => tienePermiso(permisos, link.id, false, user?.rol))
          if (linksVisibles.length === 0) return null
          return (
            <div key={section.label} className={`coreui-sidebar-group ${index > 0 ? 'mt-4 border-t border-white/[0.07] pt-4' : ''}`}>
              {!collapsed && (
                <p className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8997aa]">{section.label}</p>
              )}
              {linksVisibles.map(link => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href + '/'))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.label}
                    aria-label={link.label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onNavigate}
                    className={`coreui-nav-item relative my-1 flex items-center gap-3 rounded-md py-[11px] no-underline ${collapsed ? 'justify-center px-0' : 'px-3.5'} ${isActive ? 'coreui-nav-item--active' : ''}`}
                    onMouseEnter={() => prepareNavigation(link.id)}
                    onFocus={() => prepareNavigation(link.id)}
                    onTouchStart={() => prepareNavigation(link.id)}
                  >
                    <CoreUIIcon name={link.icon} />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{link.label}</span>}
                    {!collapsed && isActive && <span aria-hidden="true" className="coreui-active-indicator h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="coreui-sidebar-footer shrink-0 border-t border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[12px] font-bold tracking-wide text-white">ECA</span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#ecf1f8]">Sistema institucional</p>
              <p className="truncate text-[11px] text-[#99a8be]">Panel de administración</p>
            </div>
          </div>
        )}
        {!expanded && (
          <button type="button" onClick={toggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`flex h-[46px] w-full items-center gap-3 text-[12px] font-medium text-[#a8b4c8] transition-colors hover:bg-white/[0.065] hover:text-white ${collapsed ? 'justify-center px-0' : 'justify-end px-5'}`}>
            {!collapsed && <span>Contraer menú</span>}
            {collapsed ? <ChevronsRight className="h-5 w-5" aria-hidden="true" /> : <ChevronsLeft className="h-5 w-5" aria-hidden="true" />}
          </button>
        )}
      </div>
    </aside>
  )
}

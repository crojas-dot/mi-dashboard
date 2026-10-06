'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChartPie, MessageSquareText, FolderOpen, ListChecks,
  ShieldAlert, ClipboardCheck, Presentation, Workflow, Inbox,
  UsersRound, Settings2, ChartNoAxesCombined, ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso, moduloDeRuta } from '@/lib/permisos'
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

// Iconos del menú: misma familia Lucide, tamaño y grosor definidos en el render.
const sections: { label: string; links: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Gestión',
    links: [
      { href: '/', label: 'Dashboard', icon: ChartPie },
      { href: '/quejas', label: 'Quejas', icon: MessageSquareText },
      { href: '/mis-quejas', label: 'Mis Quejas', icon: Inbox },
      { href: '/documentos', label: 'Documentos', icon: FolderOpen },
      { href: '/sacp', label: 'SACP', icon: ListChecks },
    ],
  },
  {
    label: 'Seguimiento',
    links: [
      { href: '/riesgos', label: 'Riesgos', icon: ShieldAlert },
      { href: '/auditorias', label: 'Auditorías', icon: ClipboardCheck },
      { href: '/revision', label: 'Revisión por Dirección', icon: Presentation },
      { href: '/procesos', label: 'Procesos', icon: Workflow },
    ],
  },
  {
    label: 'Administración',
    links: [
      { href: '/usuarios', label: 'Usuarios', icon: UsersRound },
      { href: '/reporteria', label: 'Reportería', icon: ChartNoAxesCombined },
      { href: '/configuracion', label: 'Configuración', icon: Settings2 },
    ],
  },
]

const prefetchMap: Record<string, PrefetchConfig | PrefetchConfig[]> = {
  '/':           dashboardPrefetchOptions(),
  '/quejas':     { queryKey: quejasKey({ page: 0, pageSize: 25 }), queryFn: () => fetchQuejas({ page: 0, pageSize: 25 }) },
  '/documentos': { queryKey: paginaKey(documentosKey), queryFn: () => fetchDocumentos() },
  '/sacp':       { queryKey: paginaKey(accionesKey), queryFn: () => fetchAcciones() },
  '/riesgos':    { queryKey: paginaKey(riesgosKey), queryFn: () => fetchRiesgos() },
  '/auditorias': { queryKey: paginaKey(auditoriasKey), queryFn: () => fetchAuditorias() },
  '/revision':   { queryKey: paginaKey(reunionesKey), queryFn: () => fetchReuniones() },
  '/procesos':   { queryKey: paginaKey(procesosKey), queryFn: () => fetchProcesos() },
  '/usuarios':   { queryKey: usuariosQueryKey(), queryFn: () => fetchUsuarios() },
  '/reporteria': { queryKey: ['reporteria'], queryFn: () => Promise.resolve([]) },
}

export default function Sidebar({ expanded = false, onNavigate, className = '' }: { expanded?: boolean; onNavigate?: () => void; className?: string } = {}) {
  const pathname = usePathname()
  const { collapsed: storedCollapsed, toggle } = useSidebarStore()
  const collapsed = expanded ? false : storedCollapsed
  const user = useAuthStore((s) => s.user)
  const permisos = useAuthStore((s) => s.permisos)
  const prefetch = useHoverPrefetch()

  return (
    <aside
      className={`flex h-full shrink-0 flex-col text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-[250px]'} bg-qms-dark ${className}`}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        {!collapsed ? (
          <>
            <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 no-underline">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-qms-primary text-xs font-bold text-white">E</div>
              <div className="text-[17px] font-bold text-white">ECA-QMS</div>
            </Link>
            <button
              onClick={onNavigate ?? toggle}
              title={onNavigate ? 'Cerrar menú' : 'Colapsar menú'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card border border-white/10 bg-transparent text-white/35 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white/70"
            >
              <ChevronLeft className="h-4 w-4" />
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

      <hr className="mx-3 my-1.5 border-0 border-t border-white/10" />

       <nav className="flex-1 overflow-y-auto px-2">
         {sections.map((section) => {
           const linksVisibles = section.links.filter((link) => tienePermiso(permisos, moduloDeRuta(link.href), false, user?.rol))
           if (linksVisibles.length === 0) return null
           return (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">
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
                  onMouseEnter={() => {
                    const cfg = prefetchMap[link.href]
                    if (cfg) prefetch(cfg)
                  }}
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

      <hr className="mx-3 my-1.5 border-0 border-t border-white/10" />
    </aside>
  )
}

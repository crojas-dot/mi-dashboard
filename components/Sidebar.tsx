'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquareWarning, FileCheck2, ClipboardList, ShieldAlert,
  ClipboardCheck, SearchCheck, Workflow, Inbox, BadgeCheck, SlidersHorizontal,
  BarChart2, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso, moduloDeRuta } from '@/lib/permisos'
import { useHoverPrefetch } from '@/hooks/useHoverPrefetch'
import { fetchQuejas, quejasKey } from '@/lib/queries/useQuejas'
import { fetchDocumentos, documentosKey } from '@/lib/queries/useDocumentos'
import { fetchAcciones, accionesKey } from '@/lib/queries/useSACP'
import { fetchRiesgos, riesgosKey } from '@/lib/queries/useRiesgos'
import { fetchAuditorias, auditoriasKey } from '@/lib/queries/useAuditorias'
import { fetchReuniones, reunionesKey } from '@/lib/queries/useReuniones'
import { fetchProcesos, procesosKey } from '@/lib/queries/useProcesos'
import { fetchUsuarios, usuariosKey } from '@/lib/queries/useUsuarios'
import { fetchDashboard, dashboardKey } from '@/lib/queries/useDashboard'

const sections = [
  { label: 'Gestión', links: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/quejas', label: 'Quejas', icon: MessageSquareWarning },
    { href: '/mis-quejas', label: 'Mis Quejas', icon: Inbox },
    { href: '/documentos', label: 'Documentos', icon: FileCheck2 },
    { href: '/sacp', label: 'SACP', icon: ClipboardList },
  ]},
  { label: 'Seguimiento', links: [
    { href: '/riesgos', label: 'Riesgos', icon: ShieldAlert },
    { href: '/auditorias', label: 'Auditorías', icon: ClipboardCheck },
    { href: '/revision', label: 'Revisión por Dirección', icon: SearchCheck },
    { href: '/procesos', label: 'Procesos', icon: Workflow },
  ]},
  { label: 'Administración', links: [
    { href: '/usuarios', label: 'Usuarios', icon: BadgeCheck },
    { href: '/reporteria', label: 'Reportería', icon: BarChart2 },
    { href: '/configuracion', label: 'Configuración', icon: SlidersHorizontal },
  ]},
]

const prefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => PromiseLike<unknown> }> = {
  '/': { queryKey: dashboardKey, queryFn: fetchDashboard },
  '/quejas': { queryKey: quejasKey({ page: 0, pageSize: 25 }), queryFn: () => fetchQuejas({ page: 0, pageSize: 25 }) },
  '/documentos': { queryKey: documentosKey, queryFn: fetchDocumentos },
  '/sacp': { queryKey: accionesKey, queryFn: fetchAcciones },
  '/riesgos': { queryKey: riesgosKey, queryFn: fetchRiesgos },
  '/auditorias': { queryKey: auditoriasKey, queryFn: fetchAuditorias },
  '/revision': { queryKey: reunionesKey, queryFn: fetchReuniones },
  '/procesos': { queryKey: procesosKey, queryFn: fetchProcesos },
  '/usuarios': { queryKey: usuariosKey, queryFn: fetchUsuarios },
  '/reporteria': { queryKey: ['reporteria'], queryFn: () => Promise.resolve([]) },
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarStore()
  const { user, permisos } = useAuthStore()
  const prefetch = useHoverPrefetch()

  const content = (
    <aside className={`flex h-screen flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 ${collapsed ? 'lg:w-20' : 'lg:w-64'} w-72`}>
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-white">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground shadow-sm">E</span>
          {!collapsed && <span className="truncate text-base font-semibold tracking-tight text-white">ECA-QMS</span>}
        </Link>
        <button type="button" onClick={onMobileClose} className="flex size-10 items-center justify-center rounded-lg text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white lg:hidden" aria-label="Cerrar navegación">
          <X className="size-5" />
        </button>
        <button type="button" onClick={toggle} className="hidden size-9 items-center justify-center rounded-lg border border-white/10 text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-white lg:flex" aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}>
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        {sections.map((section) => {
          const visible = section.links.filter((link) => tienePermiso(permisos, moduloDeRuta(link.href), false, user?.rol))
          if (!visible.length) return null
          return (
            <div key={section.label} className="flex flex-col gap-1 pb-5">
              {!collapsed && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sidebar-muted)]">{section.label}</p>}
              {visible.map((link) => {
                const active = pathname === link.href
                const Icon = link.icon
                return (
                  <Link key={link.href} href={link.href} title={collapsed ? link.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${active ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)] shadow-sm' : 'text-[var(--sidebar-foreground)] hover:bg-white/10 hover:text-white'}`}
                    onMouseEnter={() => { const cfg = prefetchMap[link.href]; if (cfg) prefetch(cfg) }}>
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>
      {!collapsed && <div className="border-t border-white/10 px-5 py-4 text-xs leading-relaxed text-[var(--sidebar-muted)]">Sistema de Gestión de Calidad</div>}
    </aside>
  )

  return (
    <>
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{content}</div>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onMobileClose} aria-label="Cerrar navegación" /> <div className="relative h-full w-72 shadow-2xl">{content}</div></div>}
    </>
  )
}

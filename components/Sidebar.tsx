'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquareWarning, FileCheck2, ClipboardList,
  ShieldAlert, ClipboardCheck, SearchCheck, Workflow, Inbox,
  BadgeCheck, SlidersHorizontal, BarChart2, ChevronLeft, ChevronRight,
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

const sections: { label: string; links: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: 'Gestión',
    links: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/quejas', label: 'Quejas', icon: MessageSquareWarning },
      { href: '/mis-quejas', label: 'Mis Quejas', icon: Inbox },
      { href: '/documentos', label: 'Documentos', icon: FileCheck2 },
      { href: '/sacp', label: 'SACP', icon: ClipboardList },
    ],
  },
  {
    label: 'Seguimiento',
    links: [
      { href: '/riesgos', label: 'Riesgos', icon: ShieldAlert },
      { href: '/auditorias', label: 'Auditorías', icon: ClipboardCheck },
      { href: '/revision', label: 'Revisión por Dirección', icon: SearchCheck },
      { href: '/procesos', label: 'Procesos', icon: Workflow },
    ],
  },
  {
    label: 'Administración',
    links: [
      { href: '/usuarios', label: 'Usuarios', icon: BadgeCheck },
      { href: '/reporteria', label: 'Reportería', icon: BarChart2 },
      { href: '/configuracion', label: 'Configuración', icon: SlidersHorizontal },
    ],
  },
]

const prefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => PromiseLike<unknown> }> = {
  '/':           { queryKey: dashboardKey, queryFn: fetchDashboard },
  '/quejas':     { queryKey: quejasKey({ page: 0, pageSize: 25 }), queryFn: () => fetchQuejas({ page: 0, pageSize: 25 }) },
  '/documentos': { queryKey: documentosKey, queryFn: fetchDocumentos },
  '/sacp':       { queryKey: accionesKey, queryFn: fetchAcciones },
  '/riesgos':    { queryKey: riesgosKey, queryFn: fetchRiesgos },
  '/auditorias': { queryKey: auditoriasKey, queryFn: fetchAuditorias },
  '/revision':   { queryKey: reunionesKey, queryFn: fetchReuniones },
  '/procesos':   { queryKey: procesosKey, queryFn: fetchProcesos },
  '/usuarios':   { queryKey: usuariosKey, queryFn: fetchUsuarios },
  '/reporteria': { queryKey: ['reporteria'], queryFn: () => Promise.resolve([]) },
}

export default function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarStore()
  const { user, permisos } = useAuthStore()
  const prefetch = useHoverPrefetch()

  return (
    <aside
      className={`flex flex-col text-white shrink-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[250px]'
      }`}
      style={{ backgroundColor: '#212529' }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        {!collapsed ? (
          <>
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div className="flex items-center justify-center rounded-lg font-bold text-white shrink-0" style={{ width: '28px', height: '28px', backgroundColor: '#0d6efd', fontSize: '12px' }}>E</div>
              <div className="font-bold text-white" style={{ fontSize: '15px' }}>ECA-QMS</div>
            </Link>
            <button
              onClick={toggle}
              title="Colapsar menú"
              className="flex items-center justify-center rounded-lg transition-colors shrink-0"
              style={{ width: '28px', height: '28px', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            >
              <ChevronLeft style={{ width: '16px', height: '16px' }} />
            </button>
          </>
        ) : (
          <button
            onClick={toggle}
            title="Expandir menú"
            className="flex items-center justify-center rounded-lg transition-colors mx-auto"
            style={{ width: '28px', height: '28px', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: 'transparent', marginTop: '12px', marginBottom: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
          >
            <ChevronRight style={{ width: '16px', height: '16px' }} />
          </button>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 12px' }} />

       <nav className="flex-1 overflow-y-auto px-2">
         {sections.map((section) => {
           const linksVisibles = section.links.filter((link) => tienePermiso(permisos, moduloDeRuta(link.href), false, user?.rol))
           if (linksVisibles.length === 0) return null
           return (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
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
                  className={`flex items-center no-underline ${
                    collapsed ? 'justify-center' : ''
                  }`}
                  style={{
                    padding: collapsed ? '10px 0' : '10px 15px',
                    borderRadius: '5px',
                    margin: '3px 0',
                    fontSize: collapsed ? undefined : '0.95rem',
                    color: isActive ? '#fff' : 'rgba(255,255,255,.75)',
                    backgroundColor: isActive ? '#0d6efd' : 'transparent',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#0d6efd';
                      e.currentTarget.style.color = '#fff';
                    }
                    const cfg = prefetchMap[link.href]
                    if (cfg) prefetch(cfg)
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,.75)';
                    }
                  }}
                >
                  <Icon className="shrink-0" style={{ width: collapsed ? '20px' : '16px', height: collapsed ? '20px' : '16px' }} />
                  {!collapsed && <span className="truncate">{link.label}</span>}
                </Link>
              )
            })}
          </div>
           )
         })}
      </nav>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 12px' }} />
    </aside>
  )
}

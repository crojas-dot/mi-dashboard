import type { LucideIcon } from 'lucide-react'

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon | (() => Promise<LucideIcon>)
  modulo?: string
}

export interface NavSection {
  label: string
  links: NavLink[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Gestión',
    links: [
      { href: '/', label: 'Dashboard', icon: () => import('lucide-react').then(m => m.LayoutDashboard), modulo: 'dashboard' },
      { href: '/quejas', label: 'Quejas', icon: () => import('lucide-react').then(m => m.MessageSquareWarning), modulo: 'quejas' },
      { href: '/mis-quejas', label: 'Mis Quejas', icon: () => import('lucide-react').then(m => m.Inbox), modulo: 'mis_quejas' },
      { href: '/documentos', label: 'Documentos', icon: () => import('lucide-react').then(m => m.FileCheck2), modulo: 'documentos' },
      { href: '/sacp', label: 'SACP', icon: () => import('lucide-react').then(m => m.ClipboardList), modulo: 'sacp' },
    ],
  },
  {
    label: 'Seguimiento',
    links: [
      { href: '/riesgos', label: 'Riesgos', icon: () => import('lucide-react').then(m => m.ShieldAlert), modulo: 'riesgos' },
      { href: '/auditorias', label: 'Auditorías', icon: () => import('lucide-react').then(m => m.ClipboardCheck), modulo: 'auditorias' },
      { href: '/revision', label: 'Revisión por Dirección', icon: () => import('lucide-react').then(m => m.SearchCheck), modulo: 'revision' },
      { href: '/procesos', label: 'Procesos', icon: () => import('lucide-react').then(m => m.Workflow), modulo: 'procesos' },
    ],
  },
  {
    label: 'Administración',
    links: [
      { href: '/usuarios', label: 'Usuarios', icon: () => import('lucide-react').then(m => m.BadgeCheck), modulo: 'usuarios' },
      { href: '/reporteria', label: 'Reportería', icon: () => import('lucide-react').then(m => m.BarChart2), modulo: 'reporteria' },
      { href: '/configuracion', label: 'Configuración', icon: () => import('lucide-react').then(m => m.SlidersHorizontal), modulo: 'configuracion' },
    ],
  },
]

export interface PrefetchConfig {
  queryKey: readonly unknown[]
  queryFn: () => PromiseLike<unknown>
}

export const PREFETCH_MAP: Record<string, PrefetchConfig> = {
  '/': { queryKey: ['dashboard'], queryFn: () => import('@/lib/queries/useDashboard').then(m => m.fetchDashboard()) },
  '/quejas': { queryKey: ['quejas', { page: 0, pageSize: 25 }], queryFn: () => import('@/lib/queries/useQuejas').then(m => m.fetchQuejas({ page: 0, pageSize: 25 })) },
  '/documentos': { queryKey: ['documentos'], queryFn: () => import('@/lib/queries/useDocumentos').then(m => m.fetchDocumentos()) },
  '/sacp': { queryKey: ['acciones'], queryFn: () => import('@/lib/queries/useSACP').then(m => m.fetchAcciones()) },
  '/riesgos': { queryKey: ['riesgos'], queryFn: () => import('@/lib/queries/useRiesgos').then(m => m.fetchRiesgos()) },
  '/auditorias': { queryKey: ['auditorias'], queryFn: () => import('@/lib/queries/useAuditorias').then(m => m.fetchAuditorias()) },
  '/revision': { queryKey: ['reuniones'], queryFn: () => import('@/lib/queries/useReuniones').then(m => m.fetchReuniones()) },
  '/procesos': { queryKey: ['procesos'], queryFn: () => import('@/lib/queries/useProcesos').then(m => m.fetchProcesos()) },
  '/usuarios': { queryKey: ['usuarios'], queryFn: () => import('@/lib/queries/useUsuarios').then(m => m.fetchUsuarios()) },
  '/reporteria': { queryKey: ['reporteria'], queryFn: () => Promise.resolve([]) },
}
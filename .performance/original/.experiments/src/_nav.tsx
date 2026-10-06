import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilInbox,
  cilTask,
  cilDescription,
  cilListRich,
  cilShieldAlt,
  cilCheckCircle,
  cilZoom,
  cilSitemap,
  cilFolder,
  cilChartBar,
  cilSettings,
  cilUser,
} from '@coreui/icons'
import { CNavItem, CNavTitle } from '@coreui/react'

interface NavEntry {
  component: React.ComponentType<{ as?: React.ElementType; children?: React.ReactNode }>
  name: React.ReactNode
  to?: string
  icon?: React.ReactNode
  badge?: { color: string; text: string }
}

const navigation: NavEntry[] = [
  {
    component: CNavTitle,
    name: 'Gestión',
  },
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Quejas',
    to: '/quejas',
    icon: <CIcon icon={cilInbox} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Mis Quejas',
    to: '/mis-quejas',
    icon: <CIcon icon={cilTask} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Documentos',
    to: '/documentos',
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'SACP',
    to: '/sacp',
    icon: <CIcon icon={cilListRich} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavTitle,
    name: 'Seguimiento',
  },
  {
    component: CNavItem,
    name: 'Riesgos',
    to: '/riesgos',
    icon: <CIcon icon={cilShieldAlt} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Auditorías',
    to: '/auditorias',
    icon: <CIcon icon={cilCheckCircle} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Revisión por Dirección',
    to: '/revision',
    icon: <CIcon icon={cilZoom} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Procesos',
    to: '/procesos',
    icon: <CIcon icon={cilSitemap} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavTitle,
    name: 'Administración',
  },
  {
    component: CNavItem,
    name: 'Reportería',
    to: '/reporteria',
    icon: <CIcon icon={cilChartBar} customClassName="nav-icon" width={20} height={20} />,
  },
  {
    component: CNavItem,
    name: 'Configuración',
    to: '/configuracion',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" width={20} height={20} />,
  },
]

export default navigation
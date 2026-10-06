'use client'
import { CNav, CNavItem, CNavLink } from '@coreui/react'
import { Activity, ClipboardList, FileText, ShieldAlert, CheckCircle } from '@/components/ui/icons'

export type DashboardTab = 'general' | 'quejas' | 'sacp' | 'documentos' | 'riesgos'

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Activity size={16} /> },
  { id: 'quejas', label: 'Quejas', icon: <ClipboardList size={16} /> },
  { id: 'sacp', label: 'SACP', icon: <CheckCircle size={16} /> },
  { id: 'documentos', label: 'Documentos', icon: <FileText size={16} /> },
  { id: 'riesgos', label: 'Riesgos', icon: <ShieldAlert size={16} /> },
]

interface ModuleTabsProps {
  active: DashboardTab
  onChange: (tab: DashboardTab) => void
}

export default function ModuleTabs({ active, onChange }: ModuleTabsProps) {
  return (
    <CNav variant="underline-border" className="mb-4" role="tablist" aria-label="Módulos del dashboard">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <CNavItem key={tab.id}>
            <CNavLink
              as="button"
              type="button"
              role="tab"
              aria-selected={isActive}
              active={isActive}
              onClick={() => onChange(tab.id)}
              className="d-inline-flex align-items-center gap-2"
            >
              {tab.icon}
              {tab.label}
            </CNavLink>
          </CNavItem>
        )
      })}
    </CNav>
  )
}
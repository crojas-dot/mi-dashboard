'use client'
import { Tabs } from '@/components/ui/tailwind/Tabs'
import { Tab } from '@/components/ui/tailwind/Tabs'

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
    <Tabs variant="underline-border" className="tw:mb-6" role="tablist" aria-label="Módulos del dashboard">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <div key={tab.id}>
            <Tab
              as="button"
              type="button"
              role="tab"
              aria-selected={isActive}
              active={isActive}
              onClick={() => onChange(tab.id)}
              className="tw:inline-flex tw:items-center tw:gap-2"
            >
              {tab.icon}
              {tab.label}
            </Tab>
          </div>
        )
      })}
    </Tabs>
  )
}
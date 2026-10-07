'use client'

import { useState, type ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { useMobileNavigation } from '@/hooks/useMobileNavigation'

/** Solo presentación. AuthShell sigue administrando autenticación y permisos. */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const mobile = useMobileNavigation()
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!mobile && mobileOpen) setMobileOpen(false)

  return <div className="flex h-dvh overflow-hidden bg-qms-background">
    <a href="#app-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-button focus-visible:bg-qms-surface focus-visible:p-3 focus-visible:text-qms-primary">Saltar al contenido</a>
    <div className="hidden shrink-0 lg:block"><Sidebar /></div>
    <div className="flex min-w-0 flex-1 flex-col">
      <Header onOpenNavigation={() => setMobileOpen(true)} />
      <main id="app-content" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</main>
    </div>
    <Modal open={mobile && mobileOpen} onClose={() => setMobileOpen(false)} title="Menú de navegación" variant="drawer">
      <Sidebar expanded className="w-full!" onNavigate={() => setMobileOpen(false)} />
    </Modal>
  </div>
}

'use client'

import type { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { useMobileNavigation } from '@/hooks/useMobileNavigation'
import { cn } from '@/components/ui/tailwind/cn'

/** Estructura visual autenticada. AuthShell conserva permisos y redirecciones. */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const hidden = useSidebarStore((s) => s.hidden)
  const mobile = useMobileNavigation()
  const mobileOpen = useSidebarStore((s) => s.mobileOpen)
  return (
    <div className="tw:flex tw:min-h-screen tw:bg-background tw:font-sans tw:text-foreground">
      <a href="#app-content" className="tw:sr-only tw:focus:not-sr-only tw:focus:fixed tw:focus:left-4 tw:focus:top-4 tw:focus:z-[1100] tw:focus:rounded-md tw:focus:bg-surface tw:focus:p-3 tw:focus:text-primary">Saltar al contenido</a>
      <Sidebar />
      <div className={cn('tw:flex tw:min-w-0 tw:flex-1 tw:flex-col', !hidden && (collapsed ? 'tw:min-[992px]:pl-16' : 'tw:min-[992px]:pl-64'))}>
        <Header />
        <main id="app-content" tabIndex={-1} className={cn('tw:min-h-0 tw:flex-1 tw:bg-background tw:p-5 tw:min-[992px]:p-7 tw:[body:has(dialog:modal)_&]:overflow-hidden', mobile && mobileOpen ? 'tw:overflow-hidden' : 'tw:overflow-y-auto')}>{children}</main>
      </div>
    </div>
  )
}
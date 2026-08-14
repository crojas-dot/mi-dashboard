'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso, moduloDeRuta } from '@/lib/permisos'
import { Loader2 } from 'lucide-react'

const PUBLIC_PATHS = ['/login', '/q']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, permisos, loading, initialized, init } = useAuthStore()

  useEffect(() => { init() }, [init])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    if (!initialized || loading) return
    const isPublic = isPublicPath(pathname)
    if (!user && !isPublic) { router.replace('/login'); return }
    if (user && pathname === '/login') { router.replace('/'); return }
    if (user && !isPublic) {
      const modulo = moduloDeRuta(pathname)
      if (modulo && !tienePermiso(permisos, modulo, false, user.rol)) {
        const destino = tienePermiso(permisos, 'mis_quejas', false, user.rol) ? '/mis-quejas' : '/'
        if (destino !== pathname) router.replace(destino)
      }
    }
  }, [user, permisos, loading, initialized, pathname, router])

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Cargando aplicación">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      </div>
    )
  }

  const isPublic = isPublicPath(pathname)
  if (isPublic || !user) return <main>{children}</main>

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

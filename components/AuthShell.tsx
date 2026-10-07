'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { useAuthStore } from '@/lib/store/auth-store'
import { authRoute } from '@/lib/authRoute'
import SessionScreen from '@/components/SessionScreen'

const reloadSession = () => window.location.reload()

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const permisos = useAuthStore((s) => s.permisos)
  const loading = useAuthStore((s) => s.loading)
  const initialized = useAuthStore((s) => s.initialized)
  const signingOut = useAuthStore((s) => s.signingOut)
  const init = useAuthStore((s) => s.init)
  const logout = useAuthStore((s) => s.logout)
  const route = authRoute(pathname, { user, permisos, loading, initialized })

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (route.redirect) router.replace(route.redirect)
  }, [route.redirect, router])

  if (route.view === 'pending') return <SessionScreen
    label={signingOut ? 'Cerrando tu sesión' : route.redirect && user ? 'Abriendo tu espacio' : undefined}
    // El HTML prerenderizado aún no conoce la sesión. Reservar workspace
    // para una identidad ya validada, también durante redirecciones.
    layout={user && initialized && !loading && !signingOut ? 'workspace' : 'login'}
    onRetry={reloadSession}
  />
  if (route.view === 'denied') {
    return <SessionScreen denied label="Acceso no disponible"
      description="Tu cuenta no tiene acceso a este módulo. Contacta al administrador."
      onExit={() => void logout()} />
  }
  if (route.view === 'public') return <main>{children}</main>

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { useAuthStore } from '@/lib/store/auth-store'
import { authRoute } from '@/lib/authRoute'
import SessionScreen from '@/components/SessionScreen'
import QueryProvider from '@/lib/providers/QueryProvider'

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

  let content: React.ReactNode
  if (route.view === 'pending') {
    content = <SessionScreen
      label={signingOut ? 'Cerrando tu sesión' : route.redirect && user ? 'Abriendo tu espacio' : undefined}
      // La recarga privada aún no conoce sesión ni destino: no anticipar
      // login ni dashboard. El módulo tendrá su propia carga al autorizar.
      layout={signingOut || route.redirect === '/login' || pathname === '/login' && !user ? 'login' : 'neutral'}
      onRetry={reloadSession}
    />
  } else if (route.view === 'denied') {
    content = <SessionScreen denied label="Acceso no disponible"
      description="Tu cuenta no tiene acceso a este módulo. Contacta al administrador."
      onExit={() => void logout()} />
  } else if (route.view === 'public') {
    content = <main>{children}</main>
  } else {
    content = <AuthenticatedLayout>{children}</AuthenticatedLayout>
  }

  // Mantener el guard fuera del ámbito que se remonta por usuario/vista.
  // Un único provider conserva la caché también durante redirecciones.
  return <QueryProvider>{content}</QueryProvider>
}

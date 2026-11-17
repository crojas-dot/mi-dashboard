import { moduloDeRuta, tienePermiso, type Permiso } from '@/lib/permisos'

interface AuthRouteState {
  access?: { phase: string } | null
  initialized: boolean
  loading: boolean
  user: { rol: string } | null
  permisos: Permiso[]
}

/** La redirección es asíncrona: bloquear el contenido también durante la espera. */
export function authRoute(pathname: string, state: AuthRouteState) {
  const isPublic = ['/login', '/q','/acceso'].some(path => pathname === path || pathname.startsWith(path + '/'))
  if (!state.initialized || state.loading) return { view: 'pending' as const }
  if(state.access&&state.access.phase!=='ready') {
    return pathname==='/acceso'?{view:'public' as const}:{view:'pending' as const,redirect:'/acceso'}
  }
  if (isPublic) {
    if (pathname === '/login' && state.user) return { view: 'pending' as const, redirect: '/' }
    return { view: 'public' as const }
  }
  if (!state.user) return { view: 'pending' as const, redirect: '/login' }

  const modulo = moduloDeRuta(pathname)
  if (modulo && !tienePermiso(state.permisos, modulo, false, state.user.rol)) {
    const rol = state.user.rol
    const destination = ['/mis-quejas', '/'].find(path =>
      tienePermiso(state.permisos, moduloDeRuta(path), false, rol),
    )
    return destination && destination !== pathname
      ? { view: 'pending' as const, redirect: destination }
      : { view: 'denied' as const }
  }
  return { view: 'private' as const }
}

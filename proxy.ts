import { NextResponse, type NextRequest } from 'next/server'
import { getAuthToken, getCurrentUser } from '@/lib/server/auth'
import { authenticatesInRoute } from '@/lib/server/apiAuthentication'

const PUBLIC_PATHS = ['/login', '/q']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    || pathname === '/api/drive/upload-public'
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  // Un cliente nunca puede aportar identidad mediante estos encabezados.
  for (const name of ['x-user-id', 'x-user-role', 'x-user-email']) headers.delete(name)
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request: { headers } })
  if (!getAuthToken(request)) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  if (authenticatesInRoute(request.nextUrl.pathname, request.method)) {
    // El handler hace la validación completa una sola vez. No confía en
    // encabezados de identidad aportados por el cliente.
    return NextResponse.next({ request: { headers } })
  }
  // Una API nueva o un método no registrado conserva el guard completo.
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  headers.set('x-user-id', user.id)
  headers.set('x-user-role', user.rol)
  headers.set('x-user-email', user.email)
  // Las rutas conservan sus validaciones de token y autorización por entidad.
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/api/:path*'] }

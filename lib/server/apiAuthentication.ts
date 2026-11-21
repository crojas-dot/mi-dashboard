import 'server-only'

// Estos métodos validan token, perfil activo y autorización dentro del handler.
// Compartir este registro con la prueba de regresión evita repetir las dos
// llamadas a Supabase en el proxy y dejar un método nuevo sin validación.
export const API_WITH_ROUTE_AUTH: Record<string, readonly string[]> = {
  '/api/auth/acceso': ['GET','POST'],
  '/api/usuarios/acceso': ['POST'],
  '/api/usuarios': ['GET', 'POST', 'PATCH', 'DELETE'],
  '/api/perfil/avatar': ['GET', 'PUT', 'DELETE'],
  '/api/ai/analizar': ['POST'],
  '/api/ai/test': ['POST'],
  '/api/configuracion/ia': ['GET', 'PUT', 'POST'],
  '/api/configuracion/zona-horaria': ['GET', 'PUT'],
  '/api/configuracion/logo': ['GET', 'PUT', 'DELETE'],
  '/api/drive/upload': ['POST'],
  '/api/drive/download': ['GET'],
  '/api/drive/delete': ['DELETE'],
  '/api/quejas/seguimiento': ['GET', 'POST'],
  '/api/quejas/informe': ['GET', 'PUT'],
  '/api/quejas/historial': ['GET'],
  '/api/quejas/correos/reintentar': ['POST'],
}

export function authenticatesInRoute(pathname: string, method: string): boolean {
  return API_WITH_ROUTE_AUTH[pathname]?.includes(method) ?? false
}

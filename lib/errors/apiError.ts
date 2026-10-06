import { getUserError } from './userError'

export interface ApiError {
  message: string
  status?: number
  details?: string
}

export function normalizeApiError(error: unknown): ApiError {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const rawStatus = Number(source.status ?? source.statusCode)
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus
    : source.code === '42501' ? 403
    : ['PGRST301', 'PGRST302', 'PGRST303'].includes(String(source.code)) ? 401 : undefined
  const info = getUserError(error)
  const message = status === 401 || status === 403 ? 'No tienes permiso'
    : status === 404 ? 'Recurso no encontrado'
    : status === 429 ? 'Demasiadas solicitudes'
    : status && status >= 500 ? 'Error del servidor' : info.message
  // details solo conserva el código seguro, nunca el diagnóstico de Postgres.
  return { message, status, details: info.code }
}

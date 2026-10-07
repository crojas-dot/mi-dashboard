/** Mensajes compartidos por avisos, consultas y pantallas de recuperación.
 * Nunca mostrar details/hint/stack de Postgres o de proveedores externos.
 * Añadir aquí las causas conocidas, no traducciones distintas por pantalla.
 */
export interface UserError {
  message: string
  action: string
  code?: string
  retryable: boolean
}

export function getUserError(error: unknown, fallback = 'No se pudo completar la operación'): UserError {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const diagnostic = /https?:\/\/|bearer\s|eyJ[A-Za-z0-9_-]+\.|(?:api[_ -]?key|token|secret|password|authorization)\s*[^:\n]{0,32}[:=]|private[_ -]?key|\b(?:sk-[A-Za-z0-9_-]{8,}|gsk_|sk_live_|sb_secret_|AIza)|\b(?:select|insert|update|delete)\b.+\b(?:from|into|set)\b|\bstack\b|<[^>]+>|\n\s*at\s/i
  const safeFallback = fallback.length <= 300 && !diagnostic.test(fallback) ? fallback : 'No se pudo completar la operación'
  const rawCode = typeof source.code === 'string' ? source.code : ''
  const code = /^[A-Z0-9_]{2,32}$/.test(rawCode) ? rawCode : undefined
  const status = Number(source.status ?? source.statusCode)
  const raw = typeof source.message === 'string' ? source.message : typeof error === 'string' ? error : ''
  const result = (message: string, action: string, retryable = false): UserError => ({ message, action, code, retryable })

  if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(rawCode))
    return result('La sesión no es válida o ha vencido.', 'Vuelve a iniciar sesión.')
  if (status === 403 || rawCode === '42501')
    return result('Tu usuario no tiene permiso para esta operación.', 'Solicita acceso al administrador.')
  if (status === 429)
    return result('Se alcanzó el límite temporal de solicitudes.', 'Espera un momento antes de reintentar.', true)
  if (rawCode === '40001')
    return result('Otra persona modificó el registro.', 'Actualiza el expediente y revisa los cambios antes de guardar.')
  if (rawCode === '23505')
    return result('Ya existe un registro con esos datos.', 'Revisa los datos únicos antes de guardar.')
  if (rawCode === '23503')
    return result('El registro está relacionado con otros datos.', 'Revisa sus relaciones antes de modificarlo o eliminarlo.')
  if (['23502', '23514', '22P02'].includes(rawCode) || status === 422)
    return result('Hay datos obligatorios, incompatibles o con formato incorrecto.', 'Revisa los campos del formulario.')
  if (status === 404 || rawCode === 'PGRST116')
    return result('No se encontró el registro solicitado.', 'Actualiza el listado; puede haber cambiado.')
  if (status === 408 || status === 504 || source.name === 'TimeoutError' || rawCode === '57014')
    return result('La operación superó el tiempo de espera.', 'Comprueba el estado del registro antes de repetir un guardado.', true)
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(raw))
    return result('No se pudo conectar con el servicio.', 'Comprueba tu conexión y vuelve a intentarlo.', true)
  if (status >= 500)
    return result('El servicio no pudo completar la solicitud.', 'Reintenta más tarde; si persiste, contacta al administrador.', true)

  // Conservar las validaciones de negocio breves. Los diagnósticos técnicos,
  // URLs, credenciales y errores SQL quedan fuera de la interfaz y del toast.
  const businessMessage = (!rawCode || rawCode === 'P0001') && raw.length <= 300 && !diagnostic.test(raw)
  return result(businessMessage && raw.trim() ? raw.trim() : safeFallback, 'Si persiste, contacta al administrador.', !rawCode && ![400, 409, 413].includes(status) && source.name !== 'AbortError')
}

/** Una consulta puede reintentarse; una mutación nunca se repite automáticamente. */
export function retryRead(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && getUserError(error).retryable
}

/** Un enlace de seguimiento concede acceso: validar antes de ofrecer Abrir/Copiar. */
export function validarEnlaceSeguimientoPrivado(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('No se recibió un enlace privado válido.')
  let url: URL
  try { url = new URL(value) } catch { throw new Error('No se recibió un enlace privado válido.') }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password || url.search
    || (!localHttp && url.port) || url.pathname !== '/q/seguimiento' || url.href !== value
    || url.hash.length > 1031 || !/^#clave=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.hash)) {
    throw new Error('No se recibió un enlace privado válido.')
  }
  return url.href
}

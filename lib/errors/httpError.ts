import { getUserError } from './userError'

/** Conservar el status al cruzar fetch → servicio → UI. Sin él un 500 podía
 * mostrarse como falta de permisos o como un diagnóstico crudo del proveedor.
 */
export function createHttpError(status: number, message: unknown, fallback: string): Error & { status: number } {
  const info = getUserError({ status, message }, fallback)
  return Object.assign(new Error(info.message), { status })
}

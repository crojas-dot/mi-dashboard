import { MAX_FILE_BYTES, MAX_UPLOAD_BODY_BYTES } from '@/lib/constants/adjuntos'
import { TIPOS_REGISTRO_QUEJA } from '@/lib/constants/quejas'

export const CATEGORIAS_PUBLICAS = TIPOS_REGISTRO_QUEJA
export type PublicCategory = (typeof CATEGORIAS_PUBLICAS)[number]
export const MAX_PUBLIC_FILES = 10
export const PUBLIC_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
export const MAX_PUBLIC_JSON_BYTES = 64 * 1024
export const PUBLIC_UPLOAD_TTL_SECONDS = 30 * 60
export { MAX_FILE_BYTES, MAX_UPLOAD_BODY_BYTES }

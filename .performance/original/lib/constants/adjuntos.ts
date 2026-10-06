// Deja espacio para el formulario multipart dentro del límite de Vercel.
export const MAX_FILE_BYTES = 4 * 1024 * 1024
export const MAX_FILE_LABEL = '4 MB'
export const MAX_UPLOAD_BODY_BYTES = MAX_FILE_BYTES + 128 * 1024

export function validarTamanoAdjunto(file: { size: number }): void {
  if (file.size === 0) throw new Error('El archivo está vacío')
  if (file.size > MAX_FILE_BYTES) throw new Error(`El archivo supera el máximo de ${MAX_FILE_LABEL}`)
}

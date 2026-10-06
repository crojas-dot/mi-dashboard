import { MAX_UPLOAD_BODY_BYTES } from '@/lib/constants/adjuntos'
export { MAX_FILE_BYTES } from '@/lib/constants/adjuntos'
const PLACEHOLDER_PREFIX = 'REEMPLAZAME'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

export { PLACEHOLDER_PREFIX, ALLOWED_MIME_TYPES }

export class UploadBodyTooLargeError extends Error {}

// Limita también peticiones sin Content-Length antes de interpretar multipart.
export async function readUploadForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get('content-length')) > MAX_UPLOAD_BODY_BYTES) {
    throw new UploadBodyTooLargeError('La solicitud supera el tamaño permitido')
  }
  if (!request.body) throw new Error('Solicitud vacía')
  const body = await streamToBuffer(request.body, MAX_UPLOAD_BODY_BYTES)
  return new Response(new Uint8Array(body), {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData()
}

export async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
  maxSize: number,
): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.length
      if (totalBytes > maxSize) {
        reader.cancel().catch(() => {})
        throw new UploadBodyTooLargeError(`El archivo supera el máximo de ${Math.round(maxSize / 1024 / 1024)} MB`)
      }
      chunks.push(value)
    }
  } catch (err) {
    reader.cancel().catch(() => {})
    throw err
  }

  return Buffer.concat(chunks)
}

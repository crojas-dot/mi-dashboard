const MAX_FILE_BYTES = 50 * 1024 * 1024
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

export { MAX_FILE_BYTES, PLACEHOLDER_PREFIX, ALLOWED_MIME_TYPES }

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
        throw new Error(`El archivo supera el máximo de ${Math.round(maxSize / 1024 / 1024)} MB`)
      }
      chunks.push(value)
    }
  } catch (err) {
    reader.cancel().catch(() => {})
    throw err
  }

  return Buffer.concat(chunks)
}

import 'server-only'
import { MAX_PUBLIC_JSON_BYTES, MAX_UPLOAD_BODY_BYTES } from '@/lib/constants/publicForms'
import { streamToBuffer, UploadBodyTooLargeError } from '@/lib/server/uploadHelpers'
import { PublicFormsInputError } from '@/lib/server/publicForms/validation'

export class PublicBodyLimitError extends PublicFormsInputError {
  constructor() { super(413, 'public_body_too_large') }
}

async function readBody(request: Request, maximum: number): Promise<Buffer> {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new PublicFormsInputError()
  if (length !== null && Number(length) > maximum) throw new PublicBodyLimitError()
  if (!request.body) throw new PublicFormsInputError()
  try { return await streamToBuffer(request.body, maximum) }
  catch (error) {
    if (error instanceof UploadBodyTooLargeError) throw new PublicBodyLimitError()
    throw new PublicFormsInputError()
  }
}

function rejectDuplicateJsonKeys(source: string): void {
  const stack: (Set<string> | null)[] = []
  for (let cursor = 0; cursor < source.length; cursor++) {
    const character = source[cursor]
    if (character === '{') stack.push(new Set())
    else if (character === '[') stack.push(null)
    else if (character === '}' || character === ']') stack.pop()
    else if (character === '"') {
      const start = cursor++
      while (cursor < source.length && source[cursor] !== '"') {
        if (source[cursor] === '\\') cursor++
        cursor++
      }
      let next = cursor + 1
      while (/\s/.test(source[next] ?? '') && next < source.length) next++
      const keys = stack[stack.length - 1]
      if (source[next] === ':' && keys) {
        const key: string = JSON.parse(source.slice(start, cursor + 1))
        if (keys.has(key)) throw new PublicFormsInputError()
        keys.add(key)
      }
    }
  }
}

export async function readPublicJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new PublicFormsInputError(415, 'unsupported_public_body')
  }
  const body = await readBody(request, MAX_PUBLIC_JSON_BYTES)
  const source = body.toString('utf8')
  if (!Buffer.from(source, 'utf8').equals(body)) throw new PublicFormsInputError()
  try {
    const parsed: unknown = JSON.parse(source)
    rejectDuplicateJsonKeys(source)
    return parsed
  } catch { throw new PublicFormsInputError() }
}

export async function readPublicUpload(request: Request): Promise<FormData> {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get('content-type') ?? '')) {
    throw new PublicFormsInputError(415, 'unsupported_public_body')
  }
  const body = await readBody(request, MAX_UPLOAD_BODY_BYTES)
  try {
    return await new Response(new Uint8Array(body), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData()
  } catch { throw new PublicFormsInputError() }
}

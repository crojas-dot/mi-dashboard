import 'server-only'
import { QuejaMailProtocolError } from '@/lib/server/quejaMailProtocol'

export async function googleReply(url: string, body: string, signal: AbortSignal, fetcher: typeof fetch) {
  let response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    signal, redirect: 'manual', cache: 'no-store' })
  if (response.status === 302 || response.status === 303) {
    const location = response.headers.get('location')
    const redirect = location ? new URL(location) : null
    if (!redirect || redirect.protocol !== 'https:' || redirect.hostname !== 'script.googleusercontent.com'
      || redirect.port || redirect.username || redirect.password || redirect.hash || redirect.pathname !== '/macros/echo') {
      throw new QuejaMailProtocolError('unsafe_mail_redirect')
    }
    // Apps Script redirige la respuesta de ContentService; jamás repetir el POST firmado en otro host.
    response = await fetcher(redirect.toString(), { method: 'GET', signal, redirect: 'error', cache: 'no-store' })
  }
  if (!response.ok) throw new QuejaMailProtocolError('mail_transport_failed')
  if (Number(response.headers.get('content-length')) > 8_192) throw new QuejaMailProtocolError('invalid_mail_receipt')
  const reader = response.body?.getReader()
  if (!reader) throw new QuejaMailProtocolError('invalid_mail_receipt')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8_192) { await reader.cancel(); throw new QuejaMailProtocolError('invalid_mail_receipt') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}


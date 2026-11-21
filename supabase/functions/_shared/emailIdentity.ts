export const EMAIL_IDENTITY_KEYS = {
  encabezado: 'org.identidad.correo_encabezado',
  cuadrado: 'org.identidad.correo_cuadrado',
  estilo: 'org.identidad.correo_estilo',
} as const

export type EmailLogoStyle = 'horizontal' | 'cuadrado'

export function emailLogoStyle(value: unknown): EmailLogoStyle {
  return value === 'cuadrado' ? 'cuadrado' : 'horizontal'
}

/** Branding is optional. An invalid or unavailable asset must not block delivery. */
export async function loadEmailIdentity(origin: string, key: string, configuredStyle: string | undefined,
  fetcher: typeof fetch, read: (response: Response) => Promise<unknown>) {
  const identity: { estilo: EmailLogoStyle; encabezado?: string; cuadrado?: string } = { estilo: emailLogoStyle(configuredStyle) }
  try {
    const url = new URL('/rest/v1/configuraciones_sistema', origin)
    url.search = new URLSearchParams({ select: 'clave,valor', clave: `in.(${Object.values(EMAIL_IDENTITY_KEYS).join(',')})` }).toString()
    const response = await fetcher(url.href, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2000),
      headers: { Accept: 'application/json', apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }) },
    })
    if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      await response.body?.cancel().catch(() => undefined)
      return identity
    }
    const rows = await read(response)
    if (!Array.isArray(rows) || rows.length > 3) return identity
    const style = rows.find(row => row?.clave === EMAIL_IDENTITY_KEYS.estilo)
    if (style) identity.estilo = emailLogoStyle(style.valor)
    for (const slot of ['encabezado', 'cuadrado'] as const) {
      const value = rows.find(row => row?.clave === EMAIL_IDENTITY_KEYS[slot])?.valor
      if (typeof value !== 'string' || value.length > 500) continue
      try {
        const image = new URL(value)
        const prefix = `/storage/v1/object/public/branding/identidad/correo_${slot}/`
        const name = image.pathname.startsWith(prefix) ? image.pathname.slice(prefix.length) : ''
        if (image.origin === origin && image.protocol === 'https:' && !image.username && !image.password && !image.search && !image.hash
          && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(name)) identity[slot] = image.href
      } catch { /* Las imágenes externas al bucket se descartan. */ }
    }
  } catch { /* El emisor conserva el logo institucional incluido. */ }
  return identity
}

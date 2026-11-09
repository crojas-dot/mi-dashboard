import 'server-only'

export interface QuejaMailConfig { webAppUrl: string; secret: string }

export function quejaMailConfig(environment: NodeJS.ProcessEnv = process.env): QuejaMailConfig | null {
  // Compatibilidad de rollback únicamente: el transporte operativo usa Supabase.
  // Un flag de envío aislado no puede reactivar el recorrido retirado de Vercel.
  if (environment.QUEJAS_MAIL_TRANSPORT !== 'legacy') return null
  if (environment.QUEJAS_MAIL_ENABLED !== 'true') return null
  const secret = environment.QUEJAS_MAIL_SIGNING_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  let url: URL
  try { url = new URL(environment.QUEJAS_MAIL_APPS_SCRIPT_URL ?? '') } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password
    || url.search || url.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null
  return { webAppUrl: url.toString(), secret }
}

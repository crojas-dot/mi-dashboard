import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { publicBackend } from '@/lib/server/publicForms/gateway'
import { readPublicJson } from '@/lib/server/publicForms/bodies'
import { trackingEnabled, publicTrackingConfig, trackingLinkForCase, trackingReply, trackingFailure } from '@/lib/server/publicTracking'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return trackingReply({ error: 'No autorizado' }, 401)
  if (!['admin', 'calidad'].includes(user.rol)) return trackingReply({ error: 'Sin permisos' }, 403)
  try {
    const flag = process.env.PUBLIC_TRACKING_ENABLED
    if (flag !== undefined && flag !== 'true' && flag !== 'false') return trackingReply({ error: 'No se pudo comprobar la configuración del seguimiento.' }, 503)
    // Apagado explícito conserva compatibilidad; una activación mal configurada nunca habilita el flujo anterior.
    if (!trackingEnabled()) return trackingReply({ enabled: false })
    publicTrackingConfig()
    return trackingReply({ enabled: true })
  } catch (error) { return trackingFailure(error) }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return trackingReply({ error: 'No autorizado' }, 401)
  if (user.rol !== 'admin') return trackingReply({ error: 'Sin permisos' }, 403)
  try {
    const body = await readPublicJson(request) as Record<string, unknown>
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['formId', 'folio'].includes(key))
      || typeof body.formId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.formId) || typeof body.folio !== 'string' || body.folio.length > 120 || !body.folio.trim()) return trackingReply({ error: 'Indicá el formulario y el consecutivo.' }, 400)
    const client = publicBackend()
    // La relación con el formulario se comprueba en servidor, no con un ID arbitrario de la UI.
    const { data: queja, error: caseError } = await client.from('quejas').select('id').eq('folio', body.folio.trim()).maybeSingle()
    if (caseError) throw new Error('tracking_lookup_failed')
    const notFound = () => trackingReply({ error: 'No se encontró un envío de ese formulario con ese consecutivo.' }, 404)
    if (!queja?.id) return notFound()
    const { data, error } = await client.from('public_form_submissions').select('queja_id').eq('form_id', body.formId).eq('queja_id', queja.id).not('finalized_at', 'is', null).maybeSingle()
    if (error) throw new Error('tracking_lookup_failed')
    if (!data?.queja_id) return notFound()
    return trackingReply({ url: await trackingLinkForCase(client, data.queja_id) })
  } catch (error) { return trackingFailure(error) }
}

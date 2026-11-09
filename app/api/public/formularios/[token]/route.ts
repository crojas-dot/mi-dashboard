import { getPublicFormsConfig } from '@/lib/server/publicForms/config'
import { validateFormToken } from '@/lib/server/publicForms/validation'
import { publicBackend, publicReply, publicFailure, PublicGatewayError } from '@/lib/server/publicForms/gateway'

export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    getPublicFormsConfig()
    const token = validateFormToken((await params).token)
    const { data, error } = await publicBackend().from('formularios_publicos')
      .select('nombre, modulo').eq('token', token).eq('activo', true).eq('modulo', 'quejas').maybeSingle()
    if (error) throw error
    if (!data) throw new PublicGatewayError(404, 'public_form_unavailable')
    return publicReply({ nombre: data.nombre, modulo: 'quejas', uploadsAllowed: true })
  } catch (error) { return publicFailure(error) }
}

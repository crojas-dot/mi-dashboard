import { PUBLIC_UPLOAD_TTL_SECONDS } from '@/lib/constants/publicForms'
import { getPublicFormsConfig, PublicFormsUnavailableError } from '@/lib/server/publicForms/config'
import { readPublicJson } from '@/lib/server/publicForms/bodies'
import { validatePublicSubmission, hashPublicPayload, isUuid } from '@/lib/server/publicForms/validation'
import { issueUploadCapability } from '@/lib/server/publicForms/uploadCapability'
import { verifyPublicBot } from '@/lib/server/publicForms/botProtection'
import { publicBackend, publicIpKey, consumePublicRate, publicRpc, publicReply, publicFailure, PublicGatewayError } from '@/lib/server/publicForms/gateway'

export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  try {
    const { signingSecret } = getPublicFormsConfig()
    await verifyPublicBot(request)
    const input = validatePublicSubmission(await readPublicJson(request))
    const client = publicBackend()
    const key = publicIpKey(request, signingSecret)
    await consumePublicRate(client, key, 'attempt')
    const { data: form, error } = await client.from('formularios_publicos').select('id')
      .eq('token', input.formToken).eq('activo', true).eq('modulo', 'quejas').maybeSingle()
    if (error) throw error
    if (!form) throw new PublicGatewayError(404, 'public_form_unavailable')
    if (!isUuid(form.id)) throw new PublicFormsUnavailableError()
    const result = await publicRpc<{ queja_id: string; folio: string; created_at: string; created: boolean; finalized: boolean }>(client, 'public_form_create_submission', {
      p_form_id: form.id, p_form_token: input.formToken, p_submission_id: input.submissionId,
      p_payload_hash: hashPublicPayload(form.id, input), p_rate_key_hash: key,
      p_cliente_nombre: input.nombre, p_email_cliente: input.email, p_telefono: input.telefono, p_categoria: input.categoria, p_descripcion: input.descripcion,
    })
    const createdAt = typeof result.created_at === 'string' ? Date.parse(result.created_at) : NaN
    // El RPC ya hizo commit. Un recibo interno incorrecto nunca es una validación
    // del ciudadano ni autoriza al navegador a iniciar otra reclamación.
    if (!isUuid(result.queja_id) || typeof result.folio !== 'string' || !result.folio
      || result.folio.length > 120 || /[\u0000-\u001f\u007f]/.test(result.folio)
      || typeof result.created !== 'boolean' || !Number.isFinite(createdAt)) throw new PublicFormsUnavailableError()
    // Recuperar un folio tras respuesta perdida no crea otra queja. Una recuperación
    // antigua revalida BotID/formulario/payload antes de emitir capacidad nueva.
    const now = Date.now()
    // DB y Node pueden tener relojes distintos: el emisor firma con su propio reloj,
    // sin aceptar iat futuros ni ampliar el TTL de una capacidad recién emitida.
    const issuedAt = now - createdAt >= PUBLIC_UPLOAD_TTL_SECONDS * 1000 ? undefined : Math.floor(Math.min(createdAt, now) / 1000)
    const capability = issueUploadCapability({ formId: form.id, submissionId: input.submissionId, quejaId: result.queja_id, issuedAt }, signingSecret, now)
    return publicReply({ folio: result.folio, quejaId: result.queja_id, submissionId: input.submissionId, ...capability }, result.created ? 201 : 200)
  } catch (error) { return publicFailure(error) }
}

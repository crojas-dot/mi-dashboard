import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { streamToBuffer, UploadBodyTooLargeError } from '@/lib/server/uploadHelpers'
import { INFORME_MAX_LENGTH } from '@/lib/utils/quejaInforme'

export const runtime = 'nodejs'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const columns = 'queja_id,version,contenido,fuente_revision,creado_por,created_at'

async function authorize(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return { denied: reply({ error: 'Sesión no válida.' }, 401) } as const
  if (!['admin', 'calidad'].includes(user.rol)) return { denied: reply({ error: 'Solo Gestión de Calidad puede gestionar este informe.' }, 403) } as const
  return { user } as const
}

async function tieneAcceso(client: NonNullable<ReturnType<typeof createServiceClient>>, rol: string, escribir = false) {
  if (rol === 'admin') return true
  // Reproduce el permiso efectivo de Quejas: service role no puede ampliarlo.
  const { data, error } = await client.from('permisos').select('leer,escribir').eq('rol', rol).eq('modulo', 'quejas').maybeSingle()
  if (error) throw error
  return data?.leer === true && (!escribir || data.escribir === true)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request)
    if (auth.denied) return auth.denied
    const id = request.nextUrl.searchParams.get('quejaId')
    if (!id || !uuid.test(id)) return reply({ error: 'Expediente no válido.' }, 400)
    const client = createServiceClient(request.signal)
    if (!client) return reply({ error: 'Servicio no disponible.' }, 503)
    if (!await tieneAcceso(client, auth.user.rol)) return reply({ error: 'Sin permiso de lectura de Quejas.' }, 403)
    const entity = await client.from('quejas').select('id').eq('id', id).maybeSingle()
    if (entity.error) throw entity.error
    if (!entity.data) return reply({ error: 'Expediente no encontrado.' }, 404)
    const { data, error } = await client.from('queja_informes').select(columns).eq('queja_id', id).order('version', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    return reply({ informe: data })
  } catch { return reply({ error: 'No se pudo cargar el informe. Intentá de nuevo.' }, 503) }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authorize(request)
    if (auth.denied) return auth.denied
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) return reply({ error: 'Formato no válido.' }, 400)
    // El límite se aplica al stream incluso cuando no existe Content-Length.
    const buffer = await streamToBuffer(request.body, INFORME_MAX_LENGTH * 6 + 1024)
    const body = JSON.parse(buffer.toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['quejaId', 'version', 'contenido', 'fuenteRevision'].includes(key))
      || typeof body.quejaId !== 'string' || !uuid.test(body.quejaId)
      || !Number.isSafeInteger(body.version) || body.version < 0 || body.version >= 2147483647
      || !Number.isSafeInteger(body.fuenteRevision) || body.fuenteRevision < 0
      || typeof body.contenido !== 'string' || !body.contenido.trim() || body.contenido.length > INFORME_MAX_LENGTH || body.contenido.includes('\u0000')) return reply({ error: 'Revisá los datos y la extensión del informe.' }, 400)
    const client = createServiceClient(request.signal)
    if (!client) return reply({ error: 'Servicio no disponible.' }, 503)
    if (!await tieneAcceso(client, auth.user.rol, true)) return reply({ error: 'Sin permiso de escritura de Quejas.' }, 403)
    const entity = await client.from('quejas').select('id,revision').eq('id', body.quejaId).maybeSingle()
    if (entity.error) throw entity.error
    if (!entity.data) return reply({ error: 'Expediente no encontrado.' }, 404)
    if (body.fuenteRevision > entity.data.revision) return reply({ error: 'La revisión de origen no es válida.' }, 400)
    const latest = await client.from('queja_informes').select('version').eq('queja_id', body.quejaId).order('version', { ascending: false }).limit(1).maybeSingle()
    if (latest.error) throw latest.error
    const conflict = () => reply({ error: 'Otra persona guardó una versión más reciente. Tu texto se conserva; exportalo antes de cerrar y abrir el informe para comparar los cambios.' }, 409)
    if ((latest.data?.version ?? 0) !== body.version) return conflict()
    // INSERT con PK (expediente, versión) arbitra dos guardados simultáneos.
    // Nunca se reemplaza una versión ni se actualiza el workflow de Quejas.
    const { data, error } = await client.from('queja_informes').insert({ queja_id: body.quejaId, version: body.version + 1, contenido: body.contenido,
      fuente_revision: body.fuenteRevision, creado_por: auth.user.id }).select(columns).single()
    if (error?.code === '23505') return conflict()
    if (error) throw error
    return reply({ informe: data })
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Contenido no válido.' }, 400)
    if (error instanceof UploadBodyTooLargeError) return reply({ error: 'El informe supera el límite permitido.' }, 413)
    return reply({ error: 'No se pudo confirmar el guardado. Tu texto se conserva; comprobá la versión antes de volver a guardar.' }, 503)
  }
}

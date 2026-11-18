import { NextResponse, type NextRequest } from 'next/server'
import { createAuthenticatedClient, getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { leerQuejaHistorial } from '@/lib/server/quejaHistorial'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request, request.signal)
    if (!user) return reply({ error: 'Sesión no válida.' }, 401)
    if (!['admin', 'calidad', 'colaborador'].includes(user.rol)) return reply({ error: 'Sin acceso al historial.' }, 403)
    const id = request.nextUrl.searchParams.get('quejaId')
    if (!id || !uuid.test(id)) return reply({ error: 'Expediente no válido.' }, 400)
    const client = createAuthenticatedClient(request, request.signal)
    if (!client) return reply({ error: 'Sesión no válida.' }, 401)
    // La RLS de Quejas comprueba permisos y responsabilidad antes de leer auditoría.
    const { data, error } = await client.from('quejas').select('id,folio,fecha,responsable_id').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data || user.rol === 'colaborador' && data.responsable_id !== user.id) {
      return reply({ error: 'Expediente no disponible.' }, 404)
    }
    const admin = createServiceClient(request.signal)
    if (!admin) return reply({ error: 'Servicio no disponible.' }, 503)
    return reply({ movimientos: await leerQuejaHistorial(client, admin, data) })
  } catch {
    return reply({ error: 'No se pudo cargar el historial.' }, 503)
  }
}

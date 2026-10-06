import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { DEFAULT_TIME_ZONE, normalizarZonaHoraria, zonaHorariaValida } from '@/lib/timeZone'

export const runtime = 'nodejs'

// La tabla de configuración solo es visible al administrador por RLS. Este
// endpoint expone únicamente la zona horaria a usuarios activos autenticados.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  const admin = createServiceClient(request.signal)
  if (!admin) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })
  const { data, error } = await admin.from('configuraciones_sistema')
    .select('valor').eq('clave', 'org.zona_horaria').maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo consultar la zona horaria' }, { status: 500 })
  return NextResponse.json({ zonaHoraria: normalizarZonaHoraria(data?.valor ?? DEFAULT_TIME_ZONE) },
    { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  if (user.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede cambiar la zona horaria' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!zonaHorariaValida(body?.zonaHoraria)) {
    return NextResponse.json({ error: 'Selecciona una zona horaria válida' }, { status: 400 })
  }
  const admin = createServiceClient(request.signal)
  if (!admin) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })
  const { data, error } = await admin.from('configuraciones_sistema').upsert({
    clave: 'org.zona_horaria', valor: body.zonaHoraria,
    descripcion: 'Zona horaria para fechas y gráficos del dashboard', categoria: 'general',
  }, { onConflict: 'clave' }).select('valor').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar la zona horaria' }, { status: 500 })
  return NextResponse.json({ zonaHoraria: data.valor }, { headers: { 'Cache-Control': 'private, no-store' } })
}

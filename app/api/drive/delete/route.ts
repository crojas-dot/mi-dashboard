import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { eliminarArchivoDrive } from '@/lib/server/drive'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { adjuntoId } = await request.json().catch(() => ({}))
  if (!adjuntoId || typeof adjuntoId !== 'string') {
    return NextResponse.json({ error: 'Se requiere "adjuntoId"' }, { status: 400 })
  }

  const { data: adjunto, error: adjuntoError } = await admin
    .from('queja_adjuntos')
    .select('id, queja_id, nombre, storage_path, usuario_id')
    .eq('id', adjuntoId)
    .maybeSingle()

  if (adjuntoError || !adjunto) {
    return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
  }

  const esStaff = ['admin', 'calidad'].includes(current.rol)
  const esCliente = adjunto.usuario_id === null
  const esAnalisis = adjunto.usuario_id !== null

  const { data: perfil } = await admin
    .from('usuarios')
    .select('id')
    .eq('auth_id', current.auth_id)
    .maybeSingle()

  let queja: { responsable_id: string | null } | null = null
  if (perfil) {
    const { data } = await admin
      .from('quejas')
      .select('responsable_id')
      .eq('id', adjunto.queja_id)
      .maybeSingle()
    queja = data
  }

  const esResponsable = queja?.responsable_id === perfil?.id

  if (esCliente && current.rol !== 'admin') {
    return NextResponse.json(
      { error: 'Solo los administradores pueden eliminar evidencias del cliente' },
      { status: 403 },
    )
  }

  if (esAnalisis && !esStaff && !esResponsable) {
    return NextResponse.json(
      { error: 'Solo el responsable, calidad o administración pueden eliminar evidencias de análisis' },
      { status: 403 },
    )
  }

  if (adjunto.storage_path && !adjunto.storage_path.includes('/')) {
    const eliminado = await eliminarArchivoDrive(adjunto.storage_path)
    if (!eliminado) {
      console.warn('[api/drive/delete] No se pudo eliminar el archivo de Drive, pero se continuará con la eliminación del registro')
    }
  }

  const { error: deleteError } = await admin
    .from('queja_adjuntos')
    .delete()
    .eq('id', adjuntoId)

  if (deleteError) {
    console.error('[api/drive/delete] Error al eliminar registro:', deleteError)
    return NextResponse.json({ error: 'No se pudo eliminar el adjunto' }, { status: 500 })
  }

  console.log(`[api/drive/delete] Adjunto eliminado: ${adjunto.nombre} (${adjuntoId})`)

  return NextResponse.json({ success: true })
}

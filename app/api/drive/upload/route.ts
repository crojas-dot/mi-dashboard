import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { getDriveClient, buscarOCrearSubcarpeta, subirArchivoASubcarpeta } from '@/lib/server/drive'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const PLACEHOLDER_PREFIX = 'REEMPLAZAME'

export async function POST(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  const quejaId = String(formData.get('queja_id') ?? '').trim()
  if (!(file instanceof File) || !quejaId) {
    return NextResponse.json({ error: 'Se requieren "file" y "queja_id"' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el máximo de 50 MB' }, { status: 413 })
  }

  const esStaff = ['admin', 'calidad'].includes(current.rol)

  const { data: perfil } = await admin
    .from('usuarios')
    .select('id')
    .eq('auth_id', current.auth_id)
    .maybeSingle()
  if (!perfil) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
  }

  const { data: queja } = await admin
    .from('quejas')
    .select('folio, responsable_id')
    .eq('id', quejaId)
    .maybeSingle()
  if (!queja) {
    return NextResponse.json({ error: 'Queja no encontrada' }, { status: 404 })
  }
  if (!esStaff && queja.responsable_id !== perfil.id) {
    return NextResponse.json({ error: 'Sin permisos para adjuntar a esta queja' }, { status: 403 })
  }

  const { data: config } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', 'drive_folder_id_quejas')
    .maybeSingle()
  const rootFolderId =
    typeof config?.valor === 'string' ? config.valor.trim() : ''
  if (!rootFolderId || rootFolderId.startsWith(PLACEHOLDER_PREFIX)) {
    return NextResponse.json(
      { error: 'Falta configurar drive_folder_id_quejas en Configuración → General' },
      { status: 500 },
    )
  }

  const drive = getDriveClient()
  if (!drive) {
    return NextResponse.json(
      { error: 'Servidor mal configurado: faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY' },
      { status: 500 },
    )
  }

  try {
    const subcarpetaId = await buscarOCrearSubcarpeta(drive, rootFolderId, queja.folio)
    const resultado = await subirArchivoASubcarpeta(subcarpetaId, {
      nombre: file.name,
      tipoMime: file.type || 'application/octet-stream',
      buffer: Buffer.from(await file.arrayBuffer()),
    })

    // Disparo proactivo fire-and-forget a Apps Script para pre-generar contexto
    const appsScriptUrl = process.env.APPS_SCRIPT_WEBAPP_URL
    if (appsScriptUrl) {
      fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: subcarpetaId }),
      }).catch((err) => console.error('[api/drive/upload] Apps Script precarga falló:', err))
    }

    return NextResponse.json({
      drive_file_id: resultado.id,
      name: resultado.name ?? file.name,
      mimeType: resultado.mimeType ?? (file.type || 'application/octet-stream'),
      folder_id: subcarpetaId,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al subir archivo a Drive'
    console.error('[api/drive/upload]', mensaje)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

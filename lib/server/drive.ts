import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

const DRIVE_TIMEOUT_MS = 120000
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

type JwtAuth = InstanceType<typeof google.auth.JWT>

function getJwtAuth(): JwtAuth | null {
  const email = process.env.GOOGLE_CLIENT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !rawKey) return null
  return new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export function getDriveClient(): drive_v3.Drive | null {
  const auth = getJwtAuth()
  if (!auth) return null
  return google.drive({ version: 'v3', auth, timeout: DRIVE_TIMEOUT_MS })
}

export async function buscarOCrearSubcarpeta(
  drive: drive_v3.Drive,
  rootFolderId: string,
  nombreCarpeta: string,
): Promise<string> {
  const nombreEscapado = nombreCarpeta.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const q = [
    `name = '${nombreEscapado}'`,
    `'${rootFolderId}' in parents`,
    `mimeType = '${DRIVE_FOLDER_MIME}'`,
    'trashed = false',
  ].join(' and ')

  console.log(`[drive] buscando subcarpeta "${nombreCarpeta}"...`)
  const lista = await drive.files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existente = lista.data.files?.[0]?.id
  if (existente) {
    console.log(`[drive] subcarpeta existente: ${existente}`)
    return existente
  }

  console.log(`[drive] no existe; creando subcarpeta "${nombreCarpeta}"...`)
  const creada = await drive.files.create({
    requestBody: {
      name: nombreCarpeta,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [rootFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!creada.data.id) throw new Error('Google Drive no devolvió el ID de la subcarpeta creada')
  console.log(`[drive] subcarpeta creada: ${creada.data.id}`)
  return creada.data.id
}

async function obtenerAccessToken(): Promise<string | null> {
  const auth = getJwtAuth()
  if (!auth) return null
  const tokenResponse = await auth.getAccessToken()
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token
  return accessToken ?? null
}

export async function hacerArchivoPublico(fileId: string): Promise<boolean> {
  try {
    const accessToken = await obtenerAccessToken()
    if (!accessToken) return false
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) {
      console.warn(`[drive] permiso anyone/reader falló para ${fileId}: HTTP ${res.status}`)
      return false
    }
    console.log(`[drive] archivo público (anyone/reader): ${fileId}`)
    return true
  } catch (error) {
    console.warn('[drive] error aplicando permiso público', fileId, error)
    return false
  }
}

export interface ArchivoParaDrive {
  nombre: string
  tipoMime: string
  buffer: Buffer
}

export interface ResultadoSubidaDrive {
  id: string
  name?: string | null
  mimeType?: string | null
}

export async function subirArchivoASubcarpeta(
  subcarpetaId: string,
  archivo: ArchivoParaDrive,
): Promise<ResultadoSubidaDrive> {
  const auth = getJwtAuth()
  if (!auth) throw new Error('Servidor mal configurado: faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY')
  const accessToken = await obtenerAccessToken()
  if (!accessToken) {
    throw new Error('No se pudo obtener el token de acceso de Google Drive')
  }

  const boundary = `qms-${randomUUID()}`
  const metadata = JSON.stringify({ name: archivo.nombre, parents: [subcarpetaId] })
  const cuerpo = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      'utf8',
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${archivo.tipoMime}\r\n\r\n`, 'utf8'),
    archivo.buffer,
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ])

  console.log(`[drive] subiendo "${archivo.nombre}" (${archivo.buffer.length} bytes, multipart REST) a ${subcarpetaId}...`)
  const inicio = Date.now()
  const res = await fetch(
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id%2Cname%2CmimeType`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(cuerpo.length),
      },
      body: new Uint8Array(cuerpo),
      signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
    },
  )
  const texto = await res.text()
  const duracionMs = Date.now() - inicio
  console.log(`[drive] upload REST completó en ${duracionMs} ms con status ${res.status}`)

  if (!res.ok) {
    throw new Error(`Google Drive respondió ${res.status}: ${texto.slice(0, 300) || '(sin cuerpo)'}`)
  }

  const json = JSON.parse(texto) as { id?: string; name?: string; mimeType?: string }
  if (!json.id) throw new Error('Google Drive no devolvió el ID del archivo subido')
  await hacerArchivoPublico(json.id)
  return { id: json.id, name: json.name ?? null, mimeType: json.mimeType ?? null }
}

export interface ArchivoDrive {
  buffer: Buffer
  mime: string
  nombre: string
}

export async function descargarArchivoDrive(fileId: string): Promise<ArchivoDrive | null> {
  const drive = getDriveClient()
  if (!drive) return null
  try {
    const meta = await drive.files.get({ fileId, fields: 'name,mimeType', supportsAllDrives: true })
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    )
    const datos = res.data as ArrayBuffer
    if (!datos || datos.byteLength === 0) return null
    return {
      buffer: Buffer.from(datos),
      mime: meta.data.mimeType || 'application/octet-stream',
      nombre: meta.data.name || fileId,
    }
  } catch (error) {
    console.warn('[drive] descarga de archivo falló', fileId, error)
    return null
  }
}

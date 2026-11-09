import 'server-only'
import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'
import { logger } from '@/lib/utils/logger'

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

const DRIVE_TIMEOUT_MS = 55000
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

type JwtAuth = InstanceType<typeof google.auth.JWT>

let cachedAuth: JwtAuth | null = null
let cachedDrive: drive_v3.Drive | null = null

function getJwtAuth(): JwtAuth | null {
  const email = process.env.GOOGLE_CLIENT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !rawKey) {
    cachedAuth = null
    cachedDrive = null
    return null
  }
  const key = rawKey.replace(/\\n/g, '\n')
  // El SDK renueva y agrupa tokens concurrentes en la misma instancia. Solo
  // compartir transporte: permisos, pertenencia y datos se verifican por petición.
  if (!cachedAuth || cachedAuth.email !== email || cachedAuth.key !== key) {
    cachedAuth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] })
    cachedDrive = null
  }
  return cachedAuth
}

export function getDriveClient(): drive_v3.Drive | null {
  const auth = getJwtAuth()
  if (!auth) return null
  cachedDrive ??= google.drive({ version: 'v3', auth, timeout: DRIVE_TIMEOUT_MS })
  return cachedDrive
}

/** Rechaza permisos anónimos incluso cuando aparecen en otra página o se heredan. */
export async function assertPrivateDriveFolder(drive: drive_v3.Drive, fileId: string): Promise<void> {
  let pageToken: string | undefined
  for (let page = 0; page < 20; page++) {
    const access = await drive.permissions.list({ fileId, fields: 'nextPageToken,permissions(type)', pageSize: 100, pageToken, supportsAllDrives: true })
    if (!Array.isArray(access.data.permissions)) throw new Error('No se pudo verificar la privacidad de las evidencias')
    if (access.data.permissions.some(permission => permission.type === 'anyone')) throw new Error('La carpeta de evidencias debe tener acceso restringido')
    if (!access.data.nextPageToken) return
    pageToken = access.data.nextPageToken
  }
  throw new Error('No se pudo verificar la privacidad de la carpeta de evidencias')
}

/** No aceptar la fila DB como prueba de pertenencia: una fila legacy pudo forjar su ID. */
export async function assertDriveCaseFile(drive: drive_v3.Drive, rootId: string, fileId: string, folio: string, options: { allowTrashedFile?: boolean } = {}): Promise<'public' | 'internal'> {
  const denied = () => Object.assign(new Error('El archivo no pertenece al expediente solicitado'), { code: 'DRIVE_EVIDENCE_SCOPE' })
  const metadata = async (id: string) => {
    let data: drive_v3.Schema$File
    try { data = (await drive.files.get({ fileId: id, fields: 'id,name,mimeType,parents,trashed', supportsAllDrives: true })).data }
    catch (error) {
      const source = error as { code?: number; response?: { status?: number } }
      if (id === fileId && (source.code === 404 || source.response?.status === 404)) throw Object.assign(new Error('El archivo ya no existe'), { code: 'DRIVE_FILE_MISSING' })
      throw error
    }
    if ((data.trashed && !(id === fileId && options.allowTrashedFile)) || data.id !== id) throw denied()
    return data
  }
  const inspect = async (id: string) => {
    // Lecturas independientes en paralelo; el resultado incompleto nunca autoriza.
    const [file, privacy] = await Promise.allSettled([
      metadata(id),
      assertPrivateDriveFolder(drive, id),
    ])
    if (file.status === 'rejected') throw file.reason
    if (privacy.status === 'rejected') throw privacy.reason
    return file.value
  }
  const [rootResult, fileResult] = await Promise.allSettled([inspect(rootId), inspect(fileId)])
  // La raíz debe validar primero: un 404 rápido del archivo no permite limpiar DB
  // si la raíz configurada está ausente, compartida o dejó de ser una carpeta.
  if (rootResult.status === 'rejected') throw rootResult.reason
  const root = rootResult.value
  if (root.mimeType !== DRIVE_FOLDER_MIME) throw denied()
  if (fileResult.status === 'rejected') throw fileResult.reason
  const file = fileResult.value
  if (file.mimeType === DRIVE_FOLDER_MIME || file.parents?.length !== 1) throw denied()
  const parentId = file.parents[0]
  let parent = await inspect(parentId)
  if (parent.mimeType !== DRIVE_FOLDER_MIME || parent.parents?.length !== 1) throw denied()
  let origin: 'public' | 'internal' = 'public'
  if (parent.name === 'Analisis') {
    origin = 'internal'
    const caseFolderId = parent.parents[0]
    parent = await inspect(caseFolderId)
  }
  if (parent.mimeType !== DRIVE_FOLDER_MIME || parent.name !== folio || parent.parents?.length !== 1 || parent.parents[0] !== rootId) throw denied()
  return origin
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

  const lista = await drive.files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existente = lista.data.files?.[0]?.id
  if (existente) {
    return existente
  }

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
  return creada.data.id
}

async function obtenerAccessToken(): Promise<string | null> {
  const auth = getJwtAuth()
  if (!auth) return null
  const tokenResponse = await auth.getAccessToken()
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token
  return accessToken ?? null
}

export class DriveUploadFailure extends Error {
  readonly outcome: 'rejected' | 'unknown'
  constructor(readonly status: number) {
    super('No se pudo subir el archivo a Google Drive')
    this.outcome = status >= 400 && status < 500 ? 'rejected' : 'unknown'
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

  if (!res.ok) {
    throw new DriveUploadFailure(res.status)
  }

  const json = JSON.parse(texto) as { id?: string; name?: string; mimeType?: string }
  if (!json.id) throw new Error('Google Drive no devolvió el ID del archivo subido')
  return { id: json.id, name: json.name ?? null, mimeType: json.mimeType ?? null }
}

export interface ArchivoDrive {
  buffer: Buffer
  mime: string
  nombre: string
}

export async function eliminarArchivoDrive(fileId: string): Promise<boolean> {
  const drive = getDriveClient()
  if (!drive) return false
  try {
    const current = await drive.files.get({
      fileId,
      fields: 'id,trashed,capabilities(canTrash)',
      supportsAllDrives: true,
    })
    if (current.data.id !== fileId) return false
    if (current.data.trashed === true) return true
    if (current.data.capabilities?.canTrash !== true) return false

    // En unidades compartidas, delete puede devolver 404 por falta de autoridad.
    // Solo una papelera confirmada permite retirar metadatos o liberar una reserva.
    const removed = await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      fields: 'id,trashed',
      supportsAllDrives: true,
    })
    return removed.data.id === fileId && removed.data.trashed === true
  } catch (error) {
    const source = error as { response?: { status?: number }; code?: number }
    const candidate = source.response?.status ?? source.code
    const status = typeof candidate === 'number' ? candidate : undefined
    logger.error('No se pudo retirar un archivo en Drive', { module: 'drive', action: 'trash', status })
    return false
  }
}

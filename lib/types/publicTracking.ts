/** Solo información expresamente publicable. No reutilizar el expediente interno. */
export interface PublicTrackingDocument {
  id: string
  nombre: string
  tipo_mime: string
  tamano: number
}

export interface PublicTrackingStatus {
  folio: string
  estado: string
  recibido_at: string
  actualizado_at: string | null
  etapas: { nombre: string; fecha: string | null }[]
  respuesta: string | null
  numero_oficio: string | null
  documento: PublicTrackingDocument | null
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit
const date = (value: unknown): value is string => text(value, 64) && Number.isFinite(Date.parse(value))
const nullableText = (value: unknown, limit: number): value is string | null => value === null || text(value, limit)

// Proyección explícita también en el gateway: una columna nueva de DB no sale por spread.
export function publicTrackingStatus(value: unknown): PublicTrackingStatus {
  if (!record(value) || !text(value.folio, 120) || !text(value.estado, 120) || !date(value.recibido_at)
    || !(value.actualizado_at === null || date(value.actualizado_at)) || !Array.isArray(value.etapas) || value.etapas.length > 6
    || !nullableText(value.respuesta, 10000) || !nullableText(value.numero_oficio, 120)) throw new Error('invalid_tracking_status')
  const etapas = value.etapas.map(item => {
    if (!record(item) || !text(item.nombre, 80) || !(item.fecha === null || date(item.fecha))) throw new Error('invalid_tracking_status')
    return { nombre: item.nombre, fecha: item.fecha }
  })
  let documento: PublicTrackingDocument | null = null
  if (value.documento !== null) {
    const file = value.documento
    if (!record(file) || !text(file.id, 36) || !/^[0-9a-f-]{36}$/i.test(file.id) || !text(file.nombre, 255)
      || !text(file.tipo_mime, 150) || typeof file.tamano !== 'number' || !Number.isSafeInteger(file.tamano) || file.tamano < 1 || file.tamano > 4 * 1024 * 1024) throw new Error('invalid_tracking_document')
    documento = { id: file.id, nombre: file.nombre, tipo_mime: file.tipo_mime, tamano: file.tamano }
  }
  return { folio: value.folio, estado: value.estado, recibido_at: value.recibido_at, actualizado_at: value.actualizado_at,
    etapas, respuesta: value.respuesta, numero_oficio: value.numero_oficio, documento }
}

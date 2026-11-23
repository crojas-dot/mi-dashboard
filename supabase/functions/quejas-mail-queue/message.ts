const CITIZEN_MAIL_KINDS = ['recibido', 'final'] as const
const INFORMATION_MAIL_KIND = 'solicitud_informacion' as const
export const INTERNAL_MAIL_KINDS = ['interno_recibido', 'interno_evaluacion_1', 'interno_asignacion',
  'interno_investigacion_5', 'interno_investigacion_3', 'interno_evaluacion_vencida', 'interno_investigacion_vencida',
  'interno_respuesta_cliente','interno_devolucion','interno_reapertura','interno_recordatorio_3','interno_recordatorio_1','interno_escalamiento_1','interno_fallo_entrega'] as const
type MailKind = (typeof CITIZEN_MAIL_KINDS)[number] | (typeof INTERNAL_MAIL_KINDS)[number] | typeof INFORMATION_MAIL_KIND

/** Snapshot mínimo: los destinatarios/hitos salen de DB, nunca de un body HTTP libre. */
export interface QuejaMailSnapshot {
  id: string
  claim_token: string
  tipo: MailKind
  destinatario: string
  folio: string
  estado: string | null
  numero_oficio: string | null
  public_tracking?: { queja_id: string; nonce: string }
  correo?: { subject: string; body: string }
}

export function isMailUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const safeText = (value: unknown, maximum: number): value is string => typeof value === 'string'
  && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value)

export function claimMailSnapshot(value: unknown, options: { internal?: boolean } = {}): QuejaMailSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_mail_snapshot')
  const row = value as Record<string, unknown>
  if (!isMailUuid(row.id) || !isMailUuid(row.claim_token)
    // El worker legacy conserva solo los dos tipos ciudadanos aunque importe este lector.
    || (!(CITIZEN_MAIL_KINDS as readonly string[]).includes(String(row.tipo))
      && !(options.internal && (row.tipo === INFORMATION_MAIL_KIND || (INTERNAL_MAIL_KINDS as readonly string[]).includes(String(row.tipo)))))
    || !safeText(row.destinatario, 254) || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(row.destinatario)
    || !safeText(row.folio, 120) || !row.folio
    || (row.estado != null && !safeText(row.estado, 120))
    || (row.numero_oficio != null && !safeText(row.numero_oficio, 120))
    || (row.tipo === 'final' && !['Resuelto', 'No Procede'].includes(String(row.estado)))) {
    throw new Error('invalid_mail_snapshot')
  }
  let tracking: QuejaMailSnapshot['public_tracking']
  if (row.public_tracking != null && ((CITIZEN_MAIL_KINDS as readonly string[]).includes(String(row.tipo)) || row.tipo === INFORMATION_MAIL_KIND)) {
    const candidate = row.public_tracking as Record<string, unknown>
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
      || Object.keys(candidate).length !== 2 || Object.keys(candidate).some(key => !['queja_id', 'nonce'].includes(key))
      || !isMailUuid(candidate.queja_id) || !isMailUuid(candidate.nonce)) throw new Error('invalid_mail_snapshot')
    tracking = { queja_id: candidate.queja_id.toLowerCase(), nonce: candidate.nonce.toLowerCase() }
  }
  let correo: QuejaMailSnapshot['correo']
  if (row.correo != null && row.tipo !== 'recibido') {
    const candidate = row.correo as Record<string, unknown>
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || Object.keys(candidate).length !== 2
      || !safeText(candidate.subject, 180) || !candidate.subject.trim()
      || typeof candidate.body !== 'string' || candidate.body.length > 3500 || !candidate.body.trim()
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(candidate.body)) throw new Error('invalid_mail_snapshot')
    correo = { subject: candidate.subject, body: candidate.body }
  }
  if (row.tipo === INFORMATION_MAIL_KIND && (!tracking || !correo)) throw new Error('invalid_mail_snapshot')
  // Un aviso interno nunca proyecta la capacidad ciudadana, ni si un RPC añade ese campo.
  // Selección explícita: un RPC futuro no puede filtrar nuevos campos mediante un spread.
  return { id: row.id, claim_token: row.claim_token, tipo: row.tipo as QuejaMailSnapshot['tipo'],
    destinatario: row.destinatario, folio: row.folio, estado: row.estado as string | null ?? null,
    numero_oficio: row.numero_oficio as string | null ?? null, ...(tracking ? { public_tracking: tracking } : {}), ...(correo ? { correo } : {}) }
}

export function quejaMailMessage(row: QuejaMailSnapshot, options: { trackingUrl?: string } = {}) {
  const base = `Solicitud ${row.folio}`
  const messages = {
    recibido: { subject: `${base}: recepción confirmada`, body: `Confirmamos la recepción de su solicitud, folio ${row.folio}.\n\nGestión de Calidad realizará la evaluación inicial en un plazo de 3 días hábiles.` },
    final: { subject: `${base}: comunicación final`, body: `La evaluación de su solicitud, folio ${row.folio}, ha concluido.${row.numero_oficio ? `\n\nNúmero de oficio: ${row.numero_oficio}.` : ''}\n\nLa comunicación de respuesta contiene el resultado de la gestión.` },
    interno_recibido: { subject: `${base}: nueva recepción`, body: `Se recibió la solicitud ${row.folio}.\n\nGestión de Calidad dispone de 3 días hábiles para evaluar su procedencia. Revise el expediente y registre la decisión en el sistema.` },
    interno_evaluacion_1: { subject: `${base}: evaluación por vencer`, body: `La evaluación del expediente ${row.folio} vence en 1 día hábil.\n\nRevise el expediente y registre la decisión de procedencia en el sistema.` },
    interno_asignacion: { subject: `${base}: investigación asignada`, body: `Se le asignó la investigación del expediente ${row.folio}.\n\nEl plazo de investigación es de 15 días hábiles desde la decisión de procedencia. Revise el expediente y registre el trabajo en el sistema.` },
    interno_investigacion_5: { subject: `${base}: investigación por vencer`, body: `La investigación del expediente ${row.folio} vence en 5 días hábiles.\n\nRevise su avance y coordine las acciones pendientes en el sistema.` },
    interno_investigacion_3: { subject: `${base}: investigación por vencer`, body: `La investigación del expediente ${row.folio} vence en 3 días hábiles.\n\nRevise su avance y complete las acciones pendientes en el sistema.` },
    interno_evaluacion_vencida: { subject: `${base}: evaluación vencida`, body: `El plazo de evaluación del expediente ${row.folio} venció.\n\nRevise el expediente y registre la decisión de procedencia en el sistema.` },
    interno_investigacion_vencida: { subject: `${base}: investigación vencida`, body: `El plazo de investigación del expediente ${row.folio} venció.\n\nRevise el expediente y coordine la conclusión de las acciones pendientes en el sistema.` },
    solicitud_informacion: { subject: `${base}: solicitud de información`, body: 'Responda mediante su enlace privado.' },
    interno_respuesta_cliente: { subject: `${base}: respuesta del cliente`, body: 'Revise la información nueva del cliente.' },
    interno_devolucion: { subject: `${base}: corrección requerida`, body: 'Corrija la propuesta de resolución.' },
    interno_reapertura: { subject: `${base}: reapertura`, body: 'Retome la investigación del expediente.' },
    interno_recordatorio_3: { subject: `${base}: plazo próximo`, body: 'El plazo vence en 3 días hábiles.' },
    interno_recordatorio_1: { subject: `${base}: plazo urgente`, body: 'El plazo vence en 1 día hábil.' },
    interno_escalamiento_1: { subject: `${base}: seguimiento requerido`, body: 'Calidad debe verificar el avance antes del vencimiento.' },
    interno_fallo_entrega: { subject: `${base}: revisar destinatario`, body: 'Calidad debe verificar la entrega del aviso.' },
  }
  // Rechazar también llamadas directas con tipos retirados, sin producir un mensaje incompleto.
  if (!Object.prototype.hasOwnProperty.call(messages, row.tipo)) throw new Error('invalid_mail_snapshot')
  const message = { eventId: row.id, kind: row.tipo, folio: row.folio, to: row.destinatario, ...messages[row.tipo],
    ...(row.tipo !== 'recibido' && row.correo ? { subject: row.correo.subject, body: row.correo.body } : {}) }
  if ((row.tipo === 'recibido' || row.tipo === 'final') && !row.correo) message.body += '\n\nPara consultas adicionales, puede escribir a gc@eca.or.cr.'
  // El acuse conserva seguimiento; el correo final entrega el informe como adjunto
  // independiente de la capacidad ciudadana que caduca a los 30 días.
  if (row.tipo === INFORMATION_MAIL_KIND && !options.trackingUrl) throw new Error('invalid_mail_snapshot')
  if (!options.trackingUrl || !row.public_tracking || !['recibido', INFORMATION_MAIL_KIND].includes(row.tipo)) return message
  // El generador Edge entrega una URL ya validada; no aceptar URLs libres del RPC.
  const url = new URL(options.trackingUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search
    || url.pathname !== '/q/seguimiento' || !/^#clave=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.hash)
    || url.toString() !== options.trackingUrl || options.trackingUrl.length > 2048) throw new Error('invalid_mail_snapshot')
  return { ...message, body: `${message.body}\n\nSeguimiento privado: ${options.trackingUrl}`, trackingUrl: options.trackingUrl }
}

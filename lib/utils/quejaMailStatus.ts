const reasons = new Map([
  ['authorization_unavailable', 'El emisor no pudo completar la validación previa al envío.'],
  ['authorization_permission_denied', 'Supabase rechazó el permiso del emisor para autorizar este correo.'],
  ['official_document_missing', 'El emisor no encontró el archivo oficial de esta publicación.'],
  ['official_document_unavailable', 'El emisor no pudo abrir el archivo oficial en Google Drive.'],
  ['official_document_changed', 'El archivo oficial cambió o sus datos ya no coinciden con la publicación.'],
  ['quota_exhausted', 'Google agotó la cuota diaria de correo.'],
  ['quota_unavailable', 'El emisor no pudo consultar la cuota de correo de Google.'],
  ['ledger_busy', 'El emisor estaba procesando otro envío.'],
  ['ledger_unavailable', 'El emisor no pudo consultar su registro de entregas.'],
  ['disabled', 'El envío de correo está desactivado.'],
  ['batch_not_started', 'El emisor pospuso el correo por tiempo de ejecución.'],
  ['invalid_reply_to', 'La dirección configurada para recibir respuestas no es válida.'],
  ['attempt_limit', 'Se agotaron los intentos automáticos de envío.'],
  ['delivery_uncertain', 'Google no confirmó el envío. Verificá la entrega antes de volver a enviarlo.'],
  ['lease_expired', 'Venció la reserva del emisor y la entrega quedó por confirmar.'],
  ['event_conflict', 'El correo no coincide con el evento registrado por el emisor.'],
  ['invalid_delivery', 'El emisor rechazó los datos del correo.'],
  ['invalid_mail_snapshot', 'Faltan datos válidos para preparar el correo.'],
  ['obsolete_notice', 'El destinatario o el estado del expediente cambió antes del envío.'],
  ['citizen_notice_retired', 'Este aviso ya no forma parte del flujo de correo.'],
])

const retryable = new Set([
  'authorization_unavailable', 'authorization_permission_denied', 'official_document_missing', 'official_document_unavailable',
  'official_document_changed', 'quota_exhausted', 'quota_unavailable', 'ledger_busy', 'ledger_unavailable', 'disabled',
  'batch_not_started', 'invalid_reply_to', 'attempt_limit',
])

export function quejaMailError(code: string | null | undefined) {
  return code ? reasons.get(code) : undefined
}

export function quejaMailCanRetry(mail: { status: string; safe_error?: string | null; sent_at: string | null }) {
  return !mail.sent_at && ['retry', 'failed'].includes(mail.status) && !!mail.safe_error && retryable.has(mail.safe_error)
}

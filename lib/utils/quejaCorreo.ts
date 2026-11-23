export const CORREO_QUEJA_LIMITES = { asunto: 180, cuerpo: 3500 } as const
export interface CorreoQueja { asunto: string; cuerpo: string }

export function crearCorreoAcompanamiento(queja: { cliente_nombre: string; folio: string }, noProcede = false): CorreoQueja {
  const nombre = queja.cliente_nombre.trim() || 'persona interesada'
  return {
    asunto: `Respuesta a su solicitud - Folio ${queja.folio}`,
    cuerpo: `Estimado(a) ${nombre}:\n\n${noProcede ? `En relación con su solicitud, folio ${queja.folio}, le informamos que fue declarada no procedente. Los fundamentos se detallan en el informe adjunto.` : `En respuesta a su solicitud, folio ${queja.folio}, remitimos el informe adjunto con los resultados del análisis y la resolución.`}\n\nPara consultas adicionales, puede escribir a gc@eca.or.cr.\n\nAtentamente,\nGestión de Calidad\nEnte Costarricense de Acreditación (ECA)`,
  }
}

export function validarCorreoQueja(correo: CorreoQueja, publicar = false): void {
  if (correo.asunto.length > CORREO_QUEJA_LIMITES.asunto || correo.cuerpo.length > CORREO_QUEJA_LIMITES.cuerpo
    || /[\u0000-\u001f\u007f]/.test(correo.asunto) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(correo.cuerpo)
    || publicar && (!correo.asunto.trim() || !correo.cuerpo.trim())) throw new Error('Revisá el asunto y el mensaje del correo.')
}

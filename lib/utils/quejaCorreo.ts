export const CORREO_QUEJA_LIMITES = { asunto: 180, cuerpo: 3500 } as const
export interface CorreoQueja { asunto: string; cuerpo: string }

export function crearCorreoAcompanamiento(queja: { cliente_nombre: string; folio: string }, noProcede = false): CorreoQueja {
  const nombre = queja.cliente_nombre.trim() || 'persona interesada'
  return {
    asunto: `Respuesta a su solicitud - Folio ${queja.folio}`,
    cuerpo: `Estimado(a) ${nombre}:\n\nReciba un cordial saludo.\n\nEn atención a su solicitud registrada con el folio ${queja.folio}, le remitimos adjunto el informe de respuesta emitido por el Ente Costarricense de Acreditación (ECA).\n\n${noProcede ? 'Su solicitud fue evaluada como no procedente. Los fundamentos de esta decisión se detallan en el informe adjunto.' : 'Los resultados del análisis y la resolución se encuentran en el informe adjunto.'} Le agradecemos revisar su contenido.\n\nPara consultas adicionales, puede escribir a gc@eca.or.cr.\n\nAtentamente,\nGestión de Calidad\nEnte Costarricense de Acreditación (ECA)`,
  }
}

export function validarCorreoQueja(correo: CorreoQueja, publicar = false): void {
  if (correo.asunto.length > CORREO_QUEJA_LIMITES.asunto || correo.cuerpo.length > CORREO_QUEJA_LIMITES.cuerpo
    || /[\u0000-\u001f\u007f]/.test(correo.asunto) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(correo.cuerpo)
    || publicar && (!correo.asunto.trim() || !correo.cuerpo.trim())) throw new Error('Revisá el asunto y el mensaje del correo.')
}

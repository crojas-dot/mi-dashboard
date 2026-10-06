/** Reglas del editor: los estilos y los componentes no deciden qué persistir. */
export function validarPlazos(alerta: number, vencimiento: number): string | null {
  if (!Number.isInteger(alerta) || !Number.isInteger(vencimiento) || alerta < 0 || vencimiento < 1) {
    return 'Usá días enteros: alerta desde 0 y vencimiento desde 1.'
  }
  return alerta > vencimiento ? 'La alerta debe ocurrir antes o el mismo día del vencimiento.' : null
}

export function esConfiguracionIA(clave: string) {
  return clave.startsWith('ai_')
}

export function parsearValorConfiguracion(texto: string, original: unknown): unknown {
  if (typeof original === 'string') return texto
  const valor: unknown = JSON.parse(texto)
  const tipo = (dato: unknown) => dato === null ? 'null' : Array.isArray(dato) ? 'array' : typeof dato
  if (tipo(valor) !== tipo(original)) throw new Error('Conservá el tipo de valor de esta configuración.')
  return valor
}

export function presentarNombre(valor: string) {
  const nombres: Record<string, string> = {
    quejas: 'Quejas', sacp: 'Acciones SACP', documentos: 'Documentos', auditorias: 'Auditorías',
    riesgos: 'Riesgos', general: 'General', revision_direccion: 'Revisión por Dirección',
    drive_folder_id_quejas: 'Carpeta de evidencias en Google Drive', 'org.zona_horaria': 'Zona horaria de la organización',
    categoria_queja: 'Categorías de quejas', estado_queja: 'Estados de quejas', prioridad: 'Prioridades',
    estado_sacp: 'Estados de acciones', tipo_sacp: 'Tipos de acciones', estado_documento: 'Estados de documentos',
    estado_auditoria: 'Estados de auditorías', tipo_auditoria: 'Tipos de auditorías',
  }
  if (Object.hasOwn(nombres, valor)) return nombres[valor]
  const texto = valor.replace(/_/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

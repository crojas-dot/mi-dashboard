// El tipo del registro es distinto de categoria (clasificación interna).
// Mantener esta lista sincronizada con la validación de la RPC pública en
// supabase/017_atributos_reales_quejas.sql.
export const TIPOS_REGISTRO_QUEJA = [
  'Queja', 'Observación', 'Sugerencia', 'Denuncia', 'Reclamo', 'Felicitación',
] as const

export function tipoVisible(queja: { tipo?: string | null; categoria?: string | null }): string {
  return queja.tipo || queja.categoria || '—'
}

// Las columnas DATE de Postgres ya tienen día local; new Date('AAAA-MM-DD')
// las interpretaría como UTC y podría mostrar el día anterior en Costa Rica.
export function fechaLocalVisible(fecha?: string | null): string {
  if (!fecha) return '—'
  const partes = fecha.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha
}

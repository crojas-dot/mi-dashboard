import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuejaMovimiento } from '@/lib/queries/useQuejaHistorial'

const TRANSICIONES = {
  Recibido: ['registro', 'Pasó a evaluación'],
  'En Investigación': ['investigacion', 'Pasó a investigación'],
  'Pendiente de Revisión GC': ['envio', 'Envió la propuesta a Revisión GC'],
  Resuelto: ['resolucion', 'Registró la resolución'],
  'No Procede': ['cierre', 'Marcó como No Procede'],
  Finalizado: ['cierre', 'Finalizó la queja'],
} as const

type Movimiento = Omit<QuejaMovimiento, 'usuario'> & { usuarioId: string | null }
type Expediente = { id: string; folio: string; fecha: string; responsable_id: string | null }

export async function leerQuejaHistorial(
  client: SupabaseClient,
  admin: SupabaseClient,
  expediente: Expediente,
): Promise<QuejaMovimiento[]> {
  const { id, folio, fecha } = expediente
  const mensajes = new Map(Object.entries(TRANSICIONES).map(([estado, accion]) => [
    `La queja ${folio} cambió a ${estado}.`, accion,
  ]))
  const esperados = [...mensajes.keys()]
  // Los logs históricos usan el folio en texto. La notificación del motor
  // corrobora el expediente y la hora antes de usar la autoría del log.
  const [eventos, avisos, logs, revisiones, reaperturas] = await Promise.all([
    client.from('qms_case_events').select('kind,occurred_at').eq('module', 'quejas').eq('case_id', id),
    admin.from('notificaciones').select('fecha,mensaje').eq('origen_id', id).eq('tipo', 'queja_estado')
      .in('mensaje', esperados).gte('fecha', fecha),
    admin.from('logs').select('fecha,detalle,usuario_id').eq('modulo', 'quejas').eq('accion', 'transición')
      .in('detalle', esperados).gte('fecha', fecha),
    admin.from('queja_gc_revisiones').select('decision,created_at,usuario_id').eq('queja_id', id),
    admin.from('queja_reaperturas').select('reapertura_at,actor_id').eq('queja_id', id),
  ])
  for (const resultado of [eventos, avisos, logs, revisiones, reaperturas]) {
    if (resultado.error) throw resultado.error
  }

  const movimientos = new Map<string, Movimiento>()
  const guardar = (tipo: string, fecha: string, accion: string, usuarioId: string | null = null) => {
    const clave = `${tipo}:${fecha}`
    movimientos.set(clave, { id: clave, fecha, accion, usuarioId })
  }
  // La fecha de ingreso es el respaldo para expedientes anteriores al motor.
  const apertura = eventos.data?.find(evento => evento.kind === 'opened')
  guardar('registro', apertura?.occurred_at ?? fecha, 'Registró la queja')
  for (const evento of eventos.data ?? []) {
    if (evento.kind === 'resolved') guardar('resolucion', evento.occurred_at, 'Registró la resolución')
    if (evento.kind === 'closed') guardar('cierre', evento.occurred_at, 'Cerró el expediente')
  }

  const autores = new Map<string, Set<string | null>>()
  for (const log of logs.data ?? []) {
    const clave = `${log.fecha}:${log.detalle}`
    const candidatos = autores.get(clave) ?? new Set<string | null>()
    candidatos.add(log.usuario_id)
    autores.set(clave, candidatos)
  }
  for (const aviso of avisos.data ?? []) {
    const movimiento = mensajes.get(aviso.mensaje)
    if (!movimiento) continue
    const candidatos = autores.get(`${aviso.fecha}:${aviso.mensaje}`)
    const usuarioId = candidatos?.size === 1 ? [...candidatos][0] : null
    guardar(movimiento[0], aviso.fecha, movimiento[1], usuarioId)
  }
  for (const revision of revisiones.data ?? []) {
    if (revision.decision === 'approved') guardar('resolucion', revision.created_at, 'Aprobó la propuesta', revision.usuario_id)
    if (revision.decision === 'returned') guardar('investigacion', revision.created_at, 'Devolvió a investigación', revision.usuario_id)
  }
  for (const reapertura of reaperturas.data ?? []) {
    guardar('investigacion', reapertura.reapertura_at, 'Reabrió la queja', reapertura.actor_id)
  }

  const ids = [...new Set([...movimientos.values()].flatMap(item => item.usuarioId ? [item.usuarioId] : []))]
  const personas = new Map<string, string>()
  if (ids.length) {
    // Resolver nombres bajo la sesión del lector, con los permisos del directorio.
    const { data, error } = await client.from('usuarios').select('id,nombre').in('id', ids)
    if (error) throw error
    for (const persona of data ?? []) personas.set(persona.id, persona.nombre)
  }
  return [...movimientos.values()]
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha) || b.id.localeCompare(a.id))
    .map(({ id, fecha, accion, usuarioId }) => ({
      id, fecha, accion, usuario: usuarioId ? personas.get(usuarioId) ?? 'Usuario registrado' : null,
    }))
}

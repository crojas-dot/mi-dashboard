import { opcionesEstadoQueja, TIPOS_REGISTRO_QUEJA } from '@/lib/constants/quejas'
import { supabase } from '@/lib/supabase'
import { CONFIG_INFORMES, TAMANO_LOTE_INFORME, MAX_REGISTROS_INFORME } from './configuracion'
import type { CatalogoItem, FilaInforme, FiltrosInforme } from './tipos'
import type { QuejaComentario } from '@/lib/queries/useQuejaComentarios'

// Cien UUID mantienen pequeño el filtro IN; el texto completo nunca se trunca en silencio.
const TAMANO_LOTE_EXPEDIENTES = 100
const MAX_OBSERVACIONES_INFORME = 5_000
type ObservacionInforme = Pick<QuejaComentario, 'id' | 'queja_id' | 'comentario' | 'tipo' | 'fecha'>

async function enriquecerObservaciones(filas: FilaInforme[], signal?: AbortSignal): Promise<FilaInforme[]> {
  const entradas = new Map(filas.map(fila => [fila.id, typeof fila.observaciones === 'string' && fila.observaciones.trim() ? [fila.observaciones] : []]))
  const ids = [...entradas.keys()]
  const fecha = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short' })
  let leidas = 0
  for (let indice = 0; indice < ids.length; indice += TAMANO_LOTE_EXPEDIENTES) {
    const lote = ids.slice(indice, indice + TAMANO_LOTE_EXPEDIENTES)
    for (let desde = 0; ; desde += TAMANO_LOTE_INFORME) {
      signal?.throwIfAborted()
      const query = supabase.from('quejas_comentarios')
        .select('id,queja_id,comentario,tipo,fecha', { count: 'exact' })
        .in('queja_id', lote)
        .order('fecha', { ascending: true }).order('id', { ascending: true })
        .range(desde, desde + TAMANO_LOTE_INFORME - 1)
      const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
      signal?.throwIfAborted()
      if (error) throw error
      const batch = (data ?? []) as ObservacionInforme[]
      if (leidas + (count == null ? batch.length : count - desde) > MAX_OBSERVACIONES_INFORME)
        throw new Error('El informe supera 5000 observaciones. Ajustá las fechas o filtros para generarlo completo.')
      leidas += batch.length
      for (const observacion of batch) {
        const destino = entradas.get(observacion.queja_id)
        if (!destino || !observacion.comentario?.trim()) continue
        const instante = new Date(observacion.fecha)
        const visible = Number.isFinite(instante.getTime()) ? fecha.format(instante) : 'Sin fecha'
        destino.push(`[${visible} · ${observacion.tipo === 'cliente' ? 'Cliente' : 'Interno'}] ${observacion.comentario}`)
      }
      if (batch.length < TAMANO_LOTE_INFORME || desde + batch.length >= (count ?? Infinity)) break
    }
  }
  // La columna histórica conserva su clave; los comentarios actuales se proyectan solo en este informe.
  return filas.map(fila => ({ ...fila, observaciones: entradas.get(fila.id)?.join('\n\n') || fila.observaciones }))
}

/** Solo se llama desde el paso de filtros; no precargar catálogos de todos los módulos. */
export async function fetchCatalogosInforme(modulo: string, signal?: AbortSignal) {
  const tipos = CONFIG_INFORMES[modulo]?.catalogos ?? {}
  const catalogo = async (tipo?: string): Promise<CatalogoItem[]> => {
    if (!tipo) return []
    const query = supabase.from('catalogos').select('valor,color,codigo,valor_interno').eq('tipo', tipo).eq('modulo', modulo)
      .or('activo.is.null,activo.eq.true').order('orden')
    const { data, error } = await (signal ? query.abortSignal(signal) : query)
    if (error) throw error
    return (data ?? []) as CatalogoItem[]
  }
  const [estados, prioridades, tiposCatalogo] = await Promise.all([
    catalogo(tipos.estado), catalogo(tipos.prioridad), catalogo(tipos.tipo),
  ])
  return modulo === 'quejas'
    ? { estados: opcionesEstadoQueja(estados), prioridades: [], tipos: TIPOS_REGISTRO_QUEJA.map(valor => ({ valor, color: '' })) }
    : { estados, prioridades, tipos: tiposCatalogo }
}

/** Lectura existente por lotes; el tope requiere ajustar filtros, nunca truncar en silencio. */
export async function fetchFilasInforme(modulo: string, filtros: FiltrosInforme, signal?: AbortSignal, incluirObservaciones = true): Promise<FilaInforme[]> {
  const config = CONFIG_INFORMES[modulo]
  if (!config) return []
  const filas: FilaInforme[] = []
  for (let desde = 0; ; desde += TAMANO_LOTE_INFORME) {
    signal?.throwIfAborted()
    let query = supabase.from(config.tabla).select('*', { count: 'exact' })
    if (filtros.fechaDesde) query = query.gte(config.campoFecha, filtros.fechaDesde)
    if (filtros.fechaHasta) {
      const siguiente = new Date(filtros.fechaHasta + 'T00:00:00Z')
      siguiente.setUTCDate(siguiente.getUTCDate() + 1)
      query = query.lt(config.campoFecha, siguiente.toISOString().slice(0, 10))
    }
    if (filtros.estado) query = query.eq('estado', filtros.estado)
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
    query = query.order('id').range(desde, desde + TAMANO_LOTE_INFORME - 1)
    const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
    if (error) throw error
    if ((count ?? 0) > MAX_REGISTROS_INFORME) throw new Error('El informe supera 5000 registros. Ajustá las fechas o filtros para generarlo.')
    const batch = (data ?? []) as FilaInforme[]
    filas.push(...batch)
    if (batch.length < TAMANO_LOTE_INFORME || filas.length >= (count ?? Infinity)) break
  }
  signal?.throwIfAborted()
  return modulo === 'quejas' && incluirObservaciones && filas.length ? enriquecerObservaciones(filas, signal) : filas
}

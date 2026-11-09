import { supabase } from '@/lib/supabase'
import { REGISTRO_QUEJA_LIMITES } from '@/lib/constants/quejas'
import type { CatalogoValor } from '@/lib/queries/useCatalogos'

export async function actualizarAreaCatalogo(
  area: Pick<CatalogoValor, 'id' | 'valor' | 'activo'>,
  cambio: { valor?: string; activo?: boolean },
): Promise<void> {
  if (!area || typeof area.id !== 'string' || !area.id.trim() || typeof area.valor !== 'string'
      || area.activo !== null && typeof area.activo !== 'boolean') {
    throw new Error('Actualizá el catálogo antes de guardar el área.')
  }
  const keys = cambio && typeof cambio === 'object' ? Object.keys(cambio) : []
  if (keys.length !== 1 || keys[0] !== 'valor' && keys[0] !== 'activo') {
    throw new Error('Modificá el nombre o el estado del área en una operación.')
  }
  let payload: { valor: string } | { activo: boolean }
  if (keys[0] === 'valor') {
    const valor = typeof cambio.valor === 'string' ? cambio.valor.trim() : ''
    if (!valor || valor.length > REGISTRO_QUEJA_LIMITES.area) {
      throw new Error(`El área debe tener entre 1 y ${REGISTRO_QUEJA_LIMITES.area} caracteres.`)
    }
    payload = { valor }
  } else {
    if (typeof cambio.activo !== 'boolean') throw new Error('Seleccioná un estado válido para el área.')
    payload = { activo: cambio.activo }
  }

  // RLS conserva la autorización de administrador. Los filtros comparan el
  // snapshot editado; nunca releemos otro valor para forzar un guardado en carrera.
  let query = supabase.from('catalogos').update(payload)
    .eq('id', area.id).eq('modulo', 'quejas').eq('tipo', 'area_afectada').eq('valor', area.valor)
  query = area.activo === null ? query.is('activo', null) : query.eq('activo', area.activo)
  const { data, error } = await query.select('id').single()
  if (error && error.code !== 'PGRST116') throw error
  if (error || !data || data.id !== area.id) {
    throw new Error('El área cambió o ya no está disponible. Actualizá el catálogo antes de guardar.')
  }
}

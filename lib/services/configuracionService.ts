import { supabase } from '@/lib/supabase'
import type { CatalogoValor } from '@/lib/queries/useCatalogos'
import type { SLAConfig } from '@/lib/queries/useQuejas'
import { esConfiguracionIA, validarPlazos } from '@/lib/utils/configuracion'

export interface ConfigGeneral { clave: string; valor: unknown; descripcion: string; categoria: string }

export async function guardarValorCatalogo(valor: Partial<CatalogoValor>) {
  if (!valor.modulo || !valor.tipo || !valor.valor?.trim()) throw new Error('Completá módulo, catálogo y valor.')
  if (!Number.isInteger(valor.orden ?? 0) || (valor.orden ?? 0) < 0) throw new Error('El orden debe ser un número entero desde 0.')
  const payload = { modulo: valor.modulo, tipo: valor.tipo, valor: valor.valor.trim(), color: valor.color || 'gray', orden: valor.orden ?? 0, activo: valor.activo ?? true }
  const query = valor.id ? supabase.from('catalogos').update(payload).eq('id', valor.id) : supabase.from('catalogos').insert(payload)
  const { error } = await query.select('id').single()
  if (error) throw error
}

export async function eliminarValorCatalogo(id: string) {
  const { error } = await supabase.from('catalogos').delete().eq('id', id).select('id').single()
  if (error) throw error
}

export async function guardarPlazo(valor: Partial<SLAConfig>) {
  if (!valor.proceso?.trim() || !valor.prioridad?.trim()) throw new Error('Completá el proceso y la prioridad.')
  const validacion = validarPlazos(valor.dias_alerta ?? NaN, valor.dias_vencimiento ?? NaN)
  if (validacion) throw new Error(validacion)
  const payload = { proceso: valor.proceso, prioridad: valor.prioridad.trim(), dias_alerta: valor.dias_alerta, dias_vencimiento: valor.dias_vencimiento }
  const query = valor.id ? supabase.from('sla_config').update(payload).eq('id', valor.id) : supabase.from('sla_config').insert(payload)
  const { error } = await query.select('id').single()
  if (error) throw error
}

export async function eliminarPlazo(id: string) {
  const { error } = await supabase.from('sla_config').delete().eq('id', id).select('id').single()
  if (error) throw error
}

export async function fetchConfiguracionesGenerales(): Promise<ConfigGeneral[]> {
  const { data, error } = await supabase.from('configuraciones_sistema')
    .select('clave, valor, descripcion, categoria')
    .not('clave', 'in', '(ai_providers,ai_routing,ai_cache_ttl_minutes)')
    .order('categoria').order('clave')
  if (error) throw error
  return ((data ?? []) as ConfigGeneral[]).filter(config => !esConfiguracionIA(config.clave))
}

export async function guardarConfiguracionGeneral({ clave, valor }: { clave: string; valor: unknown }) {
  if (!clave || esConfiguracionIA(clave)) throw new Error('La configuración de IA se administra en su propia sección.')
  const { error } = await supabase.from('configuraciones_sistema').update({ valor }).eq('clave', clave).select('clave').single()
  if (error) throw error
}

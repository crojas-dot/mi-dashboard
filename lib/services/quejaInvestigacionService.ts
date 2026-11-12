import { supabase } from '@/lib/supabase'
import type { QuejaActividad } from '@/lib/queries/useQuejaActividad'
import { esNotaInvestigacion } from '@/lib/utils/quejaInvestigacionNotas'

export async function actualizarNotaInvestigacion(nota: QuejaActividad, contenido: string) {
  const text = contenido.trim()
  if (!text || text.length > 10000 || !esNotaInvestigacion(nota) || !esNotaInvestigacion({ tipo: 'nota', descripcion: text })) {
    throw new Error('Revisá la nota. Admite hasta 10.000 caracteres.')
  }
  const { error } = await supabase.rpc('qms_update_investigation_note', {
    p_id: nota.queja_id, p_note: nota.id, p_expected: nota.descripcion, p_content: text,
  })
  if (error) throw error
}

export async function eliminarNotaInvestigacion(nota: QuejaActividad) {
  if (!esNotaInvestigacion(nota)) throw new Error('Esta entrada pertenece al historial del trámite.')
  const { error } = await supabase.rpc('qms_delete_investigation_note', {
    p_id: nota.queja_id, p_note: nota.id, p_expected: nota.descripcion,
  })
  if (error) throw error
}

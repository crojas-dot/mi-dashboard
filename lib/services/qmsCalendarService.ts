import { supabase } from '@/lib/supabase'
import { esVersionCalendarioQms, normalizarCalendarioQms, validarCalendarioQms, type QmsCalendarDraft } from '@/lib/utils/qmsCalendar'

export async function publicarCalendarioQms(expected: number, draft: QmsCalendarDraft): Promise<number> {
  if (!esVersionCalendarioQms(expected)) throw new Error('Actualizá el calendario antes de guardar.')
  const errorMessage = validarCalendarioQms(draft)
  if (errorMessage) throw new Error(errorMessage)
  const normalized = normalizarCalendarioQms(draft)
  // El CAS es la versión que se abrió al editar, nunca una lectura nueva para forzar el guardado.
  // El RPC exige admin activo y crea versión/auditoría sin tocar etapas ya abiertas.
  const { data, error } = await supabase.rpc('qms_publish_calendar', {
    p_expected: expected, p_weekdays: normalized.weekdays, p_holidays: normalized.holidays, p_reason: normalized.reason,
  })
  if (error) throw error
  if (!esVersionCalendarioQms(data)) throw new Error('No se pudo confirmar la versión del calendario. Actualizá los datos antes de volver a guardar.')
  return data
}

import 'server-only'
import { createServiceClient } from '@/lib/server/supabase-admin'

/** userId es usuarios.id, no auth.users.id. Solo se acepta un perfil verificado. */
export async function checkModuleAccess(userId: string, userRole: string, moduleName: string, requireWrite = false): Promise<boolean> {
  const client = createServiceClient()
  if (!client) return false
  const { data: user, error: userError } = await client.from('usuarios')
    .select('rol, estado').eq('id', userId).maybeSingle()
  if (userError || user?.estado !== 'activo' || user.rol !== userRole) return false
  if (userRole === 'admin') return true
  const { data: permiso, error } = await client.from('permisos')
    .select('leer, escribir').eq('rol', userRole).eq('modulo', moduleName).maybeSingle()
  return !error && permiso?.leer === true && (!requireWrite || permiso.escribir === true)
}

export async function validateUserStatus(userId: string): Promise<{ valid: boolean; estado?: string }> {
  const client = createServiceClient()
  if (!client) return { valid: false }
  const { data, error } = await client.from('usuarios').select('estado').eq('id', userId).maybeSingle()
  return { valid: !error && data?.estado === 'activo', estado: data?.estado ?? undefined }
}

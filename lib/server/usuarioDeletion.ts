import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export class UsuarioDeletionError extends Error {
  constructor(message:string,readonly status:number) { super(message) }
}
function databaseError(error:{code?:string;message?:string}):never {
  if(error.code==='P0409')throw new UsuarioDeletionError(error.message??'La cuenta cambió. Actualizá el listado.',409)
  if(error.code==='42501')throw new UsuarioDeletionError('No tenés permiso para eliminar esta cuenta.',403)
  if(error.code==='P0002')throw new UsuarioDeletionError('Usuario no encontrado.',404)
  if(error.code==='40001')throw new UsuarioDeletionError('La cuenta cambió. Actualizá el listado antes de continuar.',409)
  throw new UsuarioDeletionError('No se pudo completar la eliminación. Podés reintentar sin perder el historial.',503)
}

/** Auth y Postgres no comparten transacción: el intento durable permite recuperar
 * tanto una cuenta ya borrada como una respuesta de Auth perdida, sin borrar QMS. */
export async function eliminarCuentaUsuario(admin:SupabaseClient,actorAuthId:string,targetId:string) {
  const begin=await admin.rpc('qms_delete_user_account',{p_actor_auth:actorAuthId,p_target:targetId,p_phase:'begin'})
  if(begin.error)databaseError(begin.error)
  if(begin.data?.completed===true)return
  const {requestId,authId}=begin.data??{}
  if(typeof requestId!=='string'||(authId!==null&&typeof authId!=='string'))databaseError({})
  if(authId) {
    const result=await admin.auth.admin.deleteUser(authId)
    if(result.error) {
      // Un timeout puede ocurrir después de borrar. Confirmar ausencia por ID,
      // no por correo (ese correo podría pertenecer ahora a una cuenta nueva).
      const remaining=await admin.auth.admin.getUserById(authId)
      if(!remaining.error||remaining.error.code!=='user_not_found') {
        throw new UsuarioDeletionError('No se pudo confirmar la eliminación del acceso. La cuenta quedó desactivada; volvé a intentar Eliminar.',409)
      }
    }
  }
  const finish=await admin.rpc('qms_delete_user_account',{p_actor_auth:actorAuthId,p_target:targetId,p_phase:'finish',p_request:requestId})
  if(finish.error)databaseError(finish.error)
  if(finish.data?.completed!==true)databaseError({})
}

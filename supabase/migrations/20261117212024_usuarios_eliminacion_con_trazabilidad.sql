-- Retira la cuenta de acceso sin romper autoría/responsabilidad histórica de QMS.
-- Versión asignada al aplicar por MCP; alineada con schema_migrations remoto.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.usuarios add column eliminado_en timestamptz;
comment on column public.usuarios.eliminado_en is 'Cuenta retirada del directorio; el perfil conserva las relaciones de los expedientes.';
-- authenticated conserva sus UPDATE por columna; no se le concede la marca de baja.
revoke update(eliminado_en),insert(eliminado_en) on public.usuarios from anon,authenticated;

create table qms_private.usuario_eliminaciones (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null unique references public.usuarios(id) on delete restrict,
 solicitado_por uuid not null references public.usuarios(id) on delete restrict,
 -- Sin FK a Auth: debe sobrevivir al borrado nativo para recuperar un envío incierto.
 auth_id uuid,
 creado_en timestamptz not null default now(),
 completado_en timestamptz
);
create index usuario_eliminaciones_actor on qms_private.usuario_eliminaciones(solicitado_por);
alter table qms_private.usuario_eliminaciones enable row level security;
revoke all on qms_private.usuario_eliminaciones from public,anon,authenticated,service_role;

create function public.qms_delete_user_account(p_actor_auth uuid,p_target uuid,p_phase text,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.usuarios; target public.usuarios; job qms_private.usuario_eliminaciones;
begin
 -- Serializa las bajas administrativas y su comprobación del último admin.
 perform pg_advisory_xact_lock(hashtextextended('qms:usuario-eliminacion',0));
 select * into actor from public.usuarios where auth_id=p_actor_auth and estado='activo' and eliminado_en is null;
 if actor.id is null or actor.rol<>'admin' then raise sqlstate '42501' using message='Solo administradores'; end if;
 if actor.id=p_target then raise sqlstate 'P0409' using message='No podés eliminar tu propia cuenta'; end if;
 select * into target from public.usuarios where id=p_target for update;
 if target.id is null then raise sqlstate 'P0002' using message='Usuario no encontrado'; end if;
 if target.eliminado_en is not null then return jsonb_build_object('completed',true); end if;
 select * into job from qms_private.usuario_eliminaciones where usuario_id=p_target for update;
 if p_phase='begin' then
  if job.id is null then
   if target.rol='admin' and target.estado='activo'
    and (select count(*) from public.usuarios where rol='admin' and estado='activo' and eliminado_en is null)<=1 then
    raise sqlstate 'P0409' using message='No se puede dejar el sistema sin administradores activos';
   end if;
   insert into qms_private.usuario_eliminaciones(usuario_id,solicitado_por,auth_id)
    values(target.id,actor.id,target.auth_id) returning * into job;
  end if;
  -- Suspender antes de Auth evita accesos mientras se completa o se reintenta.
  update public.usuarios set estado='inactivo' where id=p_target;
  return jsonb_build_object('completed',false,'requestId',job.id,'authId',job.auth_id);
 elsif p_phase='finish' then
  if job.id is null or job.id is distinct from p_request then raise sqlstate '40001'; end if;
  if target.auth_id is not null and target.auth_id is distinct from job.auth_id then raise sqlstate '40001'; end if;
  if job.auth_id is not null and exists(select 1 from auth.users where id=job.auth_id) then
   raise sqlstate 'P0409' using message='La cuenta de acceso todavía no se eliminó';
  end if;
  -- No hay DELETE de perfiles/expedientes. Se libera el email único para un alta
  -- futura con identidad nueva; el nombre sigue identificando al autor histórico.
  update public.usuarios set eliminado_en=now(),estado='inactivo',auth_id=null,
   email='eliminado-'||id::text||'@usuarios.invalid',telefono=null,avatar_url=null,
   notif_habilitadas=false,notif_sonido=false where id=p_target;
  update qms_private.usuario_eliminaciones set completado_en=now() where id=job.id;
  return jsonb_build_object('completed',true);
 end if;
 raise sqlstate '22023';
end $$;
revoke all on function public.qms_delete_user_account(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.qms_delete_user_account(uuid,uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;

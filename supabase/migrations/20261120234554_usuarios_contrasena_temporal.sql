begin;
set local lock_timeout = '5s';

alter table qms_private.access_policies add column temporary_password_expires_at timestamptz;

-- Vincula un único cambio de Auth con la operación autorizada por el servidor.
-- No contiene contraseñas, hashes ni códigos de autenticación.
create table qms_private.access_password_operations (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null,
  session_id uuid,
  valid_until timestamptz not null
);
alter table qms_private.access_password_operations enable row level security;
revoke all on qms_private.access_password_operations from public, anon, authenticated, service_role;

create or replace function qms_private.access_summary(p_user uuid,p_session uuid,p_aal text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p qms_private.access_policies; phase text; mail text; signed_in_at timestamptz;
begin
  if not exists(select 1 from public.usuarios where auth_id=p_user and estado='activo') then
    return jsonb_build_object('managed',false,'phase','blocked');
  end if;
  select * into p from qms_private.access_policies where auth_id=p_user;
  if not found then return jsonb_build_object('managed',false,'phase','ready'); end if;
  select created_at into signed_in_at from auth.sessions where id=p_session and user_id=p_user;
  phase:=case when p.reset_pending then 'reset_pending'
    when not found then 'blocked'
    when p.temporary_password_expires_at is not null and
      (p.temporary_password_expires_at<=now() or signed_in_at<p.temporary_password_expires_at-interval '72 hours') then 'password_expired'
    when qms_private.access_ready(p_user,p_session,p_aal) then 'ready'
    when p.password_set_at is null or p.must_change_password then 'password'
    when p.blocked_until>now() then 'locked' when p.factor_verified_at is null then 'enroll' else 'verify' end;
  if p.alternative_email is not null then mail:=left(split_part(p.alternative_email,'@',1),3)||'***@'||split_part(p.alternative_email,'@',2); end if;
  return jsonb_build_object('managed',true,'phase',phase,'requireMfa',p.require_mfa,'method',p.method,
    'maskedEmail',mail,'blockedUntil',p.blocked_until,'generation',p.generation,
    'temporaryPassword',p.temporary_password_expires_at is not null);
end $$;

-- Impide autenticar con una clave vencida incluso en el endpoint nativo de Auth.
-- El guard existente sigue bloqueando las sesiones válidas hasta completar el cambio.
create function qms_private.check_temporary_password_session() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from qms_private.access_policies where auth_id=new.user_id
    and temporary_password_expires_at<=clock_timestamp()) then
    raise sqlstate '42501' using message='El acceso temporal venció';
  end if;
  return new;
end $$;
revoke all on function qms_private.check_temporary_password_session() from public, anon, authenticated, service_role;
create trigger qms_temporary_password_session before insert on auth.sessions
  for each row execute function qms_private.check_temporary_password_session();

create function qms_private.confirm_temporary_password() returns trigger
language plpgsql security definer set search_path='' as $$
declare op qms_private.access_password_operations; expires_at timestamptz; marker text;
begin
  select * into op from qms_private.access_password_operations where auth_id=new.id for update;
  select temporary_password_expires_at into expires_at from qms_private.access_policies where auth_id=new.id;
  if op.id is null then
    if expires_at is not null then raise sqlstate '42501'; end if;
    return null;
  end if;

  -- Auth guarda la contraseña y sus metadatos en la misma transacción, en sentencias distintas.
  -- El UUID de un solo uso proviene del servidor y se consume al confirmar esa transacción.
  if op.session_id is null then
    select raw_app_meta_data->>'qms_password_operation' into marker from auth.users where id=new.id;
  else
    select raw_user_meta_data->>'qms_password_operation' into marker from auth.users where id=new.id;
  end if;
  if marker is distinct from op.id::text then
    if expires_at is not null then raise sqlstate '42501'; end if;
    return null;
  end if;
  if op.valid_until<=clock_timestamp() or not exists(select 1 from public.usuarios
    where auth_id=new.id and estado='activo' and email=new.email) then raise sqlstate '42501'; end if;

  if op.session_id is null then
    insert into qms_private.access_policies(auth_id,creation_id,invited,require_mfa,temporary_password_expires_at)
    values(new.id,op.id,false,false,clock_timestamp()+interval '72 hours')
    on conflict(auth_id) do update set invited=false, must_change_password=true, password_set_at=null,
      temporary_password_expires_at=excluded.temporary_password_expires_at;
    update qms_private.access_invitations set revoked_at=now()
      where auth_id=new.id and used_at is null and revoked_at is null;
    update auth.users set raw_app_meta_data=raw_app_meta_data-'qms_password_operation' where id=new.id;
  else
    if expires_at is null or expires_at<=clock_timestamp() or not exists(select 1 from auth.sessions
      where id=op.session_id and user_id=new.id and created_at>=expires_at-interval '72 hours') then
      raise sqlstate '42501';
    end if;
    update qms_private.access_policies set must_change_password=false, password_set_at=now(),
      temporary_password_expires_at=null where auth_id=new.id;
    update auth.users set raw_user_meta_data=raw_user_meta_data-'qms_password_operation' where id=new.id;
  end if;
  delete from qms_private.access_password_operations where auth_id=new.id;
  return null;
end $$;
revoke all on function qms_private.confirm_temporary_password() from public, anon, authenticated, service_role;
create constraint trigger qms_confirm_temporary_password after update of encrypted_password on auth.users
  deferrable initially deferred for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function qms_private.confirm_temporary_password();

create function public.qms_temporary_access_command(p_action text,p_user uuid,p_session uuid,p_aal text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare profile public.usuarios; target public.usuarios; reservation qms_private.access_creations;
  operation uuid; auth_id_target uuid; result jsonb;
begin
  select * into profile from public.usuarios where auth_id=p_user and estado='activo';
  if profile.id is null then raise sqlstate '42501'; end if;
  if p_action='change_begin' then
    if qms_private.access_summary(p_user,p_session,p_aal)->>'phase'<>'password' or not exists(
      select 1 from qms_private.access_policies where auth_id=p_user and temporary_password_expires_at>clock_timestamp()
    ) then raise sqlstate '42501'; end if;
    target:=profile;
  elsif p_action='change_release' then
    delete from qms_private.access_password_operations where auth_id=p_user and session_id=p_session
      and id=(p_data->>'id')::uuid;
    return '{}';
  else
    if profile.rol<>'admin' or not qms_private.access_ready(p_user,p_session,p_aal) then raise sqlstate '42501'; end if;
    if p_action='create_begin' then
      -- Si se perdió la respuesta previa, la misma alta puede recuperarse incluso
      -- desde otro modal. El RPC original conserva su lease y sus controles de autoría.
      select * into reservation from qms_private.access_creations where email=p_data->>'email'
        and completed_at is null and actor_id=p_user and payload-'id'=p_data-'id';
      operation:=coalesce(reservation.id,(p_data->>'id')::uuid);
      result:=public.qms_access_command('create_begin',p_user,p_session,p_aal,p_data||jsonb_build_object('id',operation));
      select * into reservation from qms_private.access_creations where id=operation;
      return result||jsonb_build_object('id',operation,'leaseUntil',reservation.lease_until);
    elsif p_action='create_commit' then
      operation:=(p_data->>'id')::uuid;
      auth_id_target:=(p_data->>'authId')::uuid;
      select * into reservation from qms_private.access_creations where id=operation and actor_id=p_user for update;
      if reservation.id is null or reservation.payload->>'temporaryAccess' is distinct from 'true' then raise sqlstate '42501'; end if;
      if reservation.completed_at is not null then
        if reservation.auth_id is distinct from auth_id_target then raise sqlstate '42501'; end if;
        return jsonb_build_object('issued',false);
      end if;
      if reservation.lease_until is distinct from (p_data->>'leaseUntil')::timestamptz
        or reservation.lease_until<=clock_timestamp() then raise sqlstate '40001'; end if;
      perform public.qms_access_command('create_commit',p_user,p_session,p_aal,p_data);
      update qms_private.access_policies set temporary_password_expires_at=clock_timestamp()+interval '72 hours'
        where auth_id=auth_id_target and creation_id=operation;
      if not found then raise sqlstate '40001'; end if;
      return jsonb_build_object('issued',true);
    elsif p_action='directory' then
      result:=public.qms_access_command('directory',p_user,p_session,p_aal,p_data);
      return (select coalesce(jsonb_agg(case when p.temporary_password_expires_at is null then item else item||jsonb_build_object(
        'status',case when item->>'status'='disabled' then 'disabled'
          when p.temporary_password_expires_at<=now() then 'password_expired' else 'password_pending' end,
        'temporaryPassword',true) end),'[]'::jsonb)
        from jsonb_array_elements(result) item left join qms_private.access_policies p on p.auth_id=(item->>'authId')::uuid);
    elsif p_action in('resend','reset') then
      auth_id_target:=(p_data->>'authId')::uuid;
      select * into target from public.usuarios where auth_id=auth_id_target and estado='activo';
      if target.id is null or target.auth_id=p_user then raise sqlstate '42501'; end if;
      if p_action='resend' and not exists(select 1 from qms_private.access_policies
        where auth_id=target.auth_id and temporary_password_expires_at is not null) then raise sqlstate '40001'; end if;
    elsif p_action='reset_release' then
      delete from qms_private.access_password_operations where auth_id=(p_data->>'authId')::uuid and session_id is null
        and id=(p_data->>'id')::uuid;
      return '{}';
    else
      raise sqlstate '22023';
    end if;
  end if;

  insert into qms_private.access_password_operations(auth_id,id,session_id,valid_until)
    values(target.auth_id,gen_random_uuid(),case when p_action='change_begin' then p_session end,clock_timestamp()+interval '45 seconds')
  on conflict(auth_id) do update set id=excluded.id,session_id=excluded.session_id,valid_until=excluded.valid_until
    where access_password_operations.valid_until<=clock_timestamp()
  returning id into operation;
  if operation is null then raise sqlstate '40001'; end if;
  return jsonb_build_object('id',operation,'email',target.email,'name',target.nombre);
end $$;
revoke all on function public.qms_temporary_access_command(text,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.qms_temporary_access_command(text,uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;

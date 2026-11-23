-- Acceso temporal opcional durante tres días hábiles (lunes a viernes, hora de Costa Rica).
-- Sin exponer secretos ni modificar los correos de Quejas.
set local lock_timeout='5s';
create or replace function qms_private.three_business_days_after(p_issued timestamptz)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare day_cursor timestamptz := p_issued; counted integer := 0;
begin
  if p_issued is null then return null; end if;
  while counted < 3 loop
    day_cursor := day_cursor + interval '1 day';
    if extract(isodow from day_cursor at time zone 'America/Costa_Rica') between 1 and 5 then
      counted := counted + 1;
    end if;
  end loop;
  return day_cursor;
end $$;
revoke all on function qms_private.three_business_days_after(timestamptz) from public,anon,authenticated,service_role;

alter table qms_private.access_policies
  add column if not exists temporary_password_issued_at timestamptz;

-- Las credenciales temporales todavía vigentes conservan su vigencia previa
-- y se amplían, cuando corresponde, al final del tercer día hábil.
-- No reactivar credenciales que ya estaban vencidas.
update qms_private.access_policies set
  temporary_password_issued_at=coalesce(temporary_password_issued_at,temporary_password_expires_at-interval '72 hours'),
  temporary_password_expires_at=case when temporary_password_expires_at>clock_timestamp()
    then greatest(temporary_password_expires_at,qms_private.three_business_days_after(
      coalesce(temporary_password_issued_at,temporary_password_expires_at-interval '72 hours')))
    else temporary_password_expires_at end
where temporary_password_expires_at is not null;

-- Respeta MFA requerido, sesión actual, perfil activo y caducidad.
CREATE OR REPLACE FUNCTION qms_private.access_ready(p_user uuid, p_session uuid, p_aal text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p qms_private.access_policies;
begin
 select * into p from qms_private.access_policies where auth_id=p_user;
 if not found then return true; end if; -- Compatibilidad: no impone política a cuentas anteriores.
 if p.reset_pending
  or not exists(select 1 from public.usuarios where auth_id=p_user and estado='activo')
  or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return false; end if;
 -- Permite el uso con contraseña temporal, solo durante tres días hábiles y
 -- con una sesión creada después de emitir esa contraseña.
 if p.password_set_at is null or p.must_change_password then
  if p.temporary_password_issued_at is null or p.temporary_password_expires_at<=now()
    or p.temporary_password_expires_at is null
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user
      and created_at>=p.temporary_password_issued_at) then return false; end if;
 end if;
 if not p.require_mfa then return true; end if;
 return p.factor_verified_at is not null and exists(select 1 from qms_private.access_sessions s
  where s.auth_id=p_user and s.session_id=p_session and s.generation=p.generation and s.method=p.method
   and s.expires_at>now() and (p.method='email' or p_aal='aal2'));
end $function$
;
CREATE OR REPLACE FUNCTION qms_private.access_summary(p_user uuid, p_session uuid, p_aal text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      (p.temporary_password_expires_at<=now() or (p.temporary_password_issued_at is null or signed_in_at<p.temporary_password_issued_at)) then 'password_expired'
    when qms_private.access_ready(p_user,p_session,p_aal) then 'ready'
    when (p.password_set_at is null or p.must_change_password) and p.temporary_password_expires_at is null then 'password'
    when p.blocked_until>now() then 'locked' when p.factor_verified_at is null then 'enroll' else 'verify' end;
  if p.alternative_email is not null then mail:=left(split_part(p.alternative_email,'@',1),3)||'***@'||split_part(p.alternative_email,'@',2); end if;
  return jsonb_build_object('managed',true,'phase',phase,'requireMfa',p.require_mfa,'method',p.method,
    'maskedEmail',mail,'blockedUntil',p.blocked_until,'generation',p.generation,
    'temporaryPassword',p.temporary_password_expires_at is not null,
    'temporaryPasswordExpiresAt',p.temporary_password_expires_at);
end $function$
;
CREATE OR REPLACE FUNCTION public.qms_access_command(p_action text, p_user uuid, p_session uuid, p_aal text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p qms_private.access_policies; c qms_private.access_creations; i qms_private.access_invitations;
 ch qms_private.access_challenges; profile public.usuarios; target uuid; op uuid; result jsonb; code text; address text; secret bytea; reserved boolean;
begin
 select * into profile from public.usuarios where auth_id=p_user and estado='activo';
 if profile.id is null then raise sqlstate '42501' using message='Acceso no disponible'; end if;
 if p_action='status' then return qms_private.access_summary(p_user,p_session,p_aal); end if;
 if p_action in('create_begin','create_commit','invite','invite_result','reset_begin','reset_finish','directory','email_check') then
  if profile.rol<>'admin' or not qms_private.access_ready(p_user,p_session,p_aal) then raise sqlstate '42501'; end if;
  if p_action='create_begin' then
   op:=(p_data->>'id')::uuid;
   insert into qms_private.access_creations(id,actor_id,email,payload) values(op,p_user,lower(p_data->>'email'),p_data)
    on conflict(id) do nothing returning true into reserved;
   select * into c from qms_private.access_creations where id=op for update;
   if c.actor_id is distinct from p_user or c.payload<>p_data then raise sqlstate '40001' using message='Solicitud de alta diferente'; end if;
   if c.completed_at is not null then return jsonb_build_object('completed',true,'authId',c.auth_id); end if;
   if not coalesce(reserved,false) and c.lease_until>now() then raise sqlstate '40001' using message='Alta en curso'; end if;
   -- Recupera solo Auth creado por esta operación, sin leer hashes/credenciales.
   select id into target from auth.users where lower(email)=c.email and raw_app_meta_data->>'qms_creation_id'=op::text;
   if target is null and exists(select 1 from auth.users where lower(email)=c.email) then raise sqlstate '23505' using message='El correo ya tiene una cuenta'; end if;
   if c.auth_id is not null and c.lease_until>now() then raise sqlstate '40001' using message='Alta en curso'; end if;
   update qms_private.access_creations set auth_id=target,lease_until=now()+interval '90 seconds' where id=op;
   return jsonb_build_object('completed',false,'authId',target);
  elsif p_action='create_commit' then
   op:=(p_data->>'id')::uuid; target:=(p_data->>'authId')::uuid;
   select * into c from qms_private.access_creations where id=op and actor_id=p_user for update;
   if c.id is null or not exists(select 1 from auth.users where id=target and lower(email)=c.email and raw_app_meta_data->>'qms_creation_id'=op::text) then raise sqlstate '42501'; end if;
   insert into public.usuarios(auth_id,nombre,email,rol,estado,ultimo_acceso)
    values(target,c.payload->>'nombre',c.email,c.payload->>'rol',c.payload->>'estado',null) on conflict(auth_id) do nothing;
   insert into qms_private.access_policies(auth_id,creation_id,invited,require_mfa)
    values(target,op,(c.payload->>'invite')::boolean,(c.payload->>'requireMfa')::boolean) on conflict(auth_id) do nothing;
   update qms_private.access_creations set auth_id=target,completed_at=now() where id=op;
   return jsonb_build_object('authId',target);
  elsif p_action='directory' then
   select coalesce(jsonb_agg(jsonb_build_object('authId',a.auth_id,'requireMfa',a.require_mfa,'method',a.method,
    'status',case when u.estado<>'activo' then 'disabled' when a.password_set_at is null and a.invited and v.expires_at<now() then 'invite_expired'
     when a.password_set_at is null and a.invited then 'invite_pending' when a.password_set_at is null then 'password_pending'
     when a.require_mfa and a.factor_verified_at is null then 'mfa_pending' else 'active' end,
    'invitationFailed',coalesce(v.delivery in('failed','uncertain'),false))),'[]'::jsonb) into result
   from qms_private.access_policies a join public.usuarios u on u.auth_id=a.auth_id
   left join lateral(select delivery,expires_at from qms_private.access_invitations where auth_id=a.auth_id order by created_at desc limit 1) v on true
   where a.auth_id in(select value::uuid from jsonb_array_elements_text(p_data->'ids'));
   return result;
  end if;
  target:=(p_data->>'authId')::uuid;
  select * into p from qms_private.access_policies where auth_id=target for update;
  if p_action='email_check' then
   if p.alternative_email is not null and lower(btrim(p_data->>'email'))=p.alternative_email then
    raise sqlstate '22023' using message='El correo principal debe ser distinto al alternativo';
   end if;
   return '{}';
  end if;
  if p.auth_id is null then raise sqlstate '42501' using message='Esta cuenta conserva su política anterior'; end if;
  if p_action='invite' then
   if not p.invited or p.password_set_at is not null then raise sqlstate '40001' using message='La cuenta ya configuró el acceso'; end if;
   if exists(select 1 from qms_private.access_invitations where auth_id=target and created_at>now()-interval '60 seconds') then raise sqlstate 'P0429' using message='Esperá un minuto antes de reenviar'; end if;
   update qms_private.access_invitations set revoked_at=now() where auth_id=target and used_at is null and revoked_at is null;
   insert into qms_private.access_invitations(id,auth_id,digest) values((p_data->>'id')::uuid,target,p_data->>'digest');
   return jsonb_build_object('email',(select email from public.usuarios where auth_id=target));
  elsif p_action='invite_result' then
   if p_data->>'delivery' not in('sent','failed','uncertain') then raise sqlstate '22023'; end if;
   update qms_private.access_invitations set delivery=p_data->>'delivery' where id=(p_data->>'id')::uuid and auth_id=target;
   return '{}';
  elsif p_action='reset_begin' then
   if target=p_user or not p.require_mfa then raise sqlstate '42501'; end if;
   update qms_private.access_policies set reset_pending=true,generation=generation+1,failures=0,blocked_until=null where auth_id=target;
   delete from qms_private.access_sessions where auth_id=target;
   delete from qms_private.access_challenges where auth_id=target;
   -- Revoca refresh sessions y el guard también rechaza JWT anteriores todavía vigentes.
   delete from auth.sessions where user_id=target;
   return jsonb_build_object('authId',target);
  elsif p_action='reset_finish' then
   if not p.reset_pending then raise sqlstate '40001'; end if;
   update qms_private.access_policies set reset_pending=false,method=null,factor_id=null,alternative_email=null,factor_verified_at=null where auth_id=target;
   return '{}';
  end if;
  raise sqlstate '22023';
 end if;

 select * into p from qms_private.access_policies where auth_id=p_user for update;
 if p.auth_id is null or p.reset_pending or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then raise sqlstate '42501'; end if;
 if p_action='password_done' then
  if not p.must_change_password then raise sqlstate '40001'; end if;
  update qms_private.access_policies set password_set_at=now(),must_change_password=false where auth_id=p_user;
  return qms_private.access_summary(p_user,p_session,p_aal);
 end if;
 if (p.password_set_at is null or p.must_change_password) and not (
   p.temporary_password_expires_at>clock_timestamp()
   and p.temporary_password_issued_at is not null
   and exists(select 1 from auth.sessions s where s.user_id=p_user and s.id=p_session
     and s.created_at>=p.temporary_password_issued_at)
  ) then raise sqlstate '42501' using message='Configurá primero tu contraseña'; end if;
 if p.blocked_until>now() then return jsonb_build_object('error','locked','blockedUntil',p.blocked_until); end if;
 if p.blocked_until is not null then
  update qms_private.access_policies set failures=0,blocked_until=null where auth_id=p_user; p.failures:=0;
 end if;
 if not p.require_mfa then raise sqlstate '42501'; end if;
 delete from qms_private.access_challenges where auth_id=p_user and expires_at<now()-interval '1 day';
 if p_action='email_send' then
  address:=case when p.factor_verified_at is not null then p.alternative_email else lower(btrim(p_data->>'email')) end;
  if p.factor_verified_at is not null and p.method<>'email' then raise sqlstate '42501'; end if;
  if address is null or length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
   or address=lower(profile.email) then raise sqlstate '22023' using message='Usá un correo diferente al de tu cuenta'; end if;
  if p.last_send_at>now()-interval '60 seconds' or (p.send_window_at>now()-interval '15 minutes' and p.send_count>=5) then
   return jsonb_build_object('error','rate_limited'); end if;
  update qms_private.access_policies set last_send_at=now(),send_window_at=case when send_window_at>now()-interval '15 minutes' then send_window_at else now() end,
   send_count=case when send_window_at>now()-interval '15 minutes' then send_count+1 else 1 end where auth_id=p_user;
  update qms_private.access_challenges set used_at=now() where auth_id=p_user and session_id=p_session and used_at is null;
  code:=lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint)%1000000)::text,6,'0');
  select otp_key into secret from qms_private.access_secrets where singleton;
  op:=gen_random_uuid();
  insert into qms_private.access_challenges(id,auth_id,session_id,generation,method,email,digest)
   values(op,p_user,p_session,p.generation,'email',address,extensions.hmac(op::text||':'||code,encode(secret,'hex'),'sha256'));
  return jsonb_build_object('id',op,'code',code,'email',address,'maskedEmail',left(split_part(address,'@',1),3)||'***@'||split_part(address,'@',2));
 elsif p_action='email_sent' then
  update qms_private.access_challenges set sent=(p_data->>'sent')::boolean where id=(p_data->>'id')::uuid and auth_id=p_user and session_id=p_session;
  return '{}';
 elsif p_action in('totp_bind','totp_attempt','totp_finish','email_verify') then
  if p.method is not null and p.method<>(case when p_action='email_verify' then 'email' else 'totp' end) then raise sqlstate '42501'; end if;
  if p_action='totp_bind' then
   if not exists(select 1 from auth.mfa_factors where id=(p_data->>'factorId')::uuid and user_id=p_user) then raise sqlstate '42501'; end if;
   if p.factor_id is not null and p.factor_id<>(p_data->>'factorId')::uuid then raise sqlstate '42501'; end if;
   update qms_private.access_challenges set used_at=now() where auth_id=p_user and session_id=p_session and used_at is null;
   insert into qms_private.access_challenges(id,auth_id,session_id,generation,method,factor_id,native_challenge_id,sent)
    values((p_data->>'id')::uuid,p_user,p_session,p.generation,'totp',(p_data->>'factorId')::uuid,(p_data->>'nativeId')::uuid,true);
   return '{}';
  end if;
  select * into ch from qms_private.access_challenges where id=(p_data->>'id')::uuid and auth_id=p_user and session_id=p_session for update;
  if ch.id is null or ch.used_at is not null or ch.expires_at<=now() or ch.generation<>p.generation or not ch.sent then return jsonb_build_object('error','invalid_code'); end if;
  if p_action='totp_attempt' then
   if ch.method<>'totp' or ch.verify_until>now() then return jsonb_build_object('error','busy'); end if;
   op:=gen_random_uuid(); update qms_private.access_challenges set verify_lease=op,verify_until=now()+interval '45 seconds' where id=ch.id;
   return jsonb_build_object('lease',op,'factorId',ch.factor_id,'nativeId',ch.native_challenge_id);
  elsif p_action='totp_finish' then
   if ch.method<>'totp' or ch.verify_lease is distinct from (p_data->>'lease')::uuid or ch.verify_until<=now() then raise sqlstate '40001'; end if;
   if p_data->>'valid'='true' and p_aal='aal2' and exists(select 1 from auth.mfa_factors where id=ch.factor_id and user_id=p_user and status='verified') then code:='valid'; end if;
   update qms_private.access_challenges set verify_lease=null,verify_until=null where id=ch.id;
  else
   select otp_key into secret from qms_private.access_secrets where singleton;
   if ch.method='email' and p_data->>'code' ~ '^[0-9]{6}$' and ch.digest=extensions.hmac(ch.id::text||':'||(p_data->>'code'),encode(secret,'hex'),'sha256') then code:='valid'; end if;
  end if;
  if code is distinct from 'valid' then
   update qms_private.access_policies set failures=least(5,failures+1),blocked_until=case when failures>=4 then now()+interval '10 minutes' else null end where auth_id=p_user;
   return jsonb_build_object('error',case when p.failures>=4 then 'locked' else 'invalid_code' end);
  end if;
  update qms_private.access_challenges set used_at=now(),digest=null where id=ch.id;
  update qms_private.access_policies set method=ch.method,factor_id=ch.factor_id,alternative_email=ch.email,
   factor_verified_at=coalesce(factor_verified_at,now()),failures=0,blocked_until=null where auth_id=p_user;
  insert into qms_private.access_sessions(auth_id,session_id,generation,method) values(p_user,p_session,p.generation,ch.method)
   on conflict(auth_id,session_id) do update set generation=excluded.generation,method=excluded.method,verified_at=now(),expires_at=now()+interval '12 hours';
  return qms_private.access_summary(p_user,p_session,p_aal);
 end if;
 raise sqlstate '22023';
end $function$
;
CREATE OR REPLACE FUNCTION qms_private.confirm_temporary_password()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op qms_private.access_password_operations; expires_at timestamptz; issued_at timestamptz; marker text;
begin
  select * into op from qms_private.access_password_operations where auth_id=new.id for update;
  select temporary_password_expires_at,temporary_password_issued_at into expires_at,issued_at from qms_private.access_policies where auth_id=new.id;
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
    insert into qms_private.access_policies(auth_id,creation_id,invited,require_mfa,temporary_password_issued_at,temporary_password_expires_at)
    values(new.id,op.id,false,false,clock_timestamp(),qms_private.three_business_days_after(clock_timestamp()))
    on conflict(auth_id) do update set invited=false, must_change_password=true, password_set_at=null,
      temporary_password_issued_at=excluded.temporary_password_issued_at,
      temporary_password_expires_at=excluded.temporary_password_expires_at;
    update qms_private.access_invitations set revoked_at=now()
      where auth_id=new.id and used_at is null and revoked_at is null;
    update auth.users set raw_app_meta_data=raw_app_meta_data-'qms_password_operation' where id=new.id;
  else
    if expires_at is null or expires_at<=clock_timestamp() or not exists(select 1 from auth.sessions
      where id=op.session_id and user_id=new.id and created_at>=issued_at) then
      raise sqlstate '42501';
    end if;
    update qms_private.access_policies set must_change_password=false, password_set_at=now(),
      temporary_password_expires_at=null,temporary_password_issued_at=null where auth_id=new.id;
    update auth.users set raw_user_meta_data=raw_user_meta_data-'qms_password_operation' where id=new.id;
  end if;
  delete from qms_private.access_password_operations where auth_id=new.id;
  return null;
end $function$
;
CREATE OR REPLACE FUNCTION public.qms_temporary_access_command(p_action text, p_user uuid, p_session uuid, p_aal text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare profile public.usuarios; target public.usuarios; reservation qms_private.access_creations;
  operation uuid; auth_id_target uuid; result jsonb;
begin
  select * into profile from public.usuarios where auth_id=p_user and estado='activo';
  if profile.id is null then raise sqlstate '42501'; end if;
  if p_action='change_begin' then
    if qms_private.access_summary(p_user,p_session,p_aal)->>'phase' not in('ready','password','enroll','verify') or not exists(
      select 1 from qms_private.access_policies p join auth.sessions s on s.user_id=p.auth_id
       where p.auth_id=p_user and s.id=p_session and p.must_change_password
        and p.temporary_password_expires_at>clock_timestamp()
        and p.temporary_password_issued_at is not null
        and s.created_at>=p.temporary_password_issued_at
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
      update qms_private.access_policies set temporary_password_issued_at=clock_timestamp(),
        temporary_password_expires_at=qms_private.three_business_days_after(clock_timestamp())
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
end $function$
;
notify pgrst,'reload schema';

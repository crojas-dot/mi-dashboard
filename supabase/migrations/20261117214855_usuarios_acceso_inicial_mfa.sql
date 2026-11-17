-- Acceso inicial solo para altas que optan por este contrato. No migra usuarios existentes.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';

create table qms_private.access_policies (
 auth_id uuid primary key references auth.users(id) on delete cascade,
 creation_id uuid not null unique,
 invited boolean not null,
 require_mfa boolean not null,
 password_set_at timestamptz,
 must_change_password boolean not null default true,
 method text check(method in('totp','email')),
 factor_id uuid,
 alternative_email text,
 factor_verified_at timestamptz,
 generation integer not null default 1 check(generation>0),
 reset_pending boolean not null default false,
 failures integer not null default 0 check(failures between 0 and 5),
 blocked_until timestamptz,
 last_send_at timestamptz,
 send_window_at timestamptz,
 send_count integer not null default 0,
 created_at timestamptz not null default now()
);
create table qms_private.access_creations (
 id uuid primary key, actor_id uuid references auth.users(id) on delete set null,
 payload jsonb not null, email text not null,
 auth_id uuid references auth.users(id) on delete set null,
 completed_at timestamptz, lease_until timestamptz not null default now()+interval '90 seconds'
);
create unique index access_creations_pending_email on qms_private.access_creations(email) where completed_at is null;
create index access_creations_actor on qms_private.access_creations(actor_id) where actor_id is not null;
create index access_creations_user on qms_private.access_creations(auth_id) where auth_id is not null;
create table qms_private.access_invitations (
 id uuid primary key, auth_id uuid not null references auth.users(id) on delete cascade,
 digest text not null unique check(digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default now()+interval '24 hours',
 used_at timestamptz, revoked_at timestamptz,
 delivery text not null default 'pending' check(delivery in('pending','sent','failed','uncertain')),
 created_at timestamptz not null default now()
);
create index access_invitations_user on qms_private.access_invitations(auth_id,created_at desc);
create table qms_private.access_sessions (
 auth_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 generation integer not null, method text not null check(method in('totp','email')),
 verified_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '12 hours',
 primary key(auth_id,session_id)
);
create table qms_private.access_challenges (
 id uuid primary key, auth_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 generation integer not null, method text not null check(method in('totp','email')),
 email text, digest bytea, factor_id uuid, native_challenge_id uuid,
 sent boolean not null default false, used_at timestamptz,
 verify_lease uuid, verify_until timestamptz,
 expires_at timestamptz not null default now()+interval '10 minutes', created_at timestamptz not null default now()
);
create index access_challenges_user on qms_private.access_challenges(auth_id,session_id,created_at desc);
create table qms_private.access_secrets(singleton boolean primary key check(singleton),otp_key bytea not null);
insert into qms_private.access_secrets values(true,extensions.gen_random_bytes(32));

do $$ declare t text; begin
 foreach t in array array['access_policies','access_creations','access_invitations','access_sessions','access_challenges','access_secrets'] loop
  execute format('alter table qms_private.%I enable row level security',t);
  execute format('revoke all on qms_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function qms_private.access_ready(p_user uuid,p_session uuid,p_aal text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p qms_private.access_policies;
begin
 select * into p from qms_private.access_policies where auth_id=p_user;
 if not found then return true; end if; -- Compatibilidad: no impone política a cuentas anteriores.
 if p.reset_pending or p.password_set_at is null or p.must_change_password
  or not exists(select 1 from public.usuarios where auth_id=p_user and estado='activo')
  or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return false; end if;
 if not p.require_mfa then return true; end if;
 return p.factor_verified_at is not null and exists(select 1 from qms_private.access_sessions s
  where s.auth_id=p_user and s.session_id=p_session and s.generation=p.generation and s.method=p.method
   and s.expires_at>now() and (p.method='email' or p_aal='aal2'));
end $$;
revoke all on function qms_private.access_ready(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.qms_access_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and qms_private.access_ready(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid,auth.jwt()->>'aal');
$$;
revoke all on function public.qms_access_allowed() from public,anon;
grant execute on function public.qms_access_allowed() to authenticated;

-- RLS pública/Realtime; el pre-request cubre RPC definer legacy.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in('r','p') and c.relrowsecurity and
   n.nspname='public'
 loop
  execute format('create policy qms_access_ready on %I.%I as restrictive for all to authenticated using ((select public.qms_access_allowed())) with check ((select public.qms_access_allowed()))',t.nspname,t.relname);
 end loop;
end $$;
-- Storage pertenece a supabase_storage_admin. Su única policy vigente de lectura
-- usa estos helpers: se conserva su contrato y ACL sin alterar tablas del proveedor.
create or replace function public.app_es_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select public.qms_access_allowed() and exists(select 1 from public.usuarios
  where auth_id=auth.uid() and estado='activo' and rol in('admin','calidad'));
$$;
create or replace function public.app_usuario_actual_id() returns uuid
language sql stable security definer set search_path='' as $$
 select id from public.usuarios where auth_id=(select auth.uid()) and estado='activo'
  and (select public.qms_access_allowed()) limit 1;
$$;
create function public.qms_check_access_request() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.qms_access_allowed() then
  raise sqlstate 'PT403' using message='ACCESS_SETUP_REQUIRED';
 end if;
end $$;
revoke all on function public.qms_check_access_request() from public,anon;
grant execute on function public.qms_check_access_request() to authenticated,service_role;
do $$ begin
 if exists(select 1 from pg_roles where rolname='authenticator') then
  if exists(select 1 from pg_db_role_setting s cross join unnest(s.setconfig) v
   where v like 'pgrst.db_pre_request=%' and v<>'pgrst.db_pre_request=public.qms_check_access_request') then
   raise exception 'Revisar el pre-request existente antes de integrar este guard';
  end if;
  alter role authenticator set pgrst.db_pre_request='public.qms_check_access_request';
 end if;
end $$;

create function qms_private.access_summary(p_user uuid,p_session uuid,p_aal text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p qms_private.access_policies; phase text; mail text;
begin
 if not exists(select 1 from public.usuarios where auth_id=p_user and estado='activo') then
  return jsonb_build_object('managed',false,'phase','blocked'); end if;
 select * into p from qms_private.access_policies where auth_id=p_user;
 if not found then return jsonb_build_object('managed',false,'phase','ready'); end if;
 phase:=case when p.reset_pending then 'reset_pending'
  when not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then 'blocked'
  when qms_private.access_ready(p_user,p_session,p_aal) then 'ready'
  when p.password_set_at is null or p.must_change_password then 'password'
  when p.blocked_until>now() then 'locked' when p.factor_verified_at is null then 'enroll' else 'verify' end;
 if p.alternative_email is not null then mail:=left(split_part(p.alternative_email,'@',1),3)||'***@'||split_part(p.alternative_email,'@',2); end if;
 return jsonb_build_object('managed',true,'phase',phase,'requireMfa',p.require_mfa,'method',p.method,
  'maskedEmail',mail,'blockedUntil',p.blocked_until,'generation',p.generation);
end $$;
revoke all on function qms_private.access_summary(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Un enlace enviado al correo anterior no puede reclamar la cuenta después
-- de una edición administrativa. Tampoco se fusionan primer y segundo factor.
create function qms_private.access_profile_email_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare alternate text;
begin
 if lower(new.email) is distinct from lower(old.email) then
  select alternative_email into alternate from qms_private.access_policies where auth_id=new.auth_id;
  if alternate is not null and lower(new.email)=alternate then
   raise sqlstate '22023' using message='El correo principal debe ser distinto al alternativo';
  end if;
  update qms_private.access_invitations set revoked_at=now()
   where auth_id=new.auth_id and used_at is null and revoked_at is null;
 end if;
 return new;
end $$;
revoke all on function qms_private.access_profile_email_changed() from public,anon,authenticated,service_role;
create trigger qms_access_profile_email before update of email on public.usuarios
 for each row execute function qms_private.access_profile_email_changed();

-- Única entrada de servidor. p_user/session/aal provienen del JWT verificado,
-- nunca del JSON del navegador. No concede EXECUTE a clientes autenticados.
create function public.qms_access_command(p_action text,p_user uuid,p_session uuid,p_aal text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
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
 if p.password_set_at is null or p.must_change_password then raise sqlstate '42501' using message='Configurá primero tu contraseña'; end if;
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
end $$;
revoke all on function public.qms_access_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.qms_access_command(text,uuid,uuid,text,jsonb) to service_role;

create function public.qms_redeem_access_invitation(p_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i qms_private.access_invitations;
begin
 select * into i from qms_private.access_invitations where digest=p_digest for update;
 if i.id is null or i.used_at is not null or i.revoked_at is not null or i.expires_at<=now()
  or not exists(select 1 from public.usuarios u join qms_private.access_policies a on a.auth_id=u.auth_id
   where u.auth_id=i.auth_id and u.estado='activo' and a.invited and a.password_set_at is null) then
  raise sqlstate '42501' using message='Invitación no disponible'; end if;
 update qms_private.access_invitations set used_at=now() where id=i.id;
 return jsonb_build_object('authId',i.auth_id,'email',(select email from public.usuarios where auth_id=i.auth_id));
end $$;
revoke all on function public.qms_redeem_access_invitation(text) from public,anon,authenticated;
grant execute on function public.qms_redeem_access_invitation(text) to service_role;

create function public.qms_access_mail_transport() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('endpoint',endpoint,'enabled',enabled) from qms_private.mail_wake_settings where singleton;
$$;
revoke all on function public.qms_access_mail_transport() from public,anon,authenticated;
grant execute on function public.qms_access_mail_transport() to service_role;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;

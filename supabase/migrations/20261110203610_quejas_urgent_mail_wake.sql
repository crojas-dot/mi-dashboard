-- Despertador después del commit, sin datos del ciudadano ni envío desde PostgreSQL.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public,anon,authenticated,service_role;
revoke all on all tables in schema net from public,anon,authenticated,service_role;
revoke all on all sequences in schema net from public,anon,authenticated,service_role;
revoke all on all functions in schema net from public,anon,authenticated,service_role;

create table qms_private.mail_wake_settings (
 singleton boolean primary key default true check(singleton),
 endpoint text not null check(endpoint ~ '^https://script[.]google[.]com/macros/s/[A-Za-z0-9_-]{20,200}/exec$'),
 secret_id uuid not null,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table qms_private.mail_wake_settings enable row level security;
revoke all on qms_private.mail_wake_settings from public,anon,authenticated,service_role;

create function public.qms_mail_wake_configuration() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('url',s.endpoint,'secret',v.decrypted_secret,'enabled',s.enabled)
 from qms_private.mail_wake_settings s join vault.decrypted_secrets v on v.id=s.secret_id where s.singleton
$$;

create function public.qms_mail_configure_wake(p_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key_id uuid;
begin
 if p_url is null or p_url !~ '^https://script[.]google[.]com/macros/s/[A-Za-z0-9_-]{20,200}/exec$' then raise exception 'Destino de correo inválido.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(91503401);
 select secret_id into key_id from qms_private.mail_wake_settings where singleton for update;
 if key_id is null then
  key_id:=vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'qms_mail_wake_v1','Clave dedicada del despertador de correo de Quejas');
  insert into qms_private.mail_wake_settings(singleton,endpoint,secret_id) values(true,p_url,key_id);
 else
  update qms_private.mail_wake_settings set endpoint=p_url,enabled=false,updated_at=now() where singleton;
 end if;
 return public.qms_mail_wake_configuration();
end $$;

create function public.qms_mail_set_wake_enabled(p_url text,p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null then raise exception 'Configuración inválida.' using errcode='22023'; end if;
 update qms_private.mail_wake_settings set enabled=p_enabled,updated_at=now() where singleton and endpoint=p_url;
 if not found then raise exception 'El destino de correo cambió.' using errcode='40001'; end if;
 return p_enabled;
end $$;

create function qms_private.request_mail_wake() returns boolean
language plpgsql security definer set search_path='' as $$
declare config record; moment bigint; nonce uuid; signature text; envelope jsonb;
begin
 if current_setting('qms.mail_wake_scheduled',true)='true' then return false; end if;
 select s.endpoint,v.decrypted_secret into config from qms_private.mail_wake_settings s
 join vault.decrypted_secrets v on v.id=s.secret_id where s.singleton and s.enabled;
 if not found or length(config.decrypted_secret)<32 then return false; end if;
 moment:=floor(extract(epoch from clock_timestamp()))::bigint; nonce:=gen_random_uuid();
 signature:=encode(extensions.hmac(convert_to('eca-qms-mail:v1:queue_wake_request'||chr(10)||moment::text||chr(10)||nonce::text||chr(10)||'e30','UTF8'),convert_to(config.decrypted_secret,'UTF8'),'sha256'),'hex');
 envelope:=jsonb_build_object('version',1,'purpose','queue_wake_request','issuedAt',moment,'nonce',nonce,'payload','e30','signature',signature);
 perform net.http_post(url:=config.endpoint,body:=envelope,headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=60000);
 perform set_config('qms.mail_wake_scheduled','true',true);
 return true;
exception when others then
 -- Una falla del despertador nunca revierte un registro/publicación confirmado.
 return false;
end $$;

create function qms_private.mail_wake_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform qms_private.request_mail_wake(); return new; end $$;
create trigger qms_wake_citizen_mail after insert on public.queja_mail_outbox
for each row when (new.tipo in ('recibido','final') and new.status='pending') execute function qms_private.mail_wake_trigger();
create trigger qms_wake_completed_form after update of finalized_at on public.public_form_submissions
for each row when (old.finalized_at is null and new.finalized_at is not null) execute function qms_private.mail_wake_trigger();

-- El despertador reclama solo los dos hitos ciudadanos; los avisos internos conservan su poll.
create function public.qms_mail_claim_urgent_batch(p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint)
returns table(id uuid,claim_token uuid,tipo text,destinatario text,folio text,estado text,numero_oficio text,public_tracking jsonb,correo jsonb)
language plpgsql security definer set search_path='' as $$
declare inserted integer; moment bigint:=floor(extract(epoch from now()))::bigint;
begin
 if p_limit is null or p_limit not between 0 and 2 or p_lease_seconds is null or p_lease_seconds not between 60 and 600
  or p_run_nonce is null or p_issued_at is null or p_issued_at<moment-300 or p_issued_at>moment+30 then raise exception 'Solicitud de worker inválida.' using errcode='22023'; end if;
 delete from public.queja_mail_run_nonces where nonce in(select n.nonce from public.queja_mail_run_nonces n where n.expires_at<now() order by n.expires_at limit 1000);
 insert into public.queja_mail_run_nonces values(p_run_nonce,now()+interval '10 minutes') on conflict(nonce) do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 or p_limit=0 then return; end if;
 update public.queja_mail_outbox o set status='uncertain',safe_error='lease_expired',updated_at=now() where o.tipo in ('recibido','final') and o.status='leased' and o.lease_until<=now();
 update public.queja_mail_outbox o set status='failed',safe_error='attempt_limit',updated_at=now() where o.tipo in ('recibido','final') and o.status in ('pending','retry') and o.attempts>=12;
 return query with candidates as (
  select o.id from public.queja_mail_outbox o where o.tipo in ('recibido','final') and o.status in ('pending','retry') and o.next_attempt_at<=now() and o.attempts<12
   and not exists(select 1 from public.public_form_submissions s where s.queja_id=o.queja_id and s.finalized_at is null)
   and not exists(select 1 from public.queja_mail_outbox prior where prior.queja_id=o.queja_id and o.tipo='final' and prior.tipo='recibido' and prior.status<>'sent')
  order by o.next_attempt_at,o.id limit p_limit for update skip locked
 ), claimed as (
  update public.queja_mail_outbox o set status='leased',claim_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
  from candidates c where o.id=c.id returning o.*
 ) select c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio,c.public_tracking,
   case when c.tipo='final' and c.correo_asunto is not null then jsonb_build_object('subject',c.correo_asunto,'body',c.correo_cuerpo) end from claimed c;
end $$;

revoke all on function public.qms_mail_wake_configuration(),public.qms_mail_configure_wake(text),public.qms_mail_set_wake_enabled(text,boolean),public.qms_mail_claim_urgent_batch(integer,integer,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.qms_mail_wake_configuration(),public.qms_mail_configure_wake(text),public.qms_mail_set_wake_enabled(text,boolean),public.qms_mail_claim_urgent_batch(integer,integer,uuid,bigint) to service_role;
revoke all on function qms_private.request_mail_wake(),qms_private.mail_wake_trigger() from public,anon,authenticated,service_role;
commit;

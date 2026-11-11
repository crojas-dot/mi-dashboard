-- Aprovisionamiento acotado del emisor: solo máquina, destino fijado y sin enviar correo.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table qms_private.mail_wake_settings add column setup_request_id bigint;

create function public.qms_mail_setup_wake(p_envelope jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare config qms_private.mail_wake_settings%rowtype; request_id bigint; moment bigint;
begin
 select * into config from qms_private.mail_wake_settings where singleton for update;
 if not found or config.enabled then raise exception 'Configuración no disponible.' using errcode='40001'; end if;
 moment:=floor(extract(epoch from clock_timestamp()))::bigint;
 if jsonb_typeof(p_envelope) is distinct from 'object' or octet_length(p_envelope::text)>4096
  or (select count(*) from jsonb_object_keys(p_envelope))<>6
  or p_envelope->>'purpose' is distinct from 'queue_wake_setup_request'
  or p_envelope->>'version' is distinct from '1'
  or coalesce(p_envelope->>'issuedAt','') !~ '^[0-9]{10}$'
  or coalesce(p_envelope->>'nonce','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or coalesce(p_envelope->>'signature','') !~ '^[a-f0-9]{64}$'
  or length(coalesce(p_envelope->>'payload','')) not between 1 and 1024
  or coalesce(p_envelope->>'payload','') !~ '^[A-Za-z0-9_-]+$' then
  raise exception 'Solicitud inválida.' using errcode='22023';
 end if;
 if (p_envelope->>'issuedAt')::bigint not between moment-300 and moment+30 then raise exception 'Solicitud vencida.' using errcode='22023'; end if;
 -- La firma se comprueba en Apps Script. No se almacena el sobre ni la clave maestra.
 request_id:=net.http_post(url:=config.endpoint,body:=p_envelope,headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=60000);
 update qms_private.mail_wake_settings set setup_request_id=request_id where singleton;
 return request_id;
end $$;

create function public.qms_mail_setup_wake_result(p_request_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result record;
begin
 if not exists(select 1 from qms_private.mail_wake_settings where singleton and setup_request_id=p_request_id and not enabled) then
  raise exception 'Solicitud no disponible.' using errcode='42501';
 end if;
 select status_code,timed_out,error_msg,content into result from net._http_response where id=p_request_id;
 if not found then return jsonb_build_object('pending',true); end if;
 if result.timed_out or result.error_msg is not null or result.status_code<>200 or octet_length(result.content)>8192 then
  return jsonb_build_object('pending',false,'error','setup_transport_unavailable');
 end if;
 return jsonb_build_object('pending',false,'receipt',result.content::jsonb);
exception when invalid_text_representation then return jsonb_build_object('pending',false,'error','setup_invalid_receipt');
end $$;

revoke all on function public.qms_mail_setup_wake(jsonb),public.qms_mail_setup_wake_result(bigint) from public,anon,authenticated,service_role;
grant execute on function public.qms_mail_setup_wake(jsonb),public.qms_mail_setup_wake_result(bigint) to service_role;
commit;

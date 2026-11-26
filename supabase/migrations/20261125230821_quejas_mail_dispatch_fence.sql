-- Reserva de entrega en la misma fila del outbox, antes de llamar a Gmail.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.queja_mail_outbox
  add column dispatch_started_at timestamptz,
  add constraint queja_mail_outbox_dispatch_state_check
    check (dispatch_started_at is null or status in ('leased', 'sent', 'uncertain'));

create function public.qms_mail_begin_dispatch(p_id uuid, p_claim_token uuid)
returns boolean
language sql security invoker set search_path = ''
as $$
  with started as (
    update public.queja_mail_outbox o
       set dispatch_started_at = clock_timestamp(), updated_at = clock_timestamp()
     where o.id = p_id and o.claim_token = p_claim_token and o.status = 'leased'
       and o.lease_until > clock_timestamp() and o.dispatch_started_at is null
       and public.qms_mail_authorize_v2(p_id, p_claim_token)
     returning 1
  )
  select exists (select 1 from started);
$$;

revoke all on function public.qms_mail_begin_dispatch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.qms_mail_begin_dispatch(uuid, uuid) to service_role;

-- Si ya se reservó la llamada a Gmail, un resultado ambiguo solo permite uncertain.
-- Las reservas antiguas se siguen confirmando con el protocolo previo.
create or replace function public.qms_mail_complete(p_id uuid, p_claim_token uuid, p_outcome text, p_retry_delay_seconds integer, p_safe_error text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
 if p_outcome is null or p_outcome not in('sent','retry','uncertain','failed','skipped')
  or p_retry_delay_seconds is null or p_retry_delay_seconds not between 60 and 86400
  or (p_safe_error is not null and p_safe_error !~ '^[a-z_]{1,60}$')
  or (p_outcome='skipped' and p_safe_error is distinct from 'obsolete_notice') then raise exception 'Resultado de worker inválido.' using errcode='22023'; end if;
 update public.queja_mail_outbox o set status=p_outcome,
  next_attempt_at=case when p_outcome='retry' then now()+make_interval(secs=>p_retry_delay_seconds) else o.next_attempt_at end,
  sent_at=case when p_outcome='sent' then now() else o.sent_at end,
  safe_error=case when p_outcome='sent' then null else p_safe_error end,
  claim_token=null,lease_until=null,updated_at=now()
 where o.id=p_id and o.claim_token=p_claim_token and o.status='leased' and o.lease_until>now()
  and (o.dispatch_started_at is null or p_outcome in('sent','uncertain'))
  and (p_outcome<>'skipped' or o.tipo like 'interno_%' or o.tipo in('solicitud_informacion','final'));
 get diagnostics affected=row_count;
 return affected=1;
end;
$$;

revoke all on function public.qms_mail_complete(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.qms_mail_complete(uuid, uuid, text, integer, text) to service_role;
commit;

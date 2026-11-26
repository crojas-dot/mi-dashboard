begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- El claim puede crear avisos de vencimiento y reservarlos en la misma llamada.
-- Proyectarlos en otra sentencia permite leer las filas recién insertadas.
create or replace function public.qms_mail_claim_batch_v3(
  p_limit integer, p_lease_seconds integer, p_run_nonce uuid, p_issued_at bigint
) returns table(
  id uuid, claim_token uuid, tipo text, destinatario text, folio text,
  estado text, numero_oficio text, public_tracking jsonb
)
language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  claimed_ids uuid[];
begin
  select array_agg(c.id order by c.ordinality) into claimed_ids
  from public.qms_mail_claim_batch_v2(p_limit, p_lease_seconds, p_run_nonce, p_issued_at) with ordinality c;

  return query
  select o.id, o.claim_token, o.tipo, o.destinatario, o.folio, o.estado, o.numero_oficio, o.public_tracking
  from unnest(claimed_ids) with ordinality c(id, ord)
  join public.queja_mail_outbox o on o.id = c.id
  order by c.ord;
end;
$function$;

create or replace function public.qms_mail_claim_batch_v4(
  p_limit integer, p_lease_seconds integer, p_run_nonce uuid, p_issued_at bigint
) returns table(
  id uuid, claim_token uuid, tipo text, destinatario text, folio text,
  estado text, numero_oficio text, public_tracking jsonb, correo jsonb
)
language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  claimed_ids uuid[];
begin
  select array_agg(c.id order by c.ordinality) into claimed_ids
  from public.qms_mail_claim_batch_v2(p_limit, p_lease_seconds, p_run_nonce, p_issued_at) with ordinality c;

  return query
  select o.id, o.claim_token, o.tipo, o.destinatario, o.folio, o.estado, o.numero_oficio, o.public_tracking,
    case when o.correo_asunto is not null then jsonb_build_object('subject', o.correo_asunto, 'body', o.correo_cuerpo) end
  from unnest(claimed_ids) with ordinality c(id, ord)
  join public.queja_mail_outbox o on o.id = c.id
  order by c.ord;
end;
$function$;

revoke all on function public.qms_mail_claim_batch_v3(integer, integer, uuid, bigint),
  public.qms_mail_claim_batch_v4(integer, integer, uuid, bigint) from public, anon, authenticated;
grant execute on function public.qms_mail_claim_batch_v3(integer, integer, uuid, bigint),
  public.qms_mail_claim_batch_v4(integer, integer, uuid, bigint) to service_role;

commit;

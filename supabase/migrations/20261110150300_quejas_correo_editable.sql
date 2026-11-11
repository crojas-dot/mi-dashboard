-- Correo de acompañamiento separado de la respuesta pública y del informe.
-- Los RPC y sobres anteriores conservan su contrato; no se rellenan históricos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.queja_response_drafts add column correo_asunto text, add column correo_cuerpo text;
alter table public.queja_mail_outbox add column correo_asunto text, add column correo_cuerpo text;

-- Contar unidades UTF-16 igual que JS/Apps Script, también con caracteres astrales.
alter table public.queja_response_drafts add constraint response_draft_email_check check (
  (correo_asunto is null and correo_cuerpo is null) or
  (correo_asunto is not null and correo_cuerpo is not null
   and length(correo_asunto)+length(regexp_replace(correo_asunto,U&'[\0001-\FFFF]','','g'))<=180
   and length(correo_cuerpo)+length(regexp_replace(correo_cuerpo,U&'[\0001-\FFFF]','','g'))<=3500
   and correo_asunto !~ '[[:cntrl:]]'
   and regexp_replace(correo_cuerpo,E'[\t\n\r]','','g') !~ '[[:cntrl:]]')
);
alter table public.queja_mail_outbox add constraint outbox_email_check check (
  (correo_asunto is null and correo_cuerpo is null) or
  (tipo='final' and correo_asunto is not null and correo_cuerpo is not null
   and length(btrim(correo_asunto))>0 and length(btrim(correo_cuerpo,E' \t\n\r'))>0
   and length(correo_asunto)+length(regexp_replace(correo_asunto,U&'[\0001-\FFFF]','','g'))<=180
   and length(correo_cuerpo)+length(regexp_replace(correo_cuerpo,U&'[\0001-\FFFF]','','g'))<=3500
   and correo_asunto !~ '[[:cntrl:]]'
   and regexp_replace(correo_cuerpo,E'[\t\n\r]','','g') !~ '[[:cntrl:]]')
);

create function qms_private.email_delivery_ready() returns boolean
language sql stable security invoker set search_path='' as $$select false$$;
revoke all on function qms_private.email_delivery_ready() from public,anon,authenticated,service_role;

create function qms_private.validate_response_email(p_subject text,p_body text,p_required boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_subject is null or p_body is null
    or length(p_subject)+length(regexp_replace(p_subject,U&'[\0001-\FFFF]','','g'))>180
    or length(p_body)+length(regexp_replace(p_body,U&'[\0001-\FFFF]','','g'))>3500
    or p_subject ~ '[[:cntrl:]]'
    or regexp_replace(p_body,E'[\t\n\r]','','g') ~ '[[:cntrl:]]'
    or (p_required and (nullif(btrim(p_subject),'') is null or nullif(btrim(p_body,E' \t\n\r'),'') is null)) then
    raise exception 'Revisá el asunto y el mensaje del correo.' using errcode='22023';
  end if;
end $$;
revoke all on function qms_private.validate_response_email(text,text,boolean) from public,anon,authenticated,service_role;

create function qms_private.save_response_email(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.queja_response_drafts;
begin
  -- El guard existente comprueba identidad, permiso, revisión y estado antes de escribir.
  perform qms_private.quality_case(p_id,p_expected);
  perform qms_private.validate_response_email(p_email_subject,p_email_body,false);
  perform qms_private.save_response_draft(p_id,p_expected,p_version,p_response,p_office,p_file);
  update public.queja_response_drafts set correo_asunto=btrim(p_email_subject),correo_cuerpo=btrim(p_email_body,E' \t\n\r')
    where queja_id=p_id returning * into result;
  return to_jsonb(result);
end $$;

create function qms_private.publish_response_email(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; q public.quejas; affected integer;
begin
  q:=qms_private.quality_case(p_id,p_expected);
  if not qms_private.email_delivery_ready() then
    raise exception 'El envío del correo editado todavía no está disponible. Guardá el borrador para conservarlo.' using errcode='55000';
  end if;
  perform qms_private.validate_response_email(p_email_subject,p_email_body,true);
  if coalesce(q.email_cliente,'') !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then
    raise exception 'El interesado no tiene un correo válido para el envío.' using errcode='22023';
  end if;
  -- Una comunicación histórica o incierta nunca se modifica ni se vuelve a enviar.
  if exists(select 1 from public.queja_mail_outbox where queja_id=p_id and tipo='final') then
    raise exception 'El expediente ya tiene una comunicación final registrada.' using errcode='55000';
  end if;
  result:=qms_private.publish_response(p_id,p_expected,p_version,p_response,p_office,p_file);
  update public.queja_response_drafts set correo_asunto=btrim(p_email_subject),correo_cuerpo=btrim(p_email_body,E' \t\n\r') where queja_id=p_id;
  -- La fila recién creada no es visible al emisor hasta el COMMIT de esta operación.
  update public.queja_mail_outbox set correo_asunto=btrim(p_email_subject),correo_cuerpo=btrim(p_email_body,E' \t\n\r')
    where queja_id=p_id and tipo='final' and status='pending' and claim_token is null;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'No se pudo registrar el correo de acompañamiento.' using errcode='55000'; end if;
  return result;
end $$;

create function public.qms_save_response_draft_v2(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.save_response_email(p_id,p_expected,p_version,p_response,p_office,p_file,p_email_subject,p_email_body)$$;
create function public.qms_publish_approved_response_v2(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.publish_response_email(p_id,p_expected,p_version,p_response,p_office,p_file,p_email_subject,p_email_body)$$;

revoke all on function qms_private.save_response_email(uuid,bigint,bigint,text,text,uuid,text,text),
 qms_private.publish_response_email(uuid,bigint,bigint,text,text,uuid,text,text),
 public.qms_save_response_draft_v2(uuid,bigint,bigint,text,text,uuid,text,text),
 public.qms_publish_approved_response_v2(uuid,bigint,bigint,text,text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function qms_private.save_response_email(uuid,bigint,bigint,text,text,uuid,text,text),
 qms_private.publish_response_email(uuid,bigint,bigint,text,text,uuid,text,text),
 public.qms_save_response_draft_v2(uuid,bigint,bigint,text,text,uuid,text,text),
 public.qms_publish_approved_response_v2(uuid,bigint,bigint,text,text,uuid,text,text) to authenticated;

create function public.qms_mail_claim_batch_v4(p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint)
returns table(id uuid,claim_token uuid,tipo text,destinatario text,folio text,estado text,numero_oficio text,public_tracking jsonb,correo jsonb)
language sql security invoker set search_path='' as $$
 select c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio,c.public_tracking,
   case when o.tipo='final' and o.correo_asunto is not null then jsonb_build_object('subject',o.correo_asunto,'body',o.correo_cuerpo) end
 from public.qms_mail_claim_batch_v3(p_limit,p_lease_seconds,p_run_nonce,p_issued_at) c join public.queja_mail_outbox o on o.id=c.id
$$;
revoke all on function public.qms_mail_claim_batch_v4(integer,integer,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.qms_mail_claim_batch_v4(integer,integer,uuid,bigint) to service_role;

-- El autorizador anterior solo contempla avisos internos (usuario_id no nulo).
-- Esta versión mantiene esa regla y valida aparte los envíos ciudadanos.
create function public.qms_mail_authorize_v2(p_id uuid,p_claim_token uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.queja_mail_outbox o
  where o.id=p_id and o.claim_token=p_claim_token and o.status='leased' and o.lease_until>now()
   and (
    (o.tipo like 'interno_%' and public.qms_mail_authorize(p_id,p_claim_token))
    or (o.tipo='recibido' and exists(select 1 from public.quejas q where q.id=o.queja_id and lower(btrim(q.email_cliente))=o.destinatario))
    or (o.tipo='final' and exists(
      select 1 from public.quejas q join public.queja_public_resolutions p on p.queja_id=q.id
       join public.queja_adjuntos d on d.id=p.adjunto_id and d.queja_id=q.id
      where q.id=o.queja_id and lower(btrim(q.email_cliente))=o.destinatario
       and ((o.estado='Resuelto' and q.estado in ('Resuelto','Finalizado')) or (o.estado='No Procede' and q.estado='No Procede'))
       and d.usuario_id is not null and not exists(select 1 from public.queja_attachment_deletions x where x.adjunto_id=d.id)
    ))
   ))
$$;
revoke all on function public.qms_mail_authorize_v2(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.qms_mail_authorize_v2(uuid,uuid) to service_role;

comment on column public.queja_response_drafts.correo_cuerpo is 'Correo de acompañamiento editable, independiente de respuesta pública e informe.';
comment on column public.queja_mail_outbox.correo_cuerpo is 'Snapshot autorizado e inmutable para el envío final; NULL conserva la plantilla histórica.';
notify pgrst,'reload schema';
commit;

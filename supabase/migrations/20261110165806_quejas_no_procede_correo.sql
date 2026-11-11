-- No Procede usa el mismo borrador de comunicación, conservando motivo/formato.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.queja_response_drafts add column motivo_no_procede text, add column motivo_no_procede_formato text;
alter table public.queja_response_drafts add constraint rejected_draft_reason_check check (
 (motivo_no_procede is null and motivo_no_procede_formato is null) or
 (motivo_no_procede is not null and length(motivo_no_procede)<=10000 and motivo_no_procede_formato is not null and motivo_no_procede_formato in ('plain','markdown'))
);

create function qms_private.save_rejected_email(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text,p_reason text,p_reason_format text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quejas; d public.queja_response_drafts; result public.queja_response_drafts;
begin
 q:=qms_private.quality_case(p_id,p_expected);
 if q.estado<>'Recibido' or exists(select 1 from public.queja_public_resolutions where queja_id=p_id) then
  raise exception 'La no procedencia ya fue publicada o la evaluación ya cambió.' using errcode='55000';
 end if;
 perform qms_private.validate_response_email(p_email_subject,p_email_body,false);
 if p_version is null or p_version<0 or p_response is null or length(p_response)>10000
  or p_office is null or length(p_office)>120 or p_office ~ '[[:cntrl:]]'
  or p_reason is null or length(p_reason)>10000 or p_reason_format is null or p_reason_format not in ('plain','markdown') then
  raise exception 'Revisá la justificación y el número de oficio.' using errcode='22023';
 end if;
 select * into d from public.queja_response_drafts where queja_id=p_id for update;
 if coalesce(d.version,0)<>p_version then raise exception 'Otra persona guardó el borrador. Conservá tus cambios.' using errcode='40001'; end if;
 if p_file is not null then perform qms_private.quality_document(p_id,p_file); end if;
 insert into public.queja_response_drafts(queja_id,version,respuesta,numero_oficio,adjunto_id,actualizado_por,correo_asunto,correo_cuerpo,motivo_no_procede,motivo_no_procede_formato)
 values(p_id,p_version+1,btrim(p_response),btrim(p_office),p_file,public.app_usuario_actual_id(),btrim(p_email_subject),btrim(p_email_body,E' \t\n\r'),btrim(p_reason),p_reason_format)
 on conflict(queja_id) do update set version=excluded.version,respuesta=excluded.respuesta,numero_oficio=excluded.numero_oficio,adjunto_id=excluded.adjunto_id,actualizado_por=excluded.actualizado_por,correo_asunto=excluded.correo_asunto,correo_cuerpo=excluded.correo_cuerpo,motivo_no_procede=excluded.motivo_no_procede,motivo_no_procede_formato=excluded.motivo_no_procede_formato,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;

create function qms_private.publish_rejected_email(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text,p_reason text,p_reason_format text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quejas; result jsonb; affected integer;
begin
 q:=qms_private.quality_case(p_id,p_expected);
 if not qms_private.email_delivery_ready() then raise exception 'El envío del correo no está disponible.' using errcode='55000'; end if;
 perform qms_private.validate_response_email(p_email_subject,p_email_body,true);
 if nullif(btrim(p_reason),'') is null or nullif(btrim(p_response),'') is null or nullif(btrim(p_office),'') is null then
  raise exception 'Completá la justificación, el oficio y la respuesta.' using errcode='22023';
 end if;
 if coalesce(q.email_cliente,'') !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then raise exception 'El interesado no tiene un correo válido.' using errcode='22023'; end if;
 if exists(select 1 from public.queja_mail_outbox where queja_id=p_id and tipo='final') then raise exception 'El expediente ya tiene una comunicación final registrada.' using errcode='55000'; end if;
 perform qms_private.quality_document(p_id,p_file);
 perform qms_private.save_rejected_email(p_id,p_expected,p_version,p_response,p_office,p_file,p_email_subject,p_email_body,p_reason,p_reason_format);
 -- El puente vigente conserva workflow, auditoría, oficio único y revisión original.
 result:=public.qms_resolve_complaint_with_document(p_id,'rejected',jsonb_build_object('resolution',btrim(p_reason),'resolution_format',p_reason_format,'office_number',btrim(p_office)),p_expected,p_file,btrim(p_response));
 update public.queja_mail_outbox set correo_asunto=btrim(p_email_subject),correo_cuerpo=btrim(p_email_body,E' \t\n\r') where queja_id=p_id and tipo='final' and status='pending' and claim_token is null;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'No se pudo registrar el correo final.' using errcode='55000'; end if;
 return result;
end $$;

create function public.qms_save_rejected_response_draft(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text,p_reason text,p_reason_format text)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.save_rejected_email(p_id,p_expected,p_version,p_response,p_office,p_file,p_email_subject,p_email_body,p_reason,p_reason_format)$$;
create function public.qms_publish_rejected_response(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid,p_email_subject text,p_email_body text,p_reason text,p_reason_format text)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.publish_rejected_email(p_id,p_expected,p_version,p_response,p_office,p_file,p_email_subject,p_email_body,p_reason,p_reason_format)$$;

revoke all on function qms_private.save_rejected_email(uuid,bigint,bigint,text,text,uuid,text,text,text,text),qms_private.publish_rejected_email(uuid,bigint,bigint,text,text,uuid,text,text,text,text),public.qms_save_rejected_response_draft(uuid,bigint,bigint,text,text,uuid,text,text,text,text),public.qms_publish_rejected_response(uuid,bigint,bigint,text,text,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function qms_private.save_rejected_email(uuid,bigint,bigint,text,text,uuid,text,text,text,text),qms_private.publish_rejected_email(uuid,bigint,bigint,text,text,uuid,text,text,text,text),public.qms_save_rejected_response_draft(uuid,bigint,bigint,text,text,uuid,text,text,text,text),public.qms_publish_rejected_response(uuid,bigint,bigint,text,text,uuid,text,text,text,text) to authenticated;

-- Un borrador de rechazo abandonado no se incorpora a una resolución aprobada.
CREATE OR REPLACE FUNCTION qms_private.save_response_draft(p_id uuid, p_expected bigint, p_version bigint, p_response text, p_office text, p_file uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quejas; d public.queja_response_drafts; result public.queja_response_drafts;
begin
  q:=qms_private.quality_case(p_id,p_expected);
  if q.estado<>'Resuelto' or exists(select 1 from public.queja_public_resolutions where queja_id=p_id) then
    raise exception 'La respuesta ya está publicada o la resolución no está aprobada.' using errcode='55000';
  end if;
  if p_version is null or p_version<0 or p_response is null or length(p_response)>10000
    or p_office is null or length(p_office)>120 or p_office ~ '[[:cntrl:]]' then
    raise exception 'Revisá la respuesta y el número de oficio.' using errcode='22023';
  end if;
  select * into d from public.queja_response_drafts where queja_id=p_id for update;
  if coalesce(d.version,0)<>p_version then
    raise exception 'Otra persona guardó el borrador. Tu texto se conserva; compará los cambios antes de reintentar.' using errcode='40001';
  end if;
  if p_file is not null then perform qms_private.quality_document(p_id,p_file); end if;
  insert into public.queja_response_drafts(queja_id,version,respuesta,numero_oficio,adjunto_id,actualizado_por)
    values(p_id,p_version+1,btrim(p_response),btrim(p_office),p_file,public.app_usuario_actual_id())
    on conflict(queja_id) do update set version=excluded.version,respuesta=excluded.respuesta,numero_oficio=excluded.numero_oficio,
      adjunto_id=excluded.adjunto_id,motivo_no_procede=null,motivo_no_procede_formato=null,actualizado_por=excluded.actualizado_por,updated_at=now() returning * into result;
  return to_jsonb(result);
end $function$;

notify pgrst,'reload schema';
commit;

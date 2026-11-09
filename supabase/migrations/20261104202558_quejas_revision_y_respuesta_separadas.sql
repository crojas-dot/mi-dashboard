-- Protocolo aditivo: el cliente anterior y No Procede conservan su contrato.
-- Solo las revisiones creadas aquí permiten aprobar sin publicar ni exigir oficio.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create schema qms_private;
revoke all on schema qms_private from public, anon;
grant usage on schema qms_private to authenticated;

create table public.queja_gc_revisiones (
  queja_id uuid not null references public.quejas(id) on delete restrict,
  source_revision bigint not null check (source_revision >= 0),
  decision text not null check (decision in ('approved','returned')),
  motivo text,
  propuesta text not null check (length(btrim(propuesta)) between 1 and 10000),
  propuesta_formato text not null check (propuesta_formato in ('plain','markdown')),
  investigation_run_id uuid references public.qms_stage_runs(id) on delete restrict,
  usuario_id uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  operation_txid bigint not null default txid_current(),
  primary key (queja_id, source_revision),
  check ((decision='approved' and motivo is null) or
    (decision='returned' and length(btrim(motivo)) between 1 and 10000))
);
create index queja_gc_revisiones_actor on public.queja_gc_revisiones(usuario_id);
create index queja_gc_revisiones_run on public.queja_gc_revisiones(investigation_run_id);

create table public.queja_response_drafts (
  queja_id uuid primary key references public.quejas(id) on delete restrict,
  version bigint not null check (version > 0),
  respuesta text not null default '' check (length(respuesta) <= 10000),
  numero_oficio text not null default '' check (length(numero_oficio) <= 120 and numero_oficio !~ '[[:cntrl:]]'),
  -- Un borrador no reserva evidencias. Un archivo eliminado se detecta al publicar.
  adjunto_id uuid,
  actualizado_por uuid not null references public.usuarios(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index queja_response_drafts_actor on public.queja_response_drafts(actualizado_por);

alter table public.queja_gc_revisiones enable row level security;
alter table public.queja_response_drafts enable row level security;
revoke all on public.queja_gc_revisiones, public.queja_response_drafts from public, anon, authenticated, service_role;
grant select on public.queja_gc_revisiones, public.queja_response_drafts to authenticated, service_role;
create policy gc_revisiones_staff_read on public.queja_gc_revisiones for select to authenticated using (
  (select public.app_es_admin()) or ((select public.app_es_staff()) and (select public.app_tiene_permiso('quejas', false)))
);
create policy response_drafts_staff_read on public.queja_response_drafts for select to authenticated using (
  (select public.app_es_admin()) or ((select public.app_es_staff()) and (select public.app_tiene_permiso('quejas', false)))
);

-- El helper se ejecuta únicamente desde las operaciones privadas autorizadas.
create function qms_private.quality_case(p_id uuid, p_expected bigint) returns public.quejas
language plpgsql security definer set search_path='' as $$
declare q public.quejas;
begin
  if auth.uid() is null or public.app_usuario_actual_id() is null or not (
    coalesce(public.app_es_admin(),false) or
    (coalesce(public.app_es_staff(),false) and coalesce(public.app_tiene_permiso('quejas',true),false))
  ) then raise exception 'No autorizado.' using errcode='42501'; end if;
  select * into q from public.quejas where id=p_id for update;
  if q.id is null then raise exception 'Queja no encontrada.' using errcode='P0002'; end if;
  if p_expected is null or q.revision is distinct from p_expected then
    raise exception 'Otra persona modificó el expediente. Conservá el borrador y actualizá la vista.' using errcode='40001';
  end if;
  return q;
end $$;

create function qms_private.quality_document(p_id uuid, p_file uuid) returns public.queja_adjuntos
language plpgsql security invoker set search_path='' as $$
declare d public.queja_adjuntos;
begin
  select * into d from public.queja_adjuntos where id=p_file for update;
  if d.id is null or d.queja_id is distinct from p_id or d.usuario_id is null
    or d.storage_path !~ '^[A-Za-z0-9_-]{10,200}$'
    or char_length(btrim(coalesce(d.nombre,''))) not between 1 and 255 or d.nombre ~ '[[:cntrl:]/\\]'
    or d.tamano is null or d.tamano not between 1 and 4194304
    or char_length(coalesce(d.tipo_mime,'')) not between 3 and 127
    or d.tipo_mime !~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*/[A-Za-z0-9][A-Za-z0-9.+_-]*$' then
    raise exception 'Seleccioná un oficio válido de este expediente.' using errcode='22023';
  end if;
  if exists(select 1 from public.queja_attachment_deletions where adjunto_id=p_file) then
    raise exception 'El archivo tiene una eliminación pendiente.' using errcode='55000';
  end if;
  return d;
end $$;

create function qms_private.review_resolution(p_id uuid,p_expected bigint,p_decision text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quejas; actor uuid; run uuid;
begin
  q:=qms_private.quality_case(p_id,p_expected);
  if q.estado<>'Pendiente de Revisión GC' or nullif(btrim(q.resolucion),'') is null then
    raise exception 'La propuesta no está pendiente de revisión.' using errcode='55000';
  end if;
  if p_decision is null or p_decision not in ('approved','returned') or
    (p_decision='returned' and (nullif(btrim(p_motivo),'') is null or length(p_motivo)>10000)) or
    (p_decision='approved' and p_motivo is not null) then
    raise exception 'Registrá un motivo válido de devolución.' using errcode='22023';
  end if;
  actor:=public.app_usuario_actual_id();
  select id into run from public.qms_stage_runs where case_id=p_id and stage_id='quejas.investigation' order by started_at desc,id desc limit 1;
  -- Snapshot histórico inmutable, tomado por DB; la propuesta actual sigue en quejas.resolucion.
  insert into public.queja_gc_revisiones(queja_id,source_revision,decision,motivo,propuesta,propuesta_formato,investigation_run_id,usuario_id)
    values(p_id,p_expected,p_decision,case when p_decision='returned' then btrim(p_motivo) end,q.resolucion,q.resolucion_formato,run,actor);
  perform public.qms_transition(p_id,p_expected,case when p_decision='approved' then 'resolved' else 'investigation' end);
  insert into public.quejas_actividad(queja_id,tipo,descripcion,usuario_id) values(p_id,'nota',
    case when p_decision='approved' then 'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.'
      else 'Devuelta a investigación. Motivo: '||btrim(p_motivo) end,actor);
  return (select to_jsonb(v) from public.qms_quejas v where v.id=p_id);
end $$;

create function qms_private.save_response_draft(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
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
      adjunto_id=excluded.adjunto_id,actualizado_por=excluded.actualizado_por,updated_at=now() returning * into result;
  return to_jsonb(result);
end $$;

create function qms_private.publish_response(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quejas; actor uuid; run uuid; result jsonb;
begin
  q:=qms_private.quality_case(p_id,p_expected);
  if q.estado<>'Resuelto' or exists(select 1 from public.queja_public_resolutions where queja_id=p_id) then
    raise exception 'La respuesta ya está publicada o la resolución no está aprobada.' using errcode='55000';
  end if;
  if nullif(btrim(p_response),'') is null or length(p_response)>10000 or
    nullif(btrim(p_office),'') is null or length(p_office)>120 or p_office ~ '[[:cntrl:]]' then
    raise exception 'Completá la respuesta, el número de oficio y el documento oficial.' using errcode='22023';
  end if;
  perform qms_private.quality_document(p_id,p_file);
  perform qms_private.save_response_draft(p_id,p_expected,p_version,p_response,p_office,p_file);
  actor:=public.app_usuario_actual_id();
  select id into run from public.qms_stage_runs where case_id=p_id and stage_id='quejas.investigation' order by started_at desc,id desc limit 1;
  -- INSERT exclusivamente: ni el RPC ni un reintento reemplazan una publicación.
  insert into public.queja_public_resolutions(queja_id,respuesta,adjunto_id,investigation_run_id,publicado_por,source_revision,publication_txid)
    values(p_id,btrim(p_response),p_file,run,actor,p_expected,txid_current());
  result:=public.qms_transition_complaint(p_id,p_expected,'finished',null,null,null,null,btrim(p_office));
  insert into public.quejas_actividad(queja_id,tipo,descripcion,usuario_id)
    values(p_id,'nota','Respuesta al cliente y oficio oficial publicados. Expediente finalizado.',actor);
  insert into public.logs(fecha,usuario_id,accion,modulo,detalle)
    values(now(),actor,'publicar','quejas','Respuesta y oficio publicados para '||q.folio);
  return result;
end $$;

-- Puentes invoker con el mismo JWT del usuario; el código privilegiado queda fuera de PostgREST.
create function public.qms_review_resolution(p_id uuid,p_expected bigint,p_decision text,p_motivo text default null)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.review_resolution(p_id,p_expected,p_decision,p_motivo)$$;
create function public.qms_save_response_draft(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.save_response_draft(p_id,p_expected,p_version,p_response,p_office,p_file)$$;
create function public.qms_publish_approved_response(p_id uuid,p_expected bigint,p_version bigint,p_response text,p_office text,p_file uuid)
returns jsonb language sql security invoker set search_path='' as $$select qms_private.publish_response(p_id,p_expected,p_version,p_response,p_office,p_file)$$;

revoke all on all functions in schema qms_private from public,anon,authenticated,service_role;
grant execute on function qms_private.review_resolution(uuid,bigint,text,text),
  qms_private.save_response_draft(uuid,bigint,bigint,text,text,uuid),
  qms_private.publish_response(uuid,bigint,bigint,text,text,uuid) to authenticated;
revoke all on function public.qms_review_resolution(uuid,bigint,text,text),
  public.qms_save_response_draft(uuid,bigint,bigint,text,text,uuid),
  public.qms_publish_approved_response(uuid,bigint,bigint,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.qms_review_resolution(uuid,bigint,text,text),
  public.qms_save_response_draft(uuid,bigint,bigint,text,text,uuid),
  public.qms_publish_approved_response(uuid,bigint,bigint,text,text,uuid) to authenticated;

create function public.qms_quality_review_metadata() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.estado='Pendiente de Revisión GC' and new.estado in ('En Investigación','Resuelto') and exists(
    select 1 from public.queja_gc_revisiones r where r.queja_id=old.id and r.source_revision=old.revision
      and r.operation_txid=txid_current() and r.decision=case when new.estado='Resuelto' then 'approved' else 'returned' end
  ) then
    if new.estado='Resuelto' then new.fecha_cierre:=old.fecha_cierre;
    else new.resolucion:=old.resolucion; new.resolucion_formato:=old.resolucion_formato; end if;
  end if;
  return new;
end $$;
revoke all on function public.qms_quality_review_metadata() from public,anon,authenticated,service_role;
create trigger b_qms_quality_review_metadata before update on public.quejas for each row execute function public.qms_quality_review_metadata();

create or replace function public.qms_require_published_resolution() returns trigger
language plpgsql security definer set search_path='' as $$
declare publication public.queja_public_resolutions; latest_run uuid; approved boolean;
begin
  if new.estado is not distinct from old.estado or new.estado not in ('No Procede','Resuelto','Finalizado') then return new; end if;
  select r.id into latest_run from public.qms_stage_runs r where r.case_id=new.id and r.stage_id='quejas.investigation' order by r.started_at desc,r.id desc limit 1;
  if old.estado='Pendiente de Revisión GC' and new.estado='Resuelto' and exists(
    select 1 from public.queja_gc_revisiones r where r.queja_id=new.id and r.source_revision=old.revision
      and r.operation_txid=txid_current() and r.decision='approved' and r.investigation_run_id is not distinct from latest_run
  ) then return new; end if;
  select * into publication from public.queja_public_resolutions where queja_id=new.id;
  select exists(select 1 from public.queja_gc_revisiones r where r.queja_id=new.id and r.decision='approved'
    and r.investigation_run_id is not distinct from latest_run) into approved;
  if publication.queja_id is null or (publication.investigation_run_id is distinct from latest_run and not(new.estado='Finalizado' and approved))
    or not exists(select 1 from public.queja_adjuntos d where d.id=publication.adjunto_id and d.queja_id=new.id
      and d.usuario_id is not null and d.storage_path ~ '^[A-Za-z0-9_-]{10,200}$' and d.tamano between 1 and 4194304
      and not exists(select 1 from public.queja_attachment_deletions x where x.adjunto_id=d.id)) then
    raise exception 'La comunicación final requiere respuesta y oficio publicados.' using errcode='55000';
  end if;
  if new.estado in ('No Procede','Resuelto') and (publication.publication_txid is distinct from txid_current()
      or publication.source_revision+1 is distinct from old.revision) then
    raise exception 'Publicá la respuesta y su oficio desde el flujo de resolución.' using errcode='55000';
  end if;
  return new;
end $$;

create or replace function public.qms_enqueue_complaint_mail() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text; recipient text;
begin
  if tg_op='INSERT' and new.estado='Recibido' then kind:='recibido';
  elsif tg_op='UPDATE' and new.estado is distinct from old.estado then
    if new.estado='No Procede' or (new.estado='Resuelto' and not exists(
      select 1 from public.queja_gc_revisiones r where r.queja_id=new.id and r.source_revision=old.revision
        and r.decision='approved' and r.operation_txid=txid_current()
    )) or (new.estado='Finalizado' and exists(select 1 from public.queja_public_resolutions p where p.queja_id=new.id and p.publication_txid=txid_current())) then kind:='final'; end if;
  end if;
  if kind is null then return new; end if;
  recipient:=lower(btrim(coalesce(new.email_cliente,'')));
  if length(recipient) not between 3 and 254 or recipient !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then return new; end if;
  -- El transporte vigente reconoce Resuelto/No Procede para el evento final.
  -- El expediente queda Finalizado; su correo conserva el contrato del emisor.
  insert into public.queja_mail_outbox(queja_id,tipo,destinatario,folio,estado,numero_oficio)
    values(new.id,kind,recipient,new.folio,case when new.estado='Finalizado' then 'Resuelto' else new.estado end,new.numero_oficio_resolucion)
    on conflict(queja_id,tipo) where tipo in ('recibido','investigacion','final') do nothing;
  return new;
end $$;

create function public.qms_protect_quality_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.queja_gc_revisiones where queja_id=old.queja_id and decision='approved') then
    raise exception 'La respuesta publicada y su oficio son de solo lectura.' using errcode='55000';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.qms_protect_quality_publication() from public,anon,authenticated,service_role;
create trigger qms_protect_quality_publication before update or delete on public.queja_public_resolutions
  for each row execute function public.qms_protect_quality_publication();

comment on table public.queja_gc_revisiones is 'Historial inmutable de decisiones GC. La propuesta actual se conserva en quejas.resolucion.';
comment on table public.queja_response_drafts is 'Borrador interno de comunicación. No se proyecta al seguimiento público ni genera correo.';
notify pgrst,'reload schema';
commit;

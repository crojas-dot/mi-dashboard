-- Relación persistente y verificable entre devoluciones GC y adjuntos de soporte.
create table if not exists public.queja_gc_revision_adjuntos (
  queja_id uuid not null,
  source_revision bigint not null,
  adjunto_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (queja_id, source_revision, adjunto_id),
  constraint queja_gc_revision_adjuntos_revision_fk foreign key (queja_id, source_revision)
    references public.queja_gc_revisiones(queja_id, source_revision) on delete cascade,
  constraint queja_gc_revision_adjuntos_archivo_fk foreign key (adjunto_id)
    references public.queja_adjuntos(id) on delete cascade,
  constraint queja_gc_revision_adjuntos_archivo_unico unique (adjunto_id)
);

alter table public.queja_gc_revision_adjuntos enable row level security;
revoke all on public.queja_gc_revision_adjuntos from public, anon, authenticated;
grant select on public.queja_gc_revision_adjuntos to authenticated, service_role;

drop policy if exists queja_gc_revision_adjuntos_consulta on public.queja_gc_revision_adjuntos;
create policy queja_gc_revision_adjuntos_consulta on public.queja_gc_revision_adjuntos
  for select to authenticated using (
    (select public.app_es_admin())
    or ((select public.app_es_staff()) and (select public.app_tiene_permiso('quejas', false)))
    or ((select public.app_es_colaborador()) and exists (
      select 1 from public.quejas q where q.id = queja_id
      and q.responsable_id = (select public.app_usuario_actual_id())
    ))
  );

-- La revisión aprobada sigue privada; solo las devoluciones propias son legibles.
drop policy if exists queja_gc_revisiones_responsable_devolucion on public.queja_gc_revisiones;
create policy queja_gc_revisiones_responsable_devolucion on public.queja_gc_revisiones
  for select to authenticated using (
    decision = 'returned' and (select public.app_es_colaborador()) and exists (
      select 1 from public.quejas q where q.id = queja_id
      and q.responsable_id = (select public.app_usuario_actual_id())
    )
  );

create or replace function qms_private.review_resolution_with_attachments(
  p_id uuid, p_expected bigint, p_motivo text, p_adjuntos uuid[]
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  actor uuid;
  expected_count integer;
  eligible_count integer;
  resultado jsonb;
begin
  perform qms_private.quality_case(p_id,p_expected);
  actor := public.app_usuario_actual_id();
  expected_count := coalesce(cardinality(p_adjuntos),0);
  if expected_count > 10 or array_position(p_adjuntos,null) is not null then
    raise exception 'Adjuntos de devolución inválidos.' using errcode = '22023';
  end if;
  select count(distinct a.id) into eligible_count
  from public.queja_adjuntos a
  where a.id = any(coalesce(p_adjuntos, '{}'::uuid[]))
    and a.queja_id = p_id and a.usuario_id = actor
    and a.storage_path ~ '^[A-Za-z0-9_-]{10,200}$';
  if eligible_count <> expected_count then
    raise exception 'Los soportes deben pertenecer a esta queja y a Gestión de Calidad.' using errcode = '22023';
  end if;
  if exists (select 1 from public.queja_gc_revision_adjuntos r where r.adjunto_id = any(coalesce(p_adjuntos,'{}'::uuid[]))) then
    raise exception 'Uno de los soportes ya pertenece a otra devolución.' using errcode = '23505';
  end if;
  resultado := qms_private.review_resolution(p_id,p_expected,'returned',p_motivo);
  insert into public.queja_gc_revision_adjuntos(queja_id,source_revision,adjunto_id)
    select p_id,p_expected,id from unnest(coalesce(p_adjuntos,'{}'::uuid[])) id;
  return resultado;
end;
$function$;

revoke all on function qms_private.review_resolution_with_attachments(uuid,bigint,text,uuid[]) from public,anon;
grant execute on function qms_private.review_resolution_with_attachments(uuid,bigint,text,uuid[]) to authenticated, service_role;

create or replace function public.qms_review_resolution_with_attachments(
  p_id uuid, p_expected bigint, p_motivo text, p_adjuntos uuid[] default '{}'::uuid[]
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select qms_private.review_resolution_with_attachments(p_id,p_expected,p_motivo,p_adjuntos);
$function$;

revoke all on function public.qms_review_resolution_with_attachments(uuid,bigint,text,uuid[]) from public,anon;
grant execute on function public.qms_review_resolution_with_attachments(uuid,bigint,text,uuid[]) to authenticated, service_role;

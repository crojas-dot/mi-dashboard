-- Guardar no cambia el estado, la propuesta enviada ni el calendario del expediente.
create table public.queja_resolution_drafts (
  queja_id uuid primary key references public.quejas(id) on delete cascade,
  version bigint not null check (version > 0),
  source_revision bigint not null check (source_revision >= 0),
  contenido text not null check (length(contenido) <= 10000),
  formato text not null check (formato in ('plain', 'markdown')),
  actualizado_por uuid not null references public.usuarios(id),
  updated_at timestamptz not null default now()
);
create index queja_resolution_drafts_autor_idx on public.queja_resolution_drafts(actualizado_por);
alter table public.queja_resolution_drafts enable row level security;
revoke all on public.queja_resolution_drafts from public, anon, authenticated, service_role;
grant select on public.queja_resolution_drafts to authenticated, service_role;

create policy resolution_drafts_authorized_read on public.queja_resolution_drafts
  for select to authenticated using (
    (select auth.uid()) is not null and exists (
      select 1 from public.quejas q where q.id = queja_id and q.estado = 'En Investigación' and (
        coalesce((select public.app_es_admin()), false)
        or (coalesce((select public.app_es_staff()), false)
          and coalesce((select public.app_tiene_permiso('quejas', true)), false))
        or (coalesce((select public.app_es_colaborador()), false)
          and coalesce((select public.app_tiene_permiso('mis_quejas', true)), false)
          and q.responsable_id = (select public.app_usuario_actual_id()))
      )
    )
  );

create function qms_private.save_resolution_draft(
  p_id uuid, p_expected bigint, p_version bigint, p_content text, p_format text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.quejas;
  d public.queja_resolution_drafts;
  result public.queja_resolution_drafts;
begin
  if auth.uid() is null or public.app_usuario_actual_id() is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  -- Mismo orden de locks que el workflow: expediente y después borrador.
  select * into q from public.quejas where id = p_id for update;
  if not (
    coalesce(public.app_es_admin(), false)
    or (coalesce(public.app_es_staff(), false) and coalesce(public.app_tiene_permiso('quejas', true), false))
    or (coalesce(public.app_es_colaborador(), false)
      and coalesce(public.app_tiene_permiso('mis_quejas', true), false)
      and coalesce(q.responsable_id = public.app_usuario_actual_id(), false))
  ) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if q.id is null then raise exception 'Queja no encontrada.' using errcode = 'P0002'; end if;
  if p_expected is null or q.revision is distinct from p_expected then
    raise exception 'El expediente cambió. Tu borrador se conserva; revisá los cambios antes de guardar.' using errcode = '40001';
  end if;
  if q.estado is distinct from 'En Investigación' then
    raise exception 'Esta queja ya no está en investigación.' using errcode = '55000';
  end if;
  if p_version is null or p_version < 0 or p_content is null or length(p_content) > 10000
    or p_format is null or p_format not in ('plain', 'markdown') then
    raise exception 'Revisá el contenido y formato de la resolución.' using errcode = '22023';
  end if;
  select * into d from public.queja_resolution_drafts where queja_id = p_id for update;
  if coalesce(d.version, 0) <> p_version then
    raise exception 'Otra persona guardó el borrador. Tu texto se conserva; compará los cambios antes de reintentar.' using errcode = '40001';
  end if;
  insert into public.queja_resolution_drafts(queja_id, version, source_revision, contenido, formato, actualizado_por)
    values(p_id, p_version + 1, q.revision, p_content, p_format, public.app_usuario_actual_id())
    on conflict(queja_id) do update set version = excluded.version, source_revision = excluded.source_revision,
      contenido = excluded.contenido, formato = excluded.formato, actualizado_por = excluded.actualizado_por,
      updated_at = now() returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function qms_private.save_resolution_draft(uuid,bigint,bigint,text,text) from public, anon, authenticated, service_role;
grant execute on function qms_private.save_resolution_draft(uuid,bigint,bigint,text,text) to authenticated;

create function public.qms_save_resolution_draft(
  p_id uuid, p_expected bigint, p_version bigint, p_content text, p_format text
) returns jsonb language sql security invoker set search_path = '' as $$
  select qms_private.save_resolution_draft(p_id,p_expected,p_version,p_content,p_format);
$$;
revoke all on function public.qms_save_resolution_draft(uuid,bigint,bigint,text,text) from public, anon, authenticated, service_role;
grant execute on function public.qms_save_resolution_draft(uuid,bigint,bigint,text,text) to authenticated;

-- El envío también compara la versión del borrador, bajo el mismo lock. Una
-- segunda computadora no puede enviar por encima de cambios guardados más nuevos.
create function public.qms_submit_resolution_draft(
  p_id uuid, p_expected bigint, p_version bigint, p_content text, p_format text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(btrim(p_content), '') is null then
    raise exception 'Escribí la resolución antes de enviarla.' using errcode = '22023';
  end if;
  perform qms_private.save_resolution_draft(p_id,p_expected,p_version,p_content,p_format);
  return public.qms_transition_complaint(p_id,p_expected,'gc_review',
    p_resolution => p_content, p_resolution_format => p_format);
end $$;
revoke all on function public.qms_submit_resolution_draft(uuid,bigint,bigint,text,text) from public, anon, authenticated, service_role;
grant execute on function public.qms_submit_resolution_draft(uuid,bigint,bigint,text,text) to authenticated;

-- Una propuesta enviada se conserva en quejas.resolucion. Su borrador no debe
-- reaparecer como trabajo nuevo después de una devolución o una reasignación.
create function qms_private.clear_resolution_draft() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  delete from public.queja_resolution_drafts where queja_id = new.id;
  return new;
end $$;
revoke all on function qms_private.clear_resolution_draft() from public, anon, authenticated, service_role;
create trigger qms_clear_resolution_draft after update of estado, responsable_id on public.quejas
  for each row when (old.estado is distinct from new.estado or old.responsable_id is distinct from new.responsable_id)
  execute function qms_private.clear_resolution_draft();

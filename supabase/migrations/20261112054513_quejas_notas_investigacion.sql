-- Las notas de investigación son historial operativo: solo su autor corrige o
-- elimina una nota mientras el expediente siga en investigación. RLS solo expone
-- SELECT/INSERT sobre quejas_actividad, así que la escritura pasa por estas
-- funciones con guard explícito y search_path vacío.
create function qms_private.update_investigation_note(
  p_id uuid, p_note uuid, p_expected text, p_content text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.quejas;
  n public.quejas_actividad;
  result public.quejas_actividad;
  text_content text := btrim(p_content);
begin
  if auth.uid() is null or public.app_usuario_actual_id() is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  select * into q from public.quejas where id = p_id for update;
  if q.id is null then raise exception 'Queja no encontrada.' using errcode = 'P0002'; end if;
  if not (
    coalesce(public.app_es_admin(), false)
    or (coalesce(public.app_es_staff(), false) and coalesce(public.app_tiene_permiso('quejas', true), false))
    or (coalesce(public.app_es_colaborador(), false)
      and coalesce(public.app_tiene_permiso('mis_quejas', true), false)
      and coalesce(q.responsable_id = public.app_usuario_actual_id(), false))
  ) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if q.estado is distinct from 'En Investigación' then
    raise exception 'Esta queja ya no está en investigación.' using errcode = '55000';
  end if;
  select * into n from public.quejas_actividad
    where id = p_note and queja_id = p_id for update;
  if n.id is null then raise exception 'Nota no encontrada.' using errcode = 'P0002'; end if;
  -- El historial del trámite no se reescribe aunque el rol sea admin.
  if n.tipo is distinct from 'nota'
    or n.usuario_id is distinct from public.app_usuario_actual_id()
    or n.descripcion like 'Devuelta a investigación. Motivo: %'
    or n.descripcion in (
      'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.',
      'Respuesta al cliente y oficio oficial publicados. Expediente finalizado.')
  then raise exception 'Esta entrada pertenece al historial del trámite.' using errcode = '42501';
  end if;
  if p_expected is null or n.descripcion is distinct from p_expected then
    raise exception 'La nota cambió. Tu texto se conserva; revisá los cambios antes de guardar.' using errcode = '40001';
  end if;
  if text_content is null or text_content = '' or length(text_content) > 10000
    or text_content like 'Devuelta a investigación. Motivo: %'
    or text_content in (
      'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.',
      'Respuesta al cliente y oficio oficial publicados. Expediente finalizado.')
  then
    raise exception 'Revisá la nota. Admite hasta 10.000 caracteres.' using errcode = '22023';
  end if;
  update public.quejas_actividad set descripcion = text_content
    where id = p_note returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function qms_private.update_investigation_note(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function qms_private.update_investigation_note(uuid,uuid,text,text) to authenticated;

create function qms_private.delete_investigation_note(
  p_id uuid, p_note uuid, p_expected text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.quejas;
  n public.quejas_actividad;
  result public.quejas_actividad;
begin
  if auth.uid() is null or public.app_usuario_actual_id() is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  select * into q from public.quejas where id = p_id for update;
  if q.id is null then raise exception 'Queja no encontrada.' using errcode = 'P0002'; end if;
  if not (
    coalesce(public.app_es_admin(), false)
    or (coalesce(public.app_es_staff(), false) and coalesce(public.app_tiene_permiso('quejas', true), false))
    or (coalesce(public.app_es_colaborador(), false)
      and coalesce(public.app_tiene_permiso('mis_quejas', true), false)
      and coalesce(q.responsable_id = public.app_usuario_actual_id(), false))
  ) then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if q.estado is distinct from 'En Investigación' then
    raise exception 'Esta queja ya no está en investigación.' using errcode = '55000';
  end if;
  select * into n from public.quejas_actividad
    where id = p_note and queja_id = p_id for update;
  if n.id is null then raise exception 'Nota no encontrada.' using errcode = 'P0002'; end if;
  if n.tipo is distinct from 'nota'
    or n.usuario_id is distinct from public.app_usuario_actual_id()
    or n.descripcion like 'Devuelta a investigación. Motivo: %'
    or n.descripcion in (
      'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.',
      'Respuesta al cliente y oficio oficial publicados. Expediente finalizado.')
  then raise exception 'Esta entrada pertenece al historial del trámite.' using errcode = '42501';
  end if;
  if p_expected is null or n.descripcion is distinct from p_expected then
    raise exception 'La nota cambió. Revisá el historial antes de eliminarla.' using errcode = '40001';
  end if;
  delete from public.quejas_actividad where id = p_note returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function qms_private.delete_investigation_note(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function qms_private.delete_investigation_note(uuid,uuid,text) to authenticated;

-- RPC públicos invoker: delegan el guard y no amplían accesos de RLS.
create function public.qms_update_investigation_note(
  p_id uuid, p_note uuid, p_expected text, p_content text
) returns jsonb language sql security invoker set search_path = '' as $$
  select qms_private.update_investigation_note(p_id, p_note, p_expected, p_content);
$$;
revoke all on function public.qms_update_investigation_note(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.qms_update_investigation_note(uuid,uuid,text,text) to authenticated;

create function public.qms_delete_investigation_note(
  p_id uuid, p_note uuid, p_expected text
) returns jsonb language sql security invoker set search_path = '' as $$
  select qms_private.delete_investigation_note(p_id, p_note, p_expected);
$$;
revoke all on function public.qms_delete_investigation_note(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.qms_delete_investigation_note(uuid,uuid,text) to authenticated;

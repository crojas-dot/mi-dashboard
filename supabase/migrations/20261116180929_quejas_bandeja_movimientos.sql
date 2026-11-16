-- Resumen operativo independiente de la revisión optimista del expediente.
-- Agregar una evidencia/nota no debe invalidar un borrador ni recalcular su SLA.
create table public.queja_bandeja_actividad (
  queja_id uuid primary key references public.quejas(id) on delete cascade,
  ultima_actividad_relevante_at timestamptz not null,
  gestionada boolean not null default false
);
alter table public.queja_bandeja_actividad enable row level security;
revoke all on public.queja_bandeja_actividad from public, anon, authenticated, service_role;
grant select on public.queja_bandeja_actividad to authenticated, service_role;
create policy bandeja_case_read on public.queja_bandeja_actividad for select to authenticated
using ((select auth.uid()) is not null and exists (
  select 1 from public.quejas q where q.id = queja_id
));
create index queja_bandeja_actividad_orden on public.queja_bandeja_actividad
  (ultima_actividad_relevante_at desc, queja_id desc);

-- Solo fechas históricas registradas: nunca usar la hora de esta migración.
with movimientos as (
  select queja_id, created_at as fecha from public.quejas_actividad where tipo = 'nota'
  union all select queja_id, fecha from public.quejas_comentarios
  union all select queja_id, coalesce(created_at, fecha_subida) from public.queja_adjuntos
  union all select queja_id, created_at from public.queja_gc_revisiones
  union all select queja_id, created_at from public.queja_informes
  union all select queja_id, updated_at from public.queja_resolution_drafts where btrim(contenido) <> ''
  union all select queja_id, updated_at from public.queja_response_drafts
  union all select queja_id, publicado_at from public.queja_public_resolutions
  union all select queja_id, updated_at from public.queja_investigation_assignments
  union all select case_id, started_at from public.qms_stage_runs where stage_id <> 'quejas.evaluation'
  union all select case_id, ended_at from public.qms_stage_runs where ended_at is not null
  union all select e.case_id, e.occurred_at from public.qms_case_events e join public.quejas q on q.id=e.case_id
    where e.module='quejas' and (e.kind in ('closed','resolved') or e.kind='opened' and e.occurred_at > q.fecha)
), ultimas as (select queja_id, max(fecha) as fecha from movimientos group by queja_id)
insert into public.queja_bandeja_actividad
select q.id, greatest(coalesce(q.fecha, '-infinity'::timestamptz), coalesce(m.fecha, q.fecha, '-infinity'::timestamptz)),
  m.fecha is not null or q.estado is distinct from 'Recibido' or q.responsable_id is not null
from public.quejas q left join ultimas m on m.queja_id=q.id;

create function qms_private.track_complaint_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  anterior jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  siguiente jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  campos text[] := string_to_array(tg_argv[0], ',');
  case_id uuid; marca timestamptz; gestion boolean := true;
begin
  -- Función de trigger sin EXECUTE cliente: la autorización pertenece a la
  -- escritura original (RLS/RPC/API). También atiende el alta pública autorizada.
  if tg_op='UPDATE' and not exists (
    select 1 from unnest(campos) k where anterior->k is distinct from siguiente->k
  ) then return new; end if;
  case_id := coalesce(siguiente->>tg_argv[1], anterior->>tg_argv[1])::uuid;
  if not exists(select 1 from public.quejas q where q.id=case_id) then
    return coalesce(new,old); -- cascade de un expediente eliminado
  end if;
  if tg_table_name='quejas_actividad' and coalesce(siguiente->>'tipo',anterior->>'tipo') <> 'nota' then
    return coalesce(new,old);
  end if;
  if tg_table_name='queja_informes' and tg_op='INSERT' and siguiente->>'contenido' is not distinct from (
    select i.contenido from public.queja_informes i where i.queja_id=case_id and i.version < (siguiente->>'version')::integer order by i.version desc limit 1
  ) then return new; end if;
  if tg_table_name='queja_resolution_drafts' and tg_op='INSERT' and btrim(siguiente->>'contenido')='' then return new; end if;
  marca := clock_timestamp();
  if tg_table_name='quejas' and tg_op='INSERT' then
    marca := coalesce((siguiente->>'fecha')::timestamptz, marca);
    gestion := siguiente->>'estado' is distinct from 'Recibido' or siguiente->>'responsable_id' is not null;
  end if;
  insert into public.queja_bandeja_actividad values(case_id, marca, gestion)
  on conflict(queja_id) do update set
    ultima_actividad_relevante_at=greatest(queja_bandeja_actividad.ultima_actividad_relevante_at,excluded.ultima_actividad_relevante_at),
    gestionada=queja_bandeja_actividad.gestionada or excluded.gestionada;
  return coalesce(new,old);
end $$;
revoke all on function qms_private.track_complaint_activity() from public, anon, authenticated, service_role;

create trigger bandeja_complaint_activity after insert or update on public.quejas for each row
execute function qms_private.track_complaint_activity('estado,responsable_id,cliente_nombre,email_cliente,telefono,categoria,tipo,descripcion,prioridad,notas,notas_formato,resolucion,resolucion_formato,derivado_sacp_id,reabierta,motivo_reapertura,area_afectada,numero_oficio_resolucion,observaciones,justificacion_procede,justificacion_procede_formato,fecha_sla,fecha_limite_investigacion','id');
create trigger bandeja_note_activity after insert or update or delete on public.quejas_actividad for each row
execute function qms_private.track_complaint_activity('descripcion,tipo','queja_id');
create trigger bandeja_comment_activity after insert or update or delete on public.quejas_comentarios for each row
execute function qms_private.track_complaint_activity('comentario,tipo,visible_cliente','queja_id');
create trigger bandeja_attachment_activity after insert or update or delete on public.queja_adjuntos for each row
execute function qms_private.track_complaint_activity('nombre,storage_path,tamano,tipo_mime,nombre_archivo,url_archivo,tipo_archivo','queja_id');
create trigger bandeja_report_activity after insert or update or delete on public.queja_informes for each row
execute function qms_private.track_complaint_activity('contenido','queja_id');
create trigger bandeja_draft_activity after insert or update or delete on public.queja_resolution_drafts for each row
execute function qms_private.track_complaint_activity('contenido,formato','queja_id');
create trigger bandeja_response_activity after insert or update or delete on public.queja_response_drafts for each row
execute function qms_private.track_complaint_activity('respuesta,numero_oficio,adjunto_id,correo_asunto,correo_cuerpo,motivo_no_procede,motivo_no_procede_formato','queja_id');
create trigger bandeja_publication_activity after insert or update or delete on public.queja_public_resolutions for each row
execute function qms_private.track_complaint_activity('respuesta,adjunto_id','queja_id');
create trigger bandeja_assignment_activity after insert or update or delete on public.queja_investigation_assignments for each row
execute function qms_private.track_complaint_activity('responsable_id,instrucciones,oficio_adjunto_id','queja_id');

-- Vista exclusiva de listados: no altera el contrato usado por workflow/Agenda.
create view public.qms_quejas_bandeja with (security_invoker=true) as
select q.*, coalesce(a.ultima_actividad_relevante_at,q.fecha) as ultima_actividad_relevante_at,
  ctx.etiqueta as actividad_contexto, coalesce(ctx.etiqueta in ('Nuevo','Actualización: hoy'),false) as actividad_reciente,
  case when q.estado in ('Resuelto','Finalizado','No Procede','Cerrado','Cerrada') then 'completados'
    when limite.vence is null then 'sin_plazo'
    when (limite.vence at time zone 'America/Costa_Rica')::date < (now() at time zone 'America/Costa_Rica')::date then 'vencidos'
    else 'por_vencer' end as plazo_filtro,
  limite.vence as bandeja_plazo_vence
from public.qms_quejas q
left join public.queja_bandeja_actividad a on a.queja_id=q.id
left join lateral (
  select sr.calendar_id from public.qms_stage_runs sr where sr.case_id=q.id and sr.stage_id='quejas.evaluation'
  order by sr.started_at,sr.id limit 1
) calendario on true
left join lateral (
  -- Sin plazo significa que nunca existió. Un run cerrado no borra su fecha.
  select coalesce(q.plazo_vence,
    (select sr.expires_at from public.qms_stage_runs sr where sr.case_id=q.id order by sr.started_at desc,sr.id desc limit 1),
    case when q.estado='Recibido' then q.fecha_sla else q.fecha_limite_investigacion end) as vence
) limite on true
cross join lateral (
  select qms_private.complaint_activity_context(q.fecha,a.ultima_actividad_relevante_at,a.gestionada,q.estado,calendario.calendar_id) as etiqueta
) ctx;
revoke all on public.qms_quejas_bandeja from public,anon,authenticated,service_role;
grant select on public.qms_quejas_bandeja to authenticated,service_role;

-- Un canal de la bandeja reemplaza el canal de quejas; no uno por tipo de movimiento.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='queja_bandeja_actividad'
  ) then alter publication supabase_realtime add table public.queja_bandeja_actividad; end if;
end $$;

-- Sólo los expedientes reabiertos usan el conteo hábil de su calendario capturado.
-- Se añade una columna al final sin cambiar las columnas/orden vigentes ni la paginación.
create or replace view public.qms_quejas_bandeja with (security_invoker=true) as
select q.*, coalesce(a.ultima_actividad_relevante_at,q.fecha) as ultima_actividad_relevante_at,
  ctx.etiqueta as actividad_contexto, coalesce(ctx.etiqueta in ('Nuevo','Actualización: hoy'),false) as actividad_reciente,
  case when q.estado in ('Resuelto','Finalizado','No Procede','Cerrado','Cerrada') then 'completados'
    when limite.vence is null then 'sin_plazo'
    when (limite.vence at time zone 'America/Costa_Rica')::date < (now() at time zone 'America/Costa_Rica')::date then 'vencidos'
    else 'por_vencer' end as plazo_filtro,
  limite.vence as bandeja_plazo_vence,
  case when q.reabierta is true and q.estado in ('En Investigación', 'Pendiente de Revisión GC')
            and reapertura_run.id is not null then
    (select count(*)::integer from generate_series(
      (now() at time zone 'America/Costa_Rica')::date + 1,
      (reapertura_run.expires_at at time zone 'America/Costa_Rica')::date,
      interval '1 day'
    ) dia where public.qms_business_day(dia::date,reapertura_run.calendar_id))
  else null end as reapertura_dias_habiles_restantes
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
left join lateral (
  select sr.id, sr.calendar_id, sr.expires_at
  from public.qms_stage_runs sr
  where sr.case_id = q.id and sr.stage_id = 'quejas.investigation'
    and sr.ended_at is null
  order by sr.started_at desc, sr.id desc limit 1
) reapertura_run on q.reabierta is true
cross join lateral (
  select qms_private.complaint_activity_context(q.fecha,a.ultima_actividad_relevante_at,a.gestionada,q.estado,calendario.calendar_id) as etiqueta
) ctx;
revoke all on public.qms_quejas_bandeja from public,anon,authenticated,service_role;
grant select on public.qms_quejas_bandeja to authenticated,service_role;
notify pgrst, 'reload schema';

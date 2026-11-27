-- Conserva el horizonte de 370 días de la bandeja. La búsqueda se detiene al
-- encontrar el tercer día hábil y omite el calendario si la etiqueta ya venció.
create or replace function qms_private.complaint_activity_context(
  ingreso timestamptz, ultima timestamptz, gestionada boolean, estado text,
  calendario bigint, hoy date default (now() at time zone 'America/Costa_Rica')::date
) returns text language plpgsql stable security invoker set search_path='' as $$
declare inicio date := (ingreso at time zone 'America/Costa_Rica')::date;
  dia date := (coalesce(ultima,ingreso) at time zone 'America/Costa_Rica')::date;
  habiles integer := 0; dias integer;
begin
  if estado in ('Resuelto','Finalizado','No Procede','Cerrado','Cerrada') or ingreso is null then return null; end if;
  if not coalesce(gestionada,false) then
    if estado <> 'Recibido' or calendario is null or inicio > hoy then return null; end if;
    if hoy >= inicio + 370 then return null; end if;
    for avance in 0..370 loop
      if public.qms_business_day(inicio + avance, calendario) then
        habiles := habiles + 1;
        if habiles = 3 then
          return case when hoy < inicio + avance then 'Nuevo' end;
        end if;
      end if;
    end loop;
    return null;
  end if;
  dias := hoy-dia;
  return case when dias=0 then 'Actualización: hoy'
    when dias=1 then 'Actualización: ayer'
    when dias between 2 and 30 then 'Actualización: hace '||dias||' días'
    else 'Actualización: '||to_char(dia,'DD/MM/YYYY') end;
end $$;

-- Los predicados de identidad son constantes durante la consulta.
ALTER POLICY quejas_colaborador_propias ON public.quejas
  USING ((SELECT public.app_es_colaborador())
    AND (SELECT public.app_tiene_permiso('mis_quejas', false))
    AND responsable_id = (SELECT public.app_usuario_actual_id()));

-- Los datos de presentación pueden calcularse al proyectar las filas de la página.
CREATE OR REPLACE VIEW public.qms_quejas_bandeja WITH (security_invoker=true) AS
SELECT q.*, coalesce(a.ultima_actividad_relevante_at,q.fecha) AS ultima_actividad_relevante_at,
  ctx.etiqueta AS actividad_contexto, coalesce(ctx.etiqueta IN ('Nuevo','Actualización: hoy'),false) AS actividad_reciente,
  CASE WHEN q.estado IN ('Resuelto','Finalizado','No Procede','Cerrado','Cerrada') THEN 'completados'
    WHEN limite.vence IS NULL THEN 'sin_plazo'
    WHEN (limite.vence AT TIME ZONE 'America/Costa_Rica')::date < (now() AT TIME ZONE 'America/Costa_Rica')::date THEN 'vencidos'
    ELSE 'por_vencer' END AS plazo_filtro,
  limite.vence AS bandeja_plazo_vence,
  CASE WHEN q.reabierta IS TRUE AND q.estado IN ('En Investigación', 'Pendiente de Revisión GC') THEN (
    SELECT (SELECT count(*)::integer FROM generate_series(
      (now() AT TIME ZONE 'America/Costa_Rica')::date + 1,
      (sr.expires_at AT TIME ZONE 'America/Costa_Rica')::date,
      interval '1 day'
    ) dia WHERE public.qms_business_day(dia::date,sr.calendar_id))
    FROM public.qms_stage_runs sr
    WHERE sr.case_id = q.id AND sr.stage_id = 'quejas.investigation' AND sr.ended_at IS NULL
    ORDER BY sr.started_at DESC,sr.id DESC LIMIT 1
  ) END AS reapertura_dias_habiles_restantes
FROM public.qms_quejas q
LEFT JOIN public.queja_bandeja_actividad a ON a.queja_id=q.id
LEFT JOIN LATERAL (
  -- Sin plazo significa que nunca existió. Un run cerrado no borra su fecha.
  SELECT coalesce(q.plazo_vence,
    (SELECT sr.expires_at FROM public.qms_stage_runs sr WHERE sr.case_id=q.id ORDER BY sr.started_at DESC,sr.id DESC LIMIT 1),
    CASE WHEN q.estado='Recibido' THEN q.fecha_sla ELSE q.fecha_limite_investigacion END) AS vence
) limite ON true
CROSS JOIN LATERAL (
  SELECT qms_private.complaint_activity_context(q.fecha,a.ultima_actividad_relevante_at,a.gestionada,q.estado,
    CASE WHEN NOT coalesce(a.gestionada,false) AND (q.estado IS NULL OR q.estado='Recibido') THEN (
      SELECT sr.calendar_id FROM public.qms_stage_runs sr
      WHERE sr.case_id=q.id AND sr.stage_id='quejas.evaluation'
      ORDER BY sr.started_at,sr.id LIMIT 1
    ) END) AS etiqueta
) ctx;

-- La tabla de envíos y las revisiones GC son privadas. Este puente devuelve
-- únicamente fechas de eventos del expediente visible, nunca mensajes/motivos.
CREATE OR REPLACE FUNCTION qms_private.agenda_eventos_hoy()
RETURNS TABLE(queja_id uuid, asignada_hoy boolean, devuelta_hoy boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH actor AS MATERIALIZED (
    SELECT public.app_usuario_actual_id() AS id,
      public.app_es_admin() OR (public.app_es_staff() AND public.app_tiene_permiso('quejas',false)) AS staff,
      public.app_es_colaborador() AND public.app_tiene_permiso('mis_quejas',false) AS own,
      (transaction_timestamp() AT TIME ZONE 'America/Costa_Rica')::date AS hoy
    WHERE auth.uid() IS NOT NULL
  )
  SELECT q.id,
    EXISTS(SELECT 1 FROM public.queja_mail_outbox o
      WHERE o.queja_id=q.id AND o.tipo='interno_asignacion' AND o.usuario_id=q.responsable_id
        AND o.created_at >= (a.hoy::timestamp AT TIME ZONE 'America/Costa_Rica')
        AND o.created_at < ((a.hoy+1)::timestamp AT TIME ZONE 'America/Costa_Rica')),
    q.estado='En Investigación' AND EXISTS(SELECT 1 FROM public.queja_gc_revisiones r
      WHERE r.queja_id=q.id AND r.decision='returned'
        AND r.created_at >= (a.hoy::timestamp AT TIME ZONE 'America/Costa_Rica')
        AND r.created_at < ((a.hoy+1)::timestamp AT TIME ZONE 'America/Costa_Rica'))
  FROM public.quejas q CROSS JOIN actor a
  WHERE a.id IS NOT NULL AND (a.staff OR (a.own AND q.responsable_id=a.id))
    AND q.estado NOT IN ('No Procede','Finalizado','Cerrada');
$$;

NOTIFY pgrst, 'reload schema';

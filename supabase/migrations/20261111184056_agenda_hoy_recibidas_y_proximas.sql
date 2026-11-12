-- Novedades accionables del día y ventana de uno/dos días hábiles, nunca vencidos.
-- Se mantienen RLS, el puente privado y el documento JSON; no se escriben casos.
CREATE OR REPLACE FUNCTION public.qms_get_agenda_hoy()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH contexto AS (
    SELECT (transaction_timestamp() AT TIME ZONE 'America/Costa_Rica')::date AS hoy,
      public.app_es_admin() OR (public.app_es_staff() AND public.app_tiene_permiso('quejas',false)) AS gestion
    WHERE auth.uid() IS NOT NULL AND public.app_usuario_actual_id() IS NOT NULL
  ), proximos AS MATERIALIZED (
    -- El calendario del plazo es inmutable; no sustituirlo por el calendario actual.
    SELECT cal.id, array_agg(d.dia ORDER BY d.dia) AS dias
    FROM public.qms_calendars cal CROSS JOIN contexto c CROSS JOIN LATERAL (
      SELECT c.hoy+n AS dia FROM generate_series(1,370) n
      WHERE public.qms_business_day(c.hoy+n,cal.id) ORDER BY n LIMIT 2
    ) d GROUP BY cal.id
  ), eventos AS MATERIALIZED (
    SELECT * FROM qms_private.agenda_eventos_hoy()
  ), candidatos AS (
    SELECT q.id, q.folio AS codigo, q.descripcion,
      CASE WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 1
        WHEN e.devuelta_hoy THEN 3 WHEN e.asignada_hoy THEN 4
        WHEN c.gestion AND q.estado='Pendiente de Revisión GC' AND EXISTS (
          SELECT 1 FROM public.qms_stage_runs sr WHERE sr.case_id=q.id
            AND sr.stage_id='quejas.investigation' AND sr.end_event='Pendiente de Revisión GC'
            AND sr.ended_at >= (c.hoy::timestamp AT TIME ZONE 'America/Costa_Rica')
            AND sr.ended_at < ((c.hoy+1)::timestamp AT TIME ZONE 'America/Costa_Rica')
        ) THEN 5
        WHEN c.gestion AND q.estado='Resuelto' AND EXISTS (
          SELECT 1 FROM public.queja_gc_revisiones gr WHERE gr.queja_id=q.id AND gr.decision='approved'
            AND gr.created_at >= (c.hoy::timestamp AT TIME ZONE 'America/Costa_Rica')
            AND gr.created_at < ((c.hoy+1)::timestamp AT TIME ZONE 'America/Costa_Rica')
        ) THEN 6
        WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date=p.dias[1] THEN 7
        WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date=p.dias[2] THEN 8
        WHEN c.gestion AND q.estado='Recibido'
          AND q.fecha >= (c.hoy::timestamp AT TIME ZONE 'America/Costa_Rica')
          AND q.fecha < ((c.hoy+1)::timestamp AT TIME ZONE 'America/Costa_Rica') THEN 9 END AS prioridad,
      CASE WHEN c.gestion THEN '/quejas' ELSE '/mis-quejas' END AS ruta,
      q.plazo_vence AS fecha, 'quejas' AS modulo
    FROM public.qms_quejas q CROSS JOIN contexto c LEFT JOIN eventos e ON e.queja_id=q.id
    LEFT JOIN LATERAL (
      SELECT sr.calendar_id FROM public.qms_stage_runs sr WHERE sr.case_id=q.id
        AND sr.expires_at=q.plazo_vence
        AND (sr.ended_at IS NULL OR (q.estado='Pendiente de Revisión GC'
          AND sr.stage_id='quejas.investigation' AND sr.end_event='Pendiente de Revisión GC'))
      ORDER BY (sr.ended_at IS NULL) DESC,sr.started_at DESC,sr.id LIMIT 1
    ) run ON true LEFT JOIN proximos p ON p.id=run.calendar_id
    WHERE q.estado NOT IN ('No Procede','Finalizado','Cerrada')
      AND (c.gestion OR q.estado='En Investigación')
      AND (q.plazo_vence IS NULL OR q.plazo_vence>=transaction_timestamp())
    UNION ALL
    SELECT a.id, coalesce(a.folio,'Auditoría'), coalesce(a.objetivo,'Auditoría programada'),
      CASE WHEN (a.fecha_fin AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 1
        WHEN (a.fecha_inicio AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 2
        WHEN (a.fecha_fin AT TIME ZONE 'America/Costa_Rica')::date=p.dias[1] THEN 7
        WHEN (a.fecha_fin AT TIME ZONE 'America/Costa_Rica')::date=p.dias[2] THEN 8 END,
      '/auditorias', coalesce(a.fecha_fin,a.fecha_inicio), 'auditorias'
    FROM public.auditorias a CROSS JOIN contexto c
    -- Auditorías no conserva un run QMS: usa el calendario laboral vigente.
    LEFT JOIN proximos p ON p.id=(SELECT max(cal.id) FROM public.qms_calendars cal)
    WHERE coalesce(a.estado,'') NOT IN ('No Procede','Finalizado','Finalizada','Completada','Cerrada','Cancelada')
      AND (a.fecha_fin IS NULL OR a.fecha_fin>=transaction_timestamp())
  ), unicos AS (
    SELECT DISTINCT ON(modulo,id) * FROM candidatos WHERE prioridad IS NOT NULL
    ORDER BY modulo,id,prioridad,fecha NULLS LAST
  ), seleccion AS (
    SELECT * FROM unicos ORDER BY prioridad,fecha NULLS LAST,modulo,id LIMIT 20
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'codigo',codigo,'descripcion',left(regexp_replace(coalesce(descripcion,''),'[[:space:]]+',' ','g'),320),
    'motivo',CASE prioridad WHEN 1 THEN 'vence_hoy' WHEN 2 THEN 'programada_hoy'
      WHEN 3 THEN 'devuelto_hoy' WHEN 4 THEN 'nueva_asignacion' WHEN 5 THEN 'revision_hoy'
      WHEN 6 THEN 'lista_publicar_hoy' WHEN 7 THEN 'vence_en_1_dia'
      WHEN 8 THEN 'vence_en_2_dias' WHEN 9 THEN 'recibida_hoy' END,
    'ruta',ruta,'fecha_limite',(fecha AT TIME ZONE 'America/Costa_Rica')::date) ORDER BY prioridad,fecha NULLS LAST,modulo,id),'[]'::jsonb)
  FROM seleccion;
$$;
REVOKE ALL ON FUNCTION public.qms_get_agenda_hoy() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.qms_get_agenda_hoy() TO authenticated;

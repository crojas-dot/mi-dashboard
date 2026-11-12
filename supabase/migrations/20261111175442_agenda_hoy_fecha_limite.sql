-- Fecha civil real; null cuando el evento no tiene vencimiento registrado.
CREATE OR REPLACE FUNCTION public.qms_get_agenda_hoy()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH contexto AS (
    SELECT (transaction_timestamp() AT TIME ZONE 'America/Costa_Rica')::date AS hoy,
      public.app_es_admin() OR (public.app_es_staff() AND public.app_tiene_permiso('quejas',false)) AS gestion
    WHERE auth.uid() IS NOT NULL AND public.app_usuario_actual_id() IS NOT NULL
  ), eventos AS MATERIALIZED (
    SELECT * FROM qms_private.agenda_eventos_hoy()
  ), candidatos AS (
    SELECT q.id, q.folio AS codigo, q.descripcion,
      CASE WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 1
        WHEN e.devuelta_hoy THEN 3 WHEN e.asignada_hoy THEN 4
        WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date=c.hoy+2 THEN 5 END AS prioridad,
      CASE WHEN c.gestion THEN '/quejas' ELSE '/mis-quejas' END AS ruta,
      q.plazo_vence AS fecha, 'quejas' AS modulo
    FROM public.qms_quejas q CROSS JOIN contexto c LEFT JOIN eventos e ON e.queja_id=q.id
    WHERE q.estado NOT IN ('No Procede','Finalizado','Cerrada')
      AND (c.gestion OR q.estado='En Investigación')
    UNION ALL
    SELECT a.id, coalesce(a.folio,'Auditoría'), coalesce(a.objetivo,'Auditoría programada'),
      CASE WHEN (a.fecha_fin AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 1
        WHEN (a.fecha_inicio AT TIME ZONE 'America/Costa_Rica')::date=c.hoy THEN 2
        WHEN (a.fecha_fin AT TIME ZONE 'America/Costa_Rica')::date=c.hoy+2 THEN 5 END,
      '/auditorias', coalesce(a.fecha_fin,a.fecha_inicio), 'auditorias'
    FROM public.auditorias a CROSS JOIN contexto c
    WHERE coalesce(a.estado,'') NOT IN ('No Procede','Finalizado','Finalizada','Completada','Cerrada','Cancelada')
  ), unicos AS (
    SELECT DISTINCT ON(modulo,id) * FROM candidatos WHERE prioridad IS NOT NULL
    ORDER BY modulo,id,prioridad,fecha NULLS LAST
  ), seleccion AS (
    SELECT * FROM unicos ORDER BY prioridad,fecha NULLS LAST,modulo,id LIMIT 20
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'codigo',codigo,'descripcion',left(regexp_replace(coalesce(descripcion,''),'[[:space:]]+',' ','g'),320),
    'motivo',CASE prioridad WHEN 1 THEN 'vence_hoy' WHEN 2 THEN 'programada_hoy'
      WHEN 3 THEN 'devuelto_hoy' WHEN 4 THEN 'nueva_asignacion' WHEN 5 THEN 'vence_en_2_dias' END,
    'ruta',ruta,'fecha_limite',(fecha AT TIME ZONE 'America/Costa_Rica')::date) ORDER BY prioridad,fecha NULLS LAST,modulo,id),'[]'::jsonb)
  FROM seleccion;
$$;
REVOKE ALL ON FUNCTION public.qms_get_agenda_hoy() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.qms_get_agenda_hoy() TO authenticated;

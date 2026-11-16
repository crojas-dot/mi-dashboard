-- Columna aditiva: días del calendario publicado en el snapshot del stage run.
-- No reescribir deadlines ni alterar estado, responsable, historial o periodos.
CREATE OR REPLACE VIEW public.qms_quejas_lista WITH (security_invoker = true) AS
SELECT q.*,
       movimientos.ultima_actividad_at,
       (q.estado = 'Recibido' AND movimientos.ultima_actividad_at IS NULL) AS sin_procesar,
       CASE WHEN q.estado = 'Recibido'
                   AND movimientos.ultima_actividad_at IS NULL
                   AND q.fecha <= now()
         THEN (
           SELECT COUNT(*) <= 2
           FROM generate_series(
             (q.fecha AT TIME ZONE 'America/Costa_Rica')::date + 1,
             (now() AT TIME ZONE 'America/Costa_Rica')::date,
             INTERVAL '1 day'
           ) AS dias(fecha)
           WHERE COALESCE(
             public.qms_business_day(
               dias.fecha::date,
               (SELECT id FROM public.qms_calendars ORDER BY id DESC LIMIT 1)
             ),
             EXTRACT(isodow FROM dias.fecha)::int BETWEEN 1 AND 5
           )
         )
         ELSE false END AS es_nuevo,
       COALESCE(movimientos.ultima_actividad_at, q.fecha) AS fecha_orden_actividad,
       CASE WHEN etapa.snapshot->'rule'->>'day_type' = 'business_days'
                 AND etapa.calendar_id IS NOT NULL AND q.plazo_vence IS NOT NULL
            THEN CASE
              WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date =
                   (now() AT TIME ZONE 'America/Costa_Rica')::date THEN 0::bigint
              WHEN (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date >
                   (now() AT TIME ZONE 'America/Costa_Rica')::date THEN
                (SELECT COUNT(*) FROM generate_series(
                   (now() AT TIME ZONE 'America/Costa_Rica')::date + 1,
                   (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date,
                   INTERVAL '1 day'
                ) g(d) WHERE public.qms_business_day(g.d::date, etapa.calendar_id))
              ELSE -(SELECT COUNT(*) FROM generate_series(
                   (q.plazo_vence AT TIME ZONE 'America/Costa_Rica')::date + 1,
                   (now() AT TIME ZONE 'America/Costa_Rica')::date,
                   INTERVAL '1 day'
                ) g(d) WHERE public.qms_business_day(g.d::date, etapa.calendar_id))
            END
         ELSE NULL::bigint END AS plazo_dias_operativos
FROM public.qms_quejas q
LEFT JOIN LATERAL (
  SELECT MAX(momentos.fecha) AS ultima_actividad_at FROM (
    SELECT m.ultima_actividad_at AS fecha
      FROM public.qms_quejas_actividad_relevante m WHERE m.queja_id = q.id
    UNION ALL SELECT MAX(e.occurred_at)
      FROM public.qms_case_events e WHERE e.module = 'quejas' AND e.case_id = q.id
        AND (e.kind <> 'opened' OR e.occurred_at > q.fecha + interval '2 minutes')
    UNION ALL SELECT MAX(a.created_at)
      FROM public.quejas_actividad a WHERE a.queja_id = q.id
    UNION ALL SELECT MAX(c.fecha)
      FROM public.quejas_comentarios c WHERE c.queja_id = q.id
    UNION ALL SELECT MAX(ad.created_at)
      FROM public.queja_adjuntos ad WHERE ad.queja_id = q.id
        AND ad.created_at > q.fecha + interval '2 minutes'
    UNION ALL SELECT MAX(r.created_at)
      FROM public.queja_gc_revisiones r WHERE r.queja_id = q.id
    UNION ALL SELECT MAX(ass.updated_at)
      FROM public.queja_investigation_assignments ass WHERE ass.queja_id = q.id
    UNION ALL SELECT MAX(rd.updated_at)
      FROM public.queja_resolution_drafts rd WHERE rd.queja_id = q.id
    UNION ALL SELECT MAX(cd.updated_at)
      FROM public.queja_response_drafts cd WHERE cd.queja_id = q.id
    UNION ALL SELECT MAX(i.created_at)
      FROM public.queja_informes i WHERE i.queja_id = q.id
    UNION ALL SELECT MAX(s.ended_at)
      FROM public.qms_stage_runs s WHERE s.case_id = q.id
    UNION ALL SELECT MAX(s.started_at)
      FROM public.qms_stage_runs s WHERE s.case_id = q.id
        AND s.started_at > q.fecha + interval '2 minutes'
  ) momentos
) movimientos ON true
LEFT JOIN LATERAL (
  SELECT sr.calendar_id, sr.snapshot FROM public.qms_stage_runs sr
  WHERE sr.case_id = q.id AND sr.stage_id = q.plazo_etapa
    AND sr.expires_at = q.plazo_vence
  ORDER BY (sr.ended_at IS NULL) DESC, sr.started_at DESC LIMIT 1
) etapa ON true;

COMMENT ON VIEW public.qms_quejas_lista IS
 'Directorio con actividad relevante y conteo natural/hábil según la regla QMS persistida.';
NOTIFY pgrst, 'reload schema';

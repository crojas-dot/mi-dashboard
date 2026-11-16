-- Directorio de Quejas / Mis Quejas: actividad operativa verificable.
-- Aditivo: no modifica folios, estados, calendarios, plazos ni la vista qms_quejas.
-- El timestamp de lectura/vista/descarga y los reintentos sin cambios no cuentan.
CREATE TABLE IF NOT EXISTS public.qms_quejas_actividad_relevante (
  queja_id uuid PRIMARY KEY REFERENCES public.quejas(id) ON DELETE CASCADE,
  ultima_actividad_at timestamptz NOT NULL
);
ALTER TABLE public.qms_quejas_actividad_relevante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qms_quejas_actividad_relevante FROM anon;
GRANT SELECT ON public.qms_quejas_actividad_relevante TO authenticated;
CREATE POLICY qms_quejas_actividad_relevante_select
  ON public.qms_quejas_actividad_relevante FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quejas q WHERE q.id = queja_id));

CREATE OR REPLACE FUNCTION qms_private.registrar_actividad_relevante_queja()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_queja_id uuid;
  v_original jsonb;
  v_nuevo jsonb;
BEGIN
  IF TG_TABLE_NAME = 'quejas' THEN
    IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
    -- Los cambios de revisión interna o sincronizaciones sin modificación real no cuentan.
    IF ROW(OLD.estado, OLD.responsable_id, OLD.cliente_nombre,
       OLD.email_cliente, OLD.telefono, OLD.categoria, OLD.tipo,
       OLD.descripcion, OLD.area_afectada, OLD.prioridad,
       OLD.observaciones, OLD.notas, OLD.notas_formato, OLD.resolucion,
       OLD.resolucion_formato, OLD.justificacion_procede,
       OLD.justificacion_procede_formato, OLD.numero_oficio_resolucion,
       OLD.fecha_cierre, OLD.derivado_sacp_id, OLD.reabierta,
       OLD.motivo_reapertura)
       IS NOT DISTINCT FROM
       ROW(NEW.estado, NEW.responsable_id, NEW.cliente_nombre,
       NEW.email_cliente, NEW.telefono, NEW.categoria, NEW.tipo,
       NEW.descripcion, NEW.area_afectada, NEW.prioridad,
       NEW.observaciones, NEW.notas, NEW.notas_formato, NEW.resolucion,
       NEW.resolucion_formato, NEW.justificacion_procede,
       NEW.justificacion_procede_formato, NEW.numero_oficio_resolucion,
       NEW.fecha_cierre, NEW.derivado_sacp_id, NEW.reabierta,
       NEW.motivo_reapertura)
    THEN RETURN NEW; END IF;
    v_queja_id := NEW.id;
  ELSE
    IF TG_OP = 'UPDATE' THEN
      v_original := to_jsonb(OLD) - ARRAY['updated_at','version','source_revision','actualizado_por'];
      v_nuevo := to_jsonb(NEW) - ARRAY['updated_at','version','source_revision','actualizado_por'];
      IF v_original IS NOT DISTINCT FROM v_nuevo THEN RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
      v_queja_id := OLD.queja_id;
    ELSE
      v_queja_id := NEW.queja_id;
    END IF;
    -- Un adjunto del formulario inicial no es una segunda actividad.
    IF TG_TABLE_NAME = 'queja_adjuntos' AND TG_OP = 'INSERT' THEN
      IF EXISTS (
        SELECT 1 FROM public.quejas q
        WHERE q.id = v_queja_id
          AND NEW.created_at <= q.fecha + INTERVAL '2 minutes'
      ) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  -- Evitar reinserciones sobre una queja que se está eliminando en cascada.
  IF NOT EXISTS (SELECT 1 FROM public.quejas q WHERE q.id = v_queja_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  INSERT INTO public.qms_quejas_actividad_relevante (queja_id, ultima_actividad_at)
  VALUES (v_queja_id, clock_timestamp())
  ON CONFLICT (queja_id)
    DO UPDATE SET ultima_actividad_at = GREATEST(
      public.qms_quejas_actividad_relevante.ultima_actividad_at,
      EXCLUDED.ultima_actividad_at
    );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION qms_private.registrar_actividad_relevante_queja() FROM PUBLIC;

CREATE TRIGGER qms_directorio_cambio_queja
  AFTER UPDATE ON public.quejas FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_notas
  AFTER INSERT OR UPDATE OR DELETE ON public.quejas_actividad FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_comentarios
  AFTER INSERT OR UPDATE OR DELETE ON public.quejas_comentarios FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_adjuntos
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_adjuntos FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_borrador_investigacion
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_resolution_drafts FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_borrador_respuesta
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_response_drafts FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_asignacion
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_investigation_assignments FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_informes
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_informes FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();
CREATE TRIGGER qms_directorio_revisiones
  AFTER INSERT OR UPDATE OR DELETE ON public.queja_gc_revisiones FOR EACH ROW
  EXECUTE FUNCTION qms_private.registrar_actividad_relevante_queja();

-- Vista de listado separada: conserva qms_quejas como contrato de detalle.
-- El histórico toma el máximo de eventos significativos conocidos, sin equiparar
-- automáticamente creation/lectura ni correos de cola con trabajo humano.
CREATE VIEW public.qms_quejas_lista WITH (security_invoker = true) AS
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
       COALESCE(movimientos.ultima_actividad_at, q.fecha) AS fecha_orden_actividad
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
) movimientos ON true;

REVOKE ALL ON public.qms_quejas_lista FROM anon;
GRANT SELECT ON public.qms_quejas_lista TO authenticated;
COMMENT ON VIEW public.qms_quejas_lista IS
 'Listado con actividad relevante; no incluye lecturas, descargas o trabajos sin cambio. Respeta RLS invoker.';
NOTIFY pgrst, 'reload schema';

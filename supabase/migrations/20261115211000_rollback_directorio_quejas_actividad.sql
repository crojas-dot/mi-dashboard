-- Rollback solicitado el 15-11-2026: estado anterior al directorio de actividad.
-- Restauración SOLO de los objetos creados por las migraciones
-- 20261115190000, 20261115194500, 20261115200000 y 20261115201500.
-- No modificar public.quejas, public.qms_quejas, sus datos, estado,
-- sus plazos ni las reglas de seguridad preexistentes.
-- No utilizar CASCADE: si aparece una dependencia nueva, abortar para revisarla.
DO $$
BEGIN
  IF to_regclass('public.qms_quejas_actividad_relevante') IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.qms_quejas_actividad_relevante) > 0 THEN
      RAISE EXCEPTION 'Rollback bloqueado: existe actividad auxiliar que requiere revisión antes de descartarse';
    END IF;
  END IF;
END $$;

DROP VIEW IF EXISTS public.qms_quejas_lista;
DROP TRIGGER IF EXISTS qms_directorio_cambio_queja ON public.quejas;
DROP TRIGGER IF EXISTS qms_directorio_notas ON public.quejas_actividad;
DROP TRIGGER IF EXISTS qms_directorio_comentarios ON public.quejas_comentarios;
DROP TRIGGER IF EXISTS qms_directorio_adjuntos ON public.queja_adjuntos;
DROP TRIGGER IF EXISTS qms_directorio_borrador_investigacion ON public.queja_resolution_drafts;
DROP TRIGGER IF EXISTS qms_directorio_borrador_respuesta ON public.queja_response_drafts;
DROP TRIGGER IF EXISTS qms_directorio_asignacion ON public.queja_investigation_assignments;
DROP TRIGGER IF EXISTS qms_directorio_informes ON public.queja_informes;
DROP TRIGGER IF EXISTS qms_directorio_revisiones ON public.queja_gc_revisiones;
DROP FUNCTION IF EXISTS qms_private.registrar_actividad_relevante_queja();
DROP TABLE IF EXISTS public.qms_quejas_actividad_relevante;
DROP INDEX IF EXISTS public.qms_events_case_recent;
NOTIFY pgrst, 'reload schema';

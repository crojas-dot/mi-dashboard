-- CORTE COORDINADO, NO forma parte de la migración aditiva.
-- Ejecutar SOLO tras publicar y verificar el cliente que llama
-- qms_resolve_complaint_with_document para No Procede y Resuelto.
-- Antes de este corte el cliente anterior sigue funcionando. Después, un cliente
-- viejo conserva lectura/investigación pero no puede emitir respuestas sin oficio.
-- Históricos ya resueltos sin publicación necesitan revisión/publicación formal
-- antes de Finalizado; no inventarles una respuesta o un documento.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.quejas IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.qms_require_published_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE publication public.queja_public_resolutions; latest_run uuid;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado OR NEW.estado NOT IN ('No Procede','Resuelto','Finalizado') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO publication FROM public.queja_public_resolutions WHERE queja_id=NEW.id;
  SELECT r.id INTO latest_run FROM public.qms_stage_runs r
    WHERE r.case_id=NEW.id AND r.stage_id='quejas.investigation'
    ORDER BY r.started_at DESC,r.id DESC LIMIT 1;
  IF publication.queja_id IS NULL OR publication.investigation_run_id IS DISTINCT FROM latest_run
    OR NOT EXISTS (SELECT 1 FROM public.queja_adjuntos d WHERE d.id=publication.adjunto_id AND d.queja_id=NEW.id
      AND d.usuario_id IS NOT NULL AND d.storage_path ~ '^[A-Za-z0-9_-]{10,200}$'
      AND d.tamano BETWEEN 1 AND 4194304
      AND NOT EXISTS (SELECT 1 FROM public.queja_attachment_deletions x WHERE x.adjunto_id=d.id)) THEN
    RAISE EXCEPTION 'La comunicación final requiere respuesta y oficio publicados.' USING ERRCODE='55000';
  END IF;
  -- El wrapper verifica la revisión original y publica dentro de esta transacción.
  -- qms_transition_complaint hace una escritura de metadatos antes de la transición;
  -- por eso OLD.revision es original+1. No usar GUC/headers editables como bypass.
  -- El par revisión/txid tampoco permite reciclar la publicación al reabrir en el mismo TX.
  IF NEW.estado IN ('No Procede','Resuelto') AND
    (publication.publication_txid IS DISTINCT FROM txid_current()
      OR publication.source_revision+1 IS DISTINCT FROM OLD.revision) THEN
    RAISE EXCEPTION 'Publicá la respuesta y su oficio desde el flujo de resolución.' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_require_published_resolution() FROM PUBLIC,anon,authenticated,service_role;
DO $trigger$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.quejas'::regclass
      AND tgname='zz_qms_require_published_resolution' AND NOT tgisinternal) THEN
    CREATE TRIGGER zz_qms_require_published_resolution BEFORE UPDATE OF estado ON public.quejas
      FOR EACH ROW EXECUTE FUNCTION public.qms_require_published_resolution();
  END IF;
END;
$trigger$;
COMMIT;

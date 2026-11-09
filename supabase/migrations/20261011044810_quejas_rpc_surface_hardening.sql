-- Sin consumidores cliente: folio lo genera el RPC autorizado dentro de su transacción.
REVOKE ALL ON FUNCTION public.generar_folio_queja(),public.qms_catalog_guard(),public.qms_record_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generar_folio_queja(),public.qms_catalog_guard(),public.qms_record_event() TO service_role;
ALTER POLICY quejas_staff_select ON public.quejas TO authenticated
  USING ((SELECT public.app_es_admin()) OR ((SELECT public.app_es_staff()) AND (SELECT public.app_tiene_permiso('quejas',false))));
CREATE OR REPLACE FUNCTION public.qms_update_details(p_id uuid, p_expected bigint, p_categoria text DEFAULT NULL::text, p_prioridad text DEFAULT NULL::text, p_owner uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE q quejas;
BEGIN
 IF auth.uid() IS NULL OR NOT (coalesce(public.app_es_admin(),false) OR (coalesce(public.app_es_staff(),false) AND coalesce(public.app_tiene_permiso('quejas',true),false))) THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM quejas WHERE id=p_id FOR UPDATE;
 IF p_expected IS NULL OR q.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza antes de guardar.' USING ERRCODE='40001'; END IF;
 PERFORM public.actualizar_detalles_queja(p_id,p_categoria,p_prioridad,p_owner,p_notes);
 RETURN (SELECT to_jsonb(v) FROM qms_quejas v WHERE id=p_id);
END; $function$
;


-- Fase B: ejecutar solo después de verificar el frontend/API IA desplegados.
-- No borrar ni rotar claves; cerrar lectura/escritura directa por Data API.
SET LOCAL lock_timeout = '5s';
DO $policies$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuraciones_sistema' LOOP
    EXECUTE format('DROP POLICY %I ON public.configuraciones_sistema',v_policy.policyname);
  END LOOP;
END;
$policies$;
CREATE POLICY configuraciones_non_ai_admin ON public.configuraciones_sistema FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin()) AND left(clave,3) <> 'ai_')
  WITH CHECK ((SELECT public.app_es_admin()) AND left(clave,3) <> 'ai_');

-- Correcciones verificadas en fykhrrpeoehwqznccmfp. No cambia datos ni folios.
-- Aplicar como una migración transaccional; las pruebas usan ROLLBACK.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Las operaciones de esquema no están cubiertas por RLS. El cliente solo
-- necesita SELECT/INSERT/UPDATE/DELETE; service_role conserva sus privilegios.
REVOKE ALL PRIVILEGES ON TABLE public.usuarios, public.documentos,
  public.auditorias, public.informes_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documentos,
  public.auditorias, public.informes_config TO authenticated;
GRANT SELECT ON TABLE public.usuarios TO authenticated;

-- Revocar también grants explícitos por columna: quitar UPDATE de tabla no
-- elimina un UPDATE concedido directamente a una columna.
DO $bloque$
DECLARE v_columnas text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum)
    INTO v_columnas FROM pg_attribute
    WHERE attrelid = 'public.usuarios'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.usuarios FROM PUBLIC, anon, authenticated', v_columnas);
END;
$bloque$;
GRANT UPDATE (nombre, telefono, avatar_url, ultimo_acceso,
  notif_habilitadas, notif_sonido, notif_sonido_id) ON public.usuarios TO authenticated;

-- 2. Directorio para staff y perfiles propios, incluido el perfil inactivo:
-- el login necesita leer su estado para mostrar el motivo del rechazo.
DROP POLICY IF EXISTS authenticated_select_usuarios ON public.usuarios;
DROP POLICY IF EXISTS authenticated_update_own_usuario_auth ON public.usuarios;
CREATE POLICY usuarios_self_view ON public.usuarios FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = auth_id
    OR (SELECT public.app_es_staff())
    OR (SELECT public.app_tiene_permiso('usuarios', false)));
-- Los comentarios de las quejas propias siguen mostrando el nombre de su
-- autor; no hace falta abrir el directorio entero al colaborador.
CREATE POLICY usuarios_autores_quejas_visibles ON public.usuarios FOR SELECT TO authenticated
  USING ((SELECT public.app_es_colaborador()) AND EXISTS (
    SELECT 1 FROM public.quejas_comentarios c
    JOIN public.quejas q ON q.id = c.queja_id
    WHERE c.usuario_id = usuarios.id AND q.responsable_id = (SELECT public.app_usuario_actual_id())
  ));
CREATE POLICY usuarios_self_update ON public.usuarios FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = auth_id AND estado = 'activo')
  WITH CHECK ((SELECT auth.uid()) = auth_id AND estado = 'activo');

-- 3. Los módulos respetan leer/escribir reales. Admin conserva su autoridad;
-- Calidad sigue accediendo según los permisos que ya tiene en la tabla.
DROP POLICY IF EXISTS authenticated_all_documentos ON public.documentos;
CREATE POLICY documentos_view_by_permission ON public.documentos FOR SELECT TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('documentos', false)));
CREATE POLICY documentos_create_by_permission ON public.documentos FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('documentos', true)));
CREATE POLICY documentos_update_by_permission ON public.documentos FOR UPDATE TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('documentos', true)))
  WITH CHECK ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('documentos', true)));
CREATE POLICY documentos_delete_by_permission ON public.documentos FOR DELETE TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('documentos', true)));

DROP POLICY IF EXISTS authenticated_all_auditorias ON public.auditorias;
CREATE POLICY auditorias_view_by_permission ON public.auditorias FOR SELECT TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('auditorias', false)));
CREATE POLICY auditorias_create_by_permission ON public.auditorias FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('auditorias', true)));
CREATE POLICY auditorias_update_by_permission ON public.auditorias FOR UPDATE TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('auditorias', true)))
  WITH CHECK ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('auditorias', true)));
CREATE POLICY auditorias_delete_by_permission ON public.auditorias FOR DELETE TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('auditorias', true)));

ALTER TABLE public.informes_config ENABLE ROW LEVEL SECURITY;
ALTER POLICY informes_config_select ON public.informes_config TO authenticated
  USING ((SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso('reporteria', false)));
ALTER POLICY informes_config_insert ON public.informes_config TO authenticated
  WITH CHECK ((SELECT public.app_es_admin()) OR
    ((SELECT public.app_tiene_permiso('reporteria', true)) AND creado_por = (SELECT public.app_usuario_actual_id())));
ALTER POLICY informes_config_update ON public.informes_config TO authenticated
  USING ((SELECT public.app_es_admin()) OR
    ((SELECT public.app_tiene_permiso('reporteria', true)) AND creado_por = (SELECT public.app_usuario_actual_id())))
  WITH CHECK ((SELECT public.app_es_admin()) OR
    ((SELECT public.app_tiene_permiso('reporteria', true)) AND creado_por = (SELECT public.app_usuario_actual_id())));
ALTER POLICY informes_config_delete_admin ON public.informes_config TO authenticated
  USING ((SELECT public.app_es_admin()));

-- 4. Una sesión de una cuenta desactivada deja de tener identidad operativa.
CREATE OR REPLACE FUNCTION public.app_usuario_actual_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $funcion$
  SELECT id FROM public.usuarios WHERE auth_id = (SELECT auth.uid()) AND estado = 'activo' LIMIT 1;
$funcion$;
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $funcion$
  SELECT public.app_usuario_actual_id();
$funcion$;
CREATE OR REPLACE FUNCTION public.current_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $funcion$
  SELECT rol FROM public.usuarios WHERE auth_id = (SELECT auth.uid()) AND estado = 'activo';
$funcion$;
ALTER FUNCTION public.es_admin() SET search_path = '';

CREATE OR REPLACE FUNCTION public.actualizar_mis_preferencias_notificacion(
  p_habilitadas boolean DEFAULT true, p_sonido boolean DEFAULT true,
  p_sonido_id text DEFAULT 'notification/info')
RETURNS public.usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $funcion$
DECLARE v_usuario public.usuarios;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No hay sesión autenticada' USING ERRCODE = '42501'; END IF;
  UPDATE public.usuarios SET notif_habilitadas = p_habilitadas,
    notif_sonido = p_sonido, notif_sonido_id = p_sonido_id
  WHERE auth_id = (SELECT auth.uid()) AND estado = 'activo' RETURNING * INTO v_usuario;
  IF v_usuario.id IS NULL THEN RAISE EXCEPTION 'No hay un perfil activo' USING ERRCODE = '42501'; END IF;
  RETURN v_usuario;
END;
$funcion$;

-- 5. Estadísticas bajo la RLS del llamador; contador IA solo desde el servidor.
ALTER FUNCTION public.obtener_estadisticas_quejas() SECURITY INVOKER;
ALTER FUNCTION public.obtener_estadisticas_quejas() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.obtener_estadisticas_quejas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_estadisticas_quejas() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.incrementar_tokens_proveedor(p_provider_id text, p_tokens integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $funcion$
DECLARE
  v_providers jsonb;
  v_actualizado jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  IF p_tokens IS NULL OR p_tokens < 0 OR p_provider_id IS NULL THEN
    RAISE EXCEPTION 'Consumo de tokens no válido' USING ERRCODE = '22023';
  END IF;
  SELECT valor INTO v_providers FROM public.configuraciones_sistema
    WHERE clave = 'ai_providers' FOR UPDATE;
  IF v_providers IS NULL OR jsonb_typeof(v_providers) <> 'array' THEN RETURN; END IF;
  FOR v_item IN SELECT jsonb_array_elements(v_providers) LOOP
    IF v_item->>'id' = p_provider_id THEN
      v_actualizado := v_actualizado || jsonb_build_array(jsonb_set(jsonb_set(v_item,
        '{tokens_usados}', to_jsonb(COALESCE((v_item->>'tokens_usados')::bigint, 0) + p_tokens)),
        '{tokens_updated_at}', to_jsonb(now()::text)));
    ELSE v_actualizado := v_actualizado || jsonb_build_array(v_item); END IF;
  END LOOP;
  IF v_actualizado IS DISTINCT FROM v_providers THEN
    UPDATE public.configuraciones_sistema SET valor = v_actualizado WHERE clave = 'ai_providers';
  END IF;
END;
$funcion$;
REVOKE EXECUTE ON FUNCTION public.incrementar_tokens_proveedor(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_tokens_proveedor(text, integer) TO service_role;
ALTER FUNCTION public.siguiente_folio_queja() SET search_path = '';
ALTER FUNCTION public.qms_classify(timestamptz, timestamptz, timestamptz) SET search_path = '';

-- 6. Retirar acceso anónimo a RPC internos, conservando exactamente los accesos
-- autenticados existentes. Los RPC antiguos ya cerrados por control de revisión
-- siguen cerrados. No se toca crear/notificar/adjuntar del formulario público.
DO $bloque$
DECLARE v_funcion record;
BEGIN
  FOR v_funcion IN
    SELECT p.oid, p.oid::regprocedure AS firma,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS acceso_autenticado
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'crear_queja_interna', 'actualizar_detalles_queja', 'transicionar_queja',
      'derivar_queja_a_sacp', 'agregar_comentario_queja', 'registrar_adjunto_queja',
      'reabrir_queja', 'actualizar_mis_preferencias_notificacion',
      'generar_folio_auditoria', 'generar_folio_documento', 'generar_folio_riesgo',
      'generar_folio_sacp', 'qms_transition', 'qms_update_details',
      'qms_publish_calendar', 'qms_publish_stage')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_funcion.firma);
    IF v_funcion.acceso_autenticado THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_funcion.firma);
    END IF;
  END LOOP;
END;
$bloque$;

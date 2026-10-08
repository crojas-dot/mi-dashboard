-- Fase A: cerrar políticas permisivas sin romper el gestor IA actualmente publicado.
-- Autorizado por el propietario el 7/oct/2026. No modifica registros históricos.
-- Fase B se aplica únicamente después de publicar/verificar /api/configuracion/ia.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Helpers existentes ya resuelven Auth -> perfil activo. Conservar firmas y ACL.
-- Sus cuerpos usan referencias cualificadas; no renombrar argumentos de funciones.
ALTER FUNCTION public.app_es_admin() SET search_path = '';
ALTER FUNCTION public.app_es_staff() SET search_path = '';
ALTER FUNCTION public.app_tiene_permiso(text, boolean) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.app_es_admin(), public.app_es_staff(), public.app_tiene_permiso(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_es_admin(), public.app_es_staff(), public.app_tiene_permiso(text, boolean) TO authenticated, service_role;

-- Sustituir TODAS las políticas del área; una permisiva heredada combinaría OR.
DO $policies$
DECLARE v_table text; v_policy record; v_columns text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['acciones','riesgos','procesos','reuniones','hallazgos',
    'documento_versiones','versiones_documentos','solicitudes_documentales','tareas',
    'catalogos','sla_config','formularios_publicos','configuraciones_sistema'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN SELECT policyname FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = v_table LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    -- RLS no restringe TRUNCATE/DDL ni elimina grants por columna.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_columns
      FROM pg_catalog.pg_attribute AS a WHERE a.attrelid = format('public.%I',v_table)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_columns, v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role', v_table);
  END LOOP;
END;
$policies$;

-- Permisos por módulo. Los helpers escalares se evalúan como InitPlan por sentencia.
DO $modules$
DECLARE v_table text; v_module text; v_read text; v_write text;
BEGIN
  FOR v_table,v_module IN SELECT * FROM (VALUES
    ('acciones','sacp'),('riesgos','riesgos'),('procesos','procesos'),('reuniones','revision'),
    ('hallazgos','auditorias'),('documento_versiones','documentos'),
    ('versiones_documentos','documentos'),('solicitudes_documentales','documentos')
  ) AS modules(table_name,module_name) LOOP
    v_read := format('(SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso(%L, false))',v_module);
    v_write := format('(SELECT public.app_es_admin()) OR (SELECT public.app_tiene_permiso(%L, true))',v_module);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',v_table||'_module_select',v_table,v_read);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',v_table||'_module_insert',v_table,v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',v_table||'_module_update',v_table,v_write,v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',v_table||'_module_delete',v_table,v_write);
  END LOOP;
END;
$modules$;

CREATE POLICY tareas_own_select ON public.tareas FOR SELECT TO authenticated
  USING ((SELECT public.app_es_admin()) OR responsable_id = (SELECT public.app_usuario_actual_id()));
CREATE POLICY tareas_admin_write ON public.tareas FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin())) WITH CHECK ((SELECT public.app_es_admin()));

-- Cualquier perfil activo necesita catálogos/SLA en los formularios y filtros.
CREATE POLICY catalogos_active_select ON public.catalogos FOR SELECT TO authenticated
  USING ((SELECT public.app_usuario_actual_id()) IS NOT NULL);
CREATE POLICY catalogos_admin_write ON public.catalogos FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin())) WITH CHECK ((SELECT public.app_es_admin()));
CREATE POLICY catalogos_public_quejas_select ON public.catalogos FOR SELECT TO anon
  USING (modulo = 'quejas' AND tipo = 'categoria_queja' AND (activo IS NULL OR activo));
GRANT SELECT ON public.catalogos TO anon;
CREATE POLICY sla_config_active_select ON public.sla_config FOR SELECT TO authenticated
  USING ((SELECT public.app_usuario_actual_id()) IS NOT NULL);
CREATE POLICY sla_config_admin_write ON public.sla_config FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin())) WITH CHECK ((SELECT public.app_es_admin()));

-- /q también es público cuando el navegador ya tiene sesión autenticada.
CREATE POLICY formularios_publicos_active_select ON public.formularios_publicos FOR SELECT TO anon, authenticated
  USING (activo = true);
CREATE POLICY formularios_publicos_admin_write ON public.formularios_publicos FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin())) WITH CHECK ((SELECT public.app_es_admin()));
GRANT SELECT ON public.formularios_publicos TO anon;

-- Compatibilidad temporal: admin puede editar con UI vieja hasta el despliegue.
CREATE POLICY configuraciones_admin_only ON public.configuraciones_sistema FOR ALL TO authenticated
  USING ((SELECT public.app_es_admin())) WITH CHECK ((SELECT public.app_es_admin()));

-- CHECK NOT VALID evita escanear/reparar historia, pero se aplica a INSERT y UPDATE.
-- Antes de aplicar, comprobar conteos agregados de filas históricas inválidas.
DO $constraints$
DECLARE v_table text; v_name text; v_check text;
BEGIN
  FOR v_table,v_name,v_check IN SELECT * FROM (VALUES
    ('procesos','qms_procesos_nombre_nonblank','nombre_proceso IS NULL OR length(btrim(nombre_proceso)) > 0'),
    ('reuniones','qms_reuniones_titulo_nonblank','titulo IS NULL OR length(btrim(titulo)) > 0'),
    ('documentos','qms_documentos_titulo_nonblank','length(btrim(titulo)) > 0'),
    ('documentos','qms_documentos_codigo_nonblank','codigo_doc IS NULL OR length(btrim(codigo_doc)) > 0'),
    ('acciones','qms_acciones_folio_nonblank','length(btrim(folio)) > 0'),
    ('riesgos','qms_riesgos_folio_nonblank','length(btrim(folio)) > 0'),
    ('auditorias','qms_auditorias_folio_nonblank','length(btrim(folio)) > 0'),
    ('riesgos','qms_riesgos_probabilidad_range','probabilidad IS NULL OR probabilidad BETWEEN 1 AND 3'),
    ('riesgos','qms_riesgos_impacto_range','impacto IS NULL OR impacto BETWEEN 1 AND 3'),
    ('acciones','qms_acciones_seguimiento_range','seguimiento_porcentaje IS NULL OR seguimiento_porcentaje BETWEEN 0 AND 100'),
    ('sla_config','qms_sla_plazos_range','dias_vencimiento >= 1 AND (dias_alerta IS NULL OR dias_alerta BETWEEN 0 AND dias_vencimiento)')
  ) AS checks(table_name,constraint_name,check_expression) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = format('public.%I',v_table)::regclass AND conname = v_name) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID',v_table,v_name,v_check);
    END IF;
  END LOOP;
END;
$constraints$;

-- El RPC SECURITY DEFINER de derivación evita RLS: cerrar el bypass también allí.
-- Modificar solo su prologue, conservando firma/cuerpo/idempotencia y ACL existentes.
DO $rpc_guard$
DECLARE v_oid oid; v_source text; v_definition text; v_guarded text;
BEGIN
  v_oid := 'public.derivar_queja_a_sacp(uuid)'::regprocedure;
  SELECT p.prosrc, pg_catalog.pg_get_functiondef(p.oid) INTO v_source,v_definition
    FROM pg_catalog.pg_proc AS p JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    WHERE p.oid = v_oid AND l.lanname = 'plpgsql';
  IF v_source IS NULL THEN RAISE EXCEPTION 'Revisar implementación de derivación SACP antes de continuar'; END IF;
  IF position('qms_audit_sacp_permissions_v1' IN v_source) = 0 THEN
    v_guarded := regexp_replace(v_source, '^[[:space:]]*BEGIN\M', 'BEGIN' || E'\n' || $guard$
      -- qms_audit_sacp_permissions_v1
      IF NOT ((SELECT public.app_es_admin()) OR (
        (SELECT public.app_es_staff()) AND (SELECT public.app_tiene_permiso('quejas', true))
          AND (SELECT public.app_tiene_permiso('sacp', true)))) THEN
        RAISE EXCEPTION 'Sin permiso para derivar a SACP' USING ERRCODE = '42501';
      END IF;
$guard$, 'in');
    IF v_guarded = v_source OR position(v_source IN v_definition) = 0 THEN
      RAISE EXCEPTION 'No se pudo conservar el cuerpo de derivación SACP';
    END IF;
    EXECUTE replace(v_definition,v_source,v_guarded);
  END IF;
END;
$rpc_guard$;

ALTER FUNCTION public.derivar_queja_a_sacp(uuid) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) TO authenticated, service_role;

-- Existe historia con fechas invertidas: validar solo altas y cambios de fechas.
-- Actualizar otros campos no obliga a reescribir/corregir historia antigua.
CREATE OR REPLACE FUNCTION public.app_validar_fechas_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  IF NEW.fecha_inicio IS NOT NULL AND NEW.fecha_fin IS NOT NULL
    AND NEW.fecha_fin < NEW.fecha_inicio
    AND (TG_OP = 'INSERT' OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
      OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin) THEN
    RAISE EXCEPTION 'La fecha de fin no puede ser anterior a la fecha de inicio'
      USING ERRCODE = '23514', CONSTRAINT = 'qms_auditorias_fecha_order';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.app_validar_fechas_auditoria() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS qms_auditorias_fechas_validas ON public.auditorias;
CREATE TRIGGER qms_auditorias_fechas_validas BEFORE INSERT OR UPDATE ON public.auditorias
  FOR EACH ROW EXECUTE FUNCTION public.app_validar_fechas_auditoria();

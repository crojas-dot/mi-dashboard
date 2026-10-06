-- ============================================================
-- HABILITAR RLS — ECA-QMS (mi-dashboard)
-- Ejecutar por partes en el SQL Editor de Supabase.
-- PASO 1: diagnostico  |  PASO 2: habilitar RLS  |  PASO 3: policies faltantes
-- ============================================================

-- ############################################################
-- PASO 1 — DIAGNÓSTICO
-- Corre esto primero. Pegame el resultado si algo no cuadra.
-- ############################################################
SELECT
  n.nspname AS esquema,
  c.relname AS tabla,
  c.relrowsecurity AS rls_activado,
  c.relforcerowsecurity AS rls_forzado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ############################################################
-- PASO 2 — HABILITAR RLS EN TODAS LAS TABLAS DE LA APP
-- Idempotente: puede correrse varias veces.
-- Incluye catalogos, sla_config y configuraciones_sistema,
-- que el frontend usa pero no aparecian en los scripts viejos.
-- ############################################################
DO $$ DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'acciones','auditorias','catalogos','configuraciones_sistema',
    'documento_versiones','documentos','hallazgos','logs','mail_queue',
    'notificaciones','procesos','quejas','quejas_comentarios','reuniones',
    'riesgos','sla_config','solicitudes_documentales','tareas','usuarios',
    'versiones_documentos'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- ############################################################
-- PASO 3 — POLICIES PARA catalogos / sla_config / configuraciones_sistema
-- Solo necesario si el diagnostico del PASO 1 mostro que esas
-- tablas NO tienen policies.
-- Regla de negocio:
--   - Cualquier usuario autenticado lee.
--   - Solo admin/calidad escriben (crear/actualizar).
--   - Solo admin elimina.
-- ############################################################
DO $$ DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'catalogos','sla_config','configuraciones_sistema'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'select_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'update_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'delete_' || tbl, tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (current_usuario_id() IS NOT NULL);',
      'select_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (es_admin() OR current_rol() = ''calidad'');',
      'insert_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (es_admin() OR current_rol() = ''calidad'');',
      'update_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (es_admin());',
      'delete_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ############################################################
-- PASO 4 — POLICY DE SELECT EN usuarios PARA PERMITIR EL LOGIN
-- CRÍTICO: el login (Fase 1) lee public.usuarios filtrando por
-- auth_id = session.user.id. Si la policy de SELECT solo permite
-- admin/calidad, un usuario 'operativo' no puede leer su propio
-- registro y no puede entrar. Esta policy asegura que cada
-- usuario pueda leer su propia fila (y que admin/calidad vean todo).
-- Idempotente: dropea y recrea.
-- ############################################################
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;

CREATE POLICY "usuarios_select_own" ON usuarios
  FOR SELECT USING (
    auth_id = auth.uid()
    OR es_admin()
    OR current_rol() = 'calidad'
  );

-- ############################################################
-- PASO 5 — VERIFICACIÓN FINAL
-- Repite la consulta de diagnostico y confirma que todas las
-- tablas tengan rls_activado = true y que existan policies.
-- ############################################################

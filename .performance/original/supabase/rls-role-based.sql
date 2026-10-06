-- ============================================================
-- ⚠️ DEPRECATED — Este archivo NO se usa en el sistema actual.
-- Las RLS activas están definidas en:
--   005_seguridad_flujos_quejas.sql (RLS staff/admin helpers)
--   006_permisos_dinamicos_colaborador.sql (permisos rol+modulo)
--   007_quejas_adjuntos_y_reapertura.sql (adjuntos)
-- No ejecutar este archivo — sobreescribiría las políticas actuales.
-- Se conserva solo como referencia histórica.
-- ============================================================

-- Helper: get the current user's role from the usuarios table
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(u.rol, 'operativo')
  FROM usuarios u
  WHERE u.id = auth.uid();
$$;

-- ============================================================
-- QUEJAS
-- ============================================================
ALTER TABLE quejas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quejas_select"      ON quejas;
DROP POLICY IF EXISTS "quejas_insert"      ON quejas;
DROP POLICY IF EXISTS "quejas_update"      ON quejas;
DROP POLICY IF EXISTS "quejas_delete"      ON quejas;

CREATE POLICY "quejas_select" ON quejas FOR SELECT USING (
  current_user_role() IN ('admin', 'calidad', 'operativo')
  OR (current_user_role() = 'cliente_externo' AND cliente_email = auth.email())
);

CREATE POLICY "quejas_insert" ON quejas FOR INSERT WITH CHECK (
  current_user_role() IN ('admin', 'calidad')
);

CREATE POLICY "quejas_update" ON quejas FOR UPDATE USING (
  current_user_role() IN ('admin', 'calidad')
);

CREATE POLICY "quejas_delete" ON quejas FOR DELETE USING (
  current_user_role() = 'admin'
);

-- ============================================================
-- NOTIFICACIONES (users see only their own)
-- ============================================================
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_update" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_insert" ON notificaciones;

CREATE POLICY "notificaciones_select" ON notificaciones
  FOR SELECT USING (usuario_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "notificaciones_update" ON notificaciones
  FOR UPDATE USING (usuario_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "notificaciones_insert" ON notificaciones
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- ACCIONES (SACP)
-- ============================================================
ALTER TABLE acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acciones_select" ON acciones;
DROP POLICY IF EXISTS "acciones_insert" ON acciones;
DROP POLICY IF EXISTS "acciones_update" ON acciones;
DROP POLICY IF EXISTS "acciones_delete" ON acciones;

CREATE POLICY "acciones_select" ON acciones FOR SELECT USING (
  current_user_role() IN ('admin', 'calidad', 'operativo')
);

CREATE POLICY "acciones_insert" ON acciones FOR INSERT WITH CHECK (
  current_user_role() IN ('admin', 'calidad')
);

CREATE POLICY "acciones_update" ON acciones FOR UPDATE USING (
  current_user_role() IN ('admin', 'calidad')
);

CREATE POLICY "acciones_delete" ON acciones FOR DELETE USING (
  current_user_role() = 'admin'
);

-- ============================================================
-- AUDITORIAS, PROCESOS, RIESGOS, REUNIONES, DOCUMENTOS
-- Same pattern: admin/calidad full CRUD, operativo read-only
-- ============================================================
DO $$ DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'auditorias','procesos','riesgos','reuniones','documentos',
    'hallazgos','solicitudes_documentales','tareas'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'select_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'update_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'delete_' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (current_user_role() != ''cliente_externo'');',
      'select_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (current_user_role() IN (''admin'',''calidad''));',
      'insert_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (current_user_role() IN (''admin'',''calidad''));',
      'update_' || tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (current_user_role() = ''admin'');',
      'delete_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- USUARIOS (users can see the list, update own record)
-- ============================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON usuarios;

CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (current_user_role() IN ('admin', 'calidad'));

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (id = auth.uid() OR current_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR current_user_role() = 'admin');

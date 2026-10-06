-- ============================================================================
-- FASE 3: ROW-LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- ============================================================================
-- Ejecuta estos comandos en tu consola SQL de Supabase
-- ============================================================================

-- 1. Habilitar RLS en tablas críticas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- 2. USUARIOS: Solo admin puede ver todos. Usuarios normales solo ven su propio perfil
CREATE POLICY "usuarios_self_view" ON usuarios
  FOR SELECT
  USING (
    auth.uid()::text = id OR
    (SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin'
  );

CREATE POLICY "usuarios_self_update" ON usuarios
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 3. PERMISOS: Solo admin puede leer permisos, o puedes hacer público para roles
CREATE POLICY "permisos_view" ON permisos
  FOR SELECT
  USING (true); -- Cambiar a: using ((SELECT rol FROM usuarios WHERE id = auth.uid()::text) = rol)

-- 4. QUEJAS: Solo admin y usuarios con permiso de lectura en módulo
CREATE POLICY "quejas_view_by_permission" ON quejas
  FOR SELECT
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin' OR
    EXISTS (
      SELECT 1 FROM permisos p
      WHERE p.rol = (SELECT rol FROM usuarios WHERE id = auth.uid()::text)
      AND p.modulo = 'quejas'
      AND p.leer = true
    )
  );

CREATE POLICY "quejas_create_by_permission" ON quejas
  FOR INSERT
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin' OR
    EXISTS (
      SELECT 1 FROM permisos p
      WHERE p.rol = (SELECT rol FROM usuarios WHERE id = auth.uid()::text)
      AND p.modulo = 'quejas'
      AND p.escribir = true
    )
  );

-- 5. AUDITORIAS: Solo lectura, solo admin
CREATE POLICY "auditorias_view_admin_only" ON auditorias
  FOR SELECT
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin'
  );

-- 6. DOCUMENTOS: Solo lectura con permiso de módulo
CREATE POLICY "documentos_view_by_permission" ON documentos
  FOR SELECT
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin' OR
    EXISTS (
      SELECT 1 FROM permisos p
      WHERE p.rol = (SELECT rol FROM usuarios WHERE id = auth.uid()::text)
      AND p.modulo = 'documentos'
      AND p.leer = true
    )
  );

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_usuarios_auth_id ON usuarios(auth_id);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_quejas_estado ON quejas(estado);
CREATE INDEX idx_quejas_fecha ON quejas(fecha DESC);
CREATE INDEX idx_permisos_rol_modulo ON permisos(rol, modulo);
CREATE INDEX idx_documentos_estado ON documentos(estado);

-- ============================================================================
-- TABLA DE AUDITORÍA (si no existe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  accion text NOT NULL,
  modulo text NOT NULL,
  tabla text NOT NULL,
  registro_id text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_view_admin_only" ON audit_log
  FOR SELECT
  USING ((SELECT rol FROM usuarios WHERE id = auth.uid()::text) = 'admin');

CREATE INDEX idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_log_fecha ON audit_log(created_at DESC);

-- ============================================================================
-- TRIGGERS PARA AUDITORÍA AUTOMÁTICA
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (usuario_id, accion, modulo, tabla, registro_id, datos_anteriores, datos_nuevos)
  VALUES (
    auth.uid()::uuid,
    TG_OP,
    'general',
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Opcional: Agregar trigger a tabla crítica
CREATE TRIGGER quejas_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON quejas
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_change();

-- ============================================================================
-- FUNCIÓN PARA VALIDAR ACCESO POR MÓDULO (usable en triggers o procedures)
-- ============================================================================

CREATE OR REPLACE FUNCTION tiene_acceso_modulo(user_id uuid, modulo_nombre text, requiere_escritura boolean DEFAULT false)
RETURNS boolean AS $$
DECLARE
  user_rol text;
  tiene_permiso boolean;
BEGIN
  SELECT rol INTO user_rol FROM usuarios WHERE id = user_id;
  
  IF user_rol = 'admin' THEN
    RETURN true;
  END IF;

  IF requiere_escritura THEN
    SELECT EXISTS (
      SELECT 1 FROM permisos
      WHERE rol = user_rol
      AND modulo = modulo_nombre
      AND leer = true
      AND escribir = true
    ) INTO tiene_permiso;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM permisos
      WHERE rol = user_rol
      AND modulo = modulo_nombre
      AND leer = true
    ) INTO tiene_permiso;
  END IF;

  RETURN tiene_permiso;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICAR QUE RLS ESTÁ ACTIVO
-- ============================================================================

SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('usuarios', 'quejas', 'permisos', 'documentos', 'auditorias')
AND schemaname = 'public';

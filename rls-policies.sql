-- Enable RLS on all tables
ALTER TABLE IF EXISTS acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documento_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hallazgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mail_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS procesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quejas_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS riesgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS solicitudes_documentales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS versiones_documentos ENABLE ROW LEVEL SECURITY;

-- Helper: drop existing policies to make script idempotent
DO $$ DECLARE
  tbl text;
  pol text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'acciones','auditorias','documento_versiones','documentos','hallazgos',
    'logs','mail_queue','notificaciones','procesos','quejas',
    'quejas_comentarios','reuniones','riesgos','solicitudes_documentales',
    'tareas','usuarios','versiones_documentos'
  ]) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Application tables: authenticated users get full CRUD
DO $$ DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'acciones','auditorias','documento_versiones','documentos','hallazgos',
    'notificaciones','procesos','quejas','quejas_comentarios','reuniones',
    'riesgos','solicitudes_documentales','tareas','versiones_documentos'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY "authenticated_all_%I" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      tbl, tbl
    );
  END LOOP;
END $$;

-- System tables: more restrictive
-- logs: only INSERT (no read/update/delete for regular users)
CREATE POLICY "authenticated_insert_logs" ON logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- mail_queue: only INSERT
CREATE POLICY "authenticated_insert_mail_queue" ON mail_queue
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- usuarios: SELECT + UPDATE own record only
CREATE POLICY "authenticated_select_usuarios" ON usuarios
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_own_usuario" ON usuarios
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

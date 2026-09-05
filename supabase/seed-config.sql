-- =============================================================================
-- seed-config.sql
-- Datos iniciales del sistema ECA-QMS
-- Schema de permisos: (rol, modulo, leer, escribir) — PK (rol, modulo)
-- Roles reales del sistema: admin, calidad
-- =============================================================================

-- Asegurar columnas correctas en sla_config
ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS proceso text;
ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS prioridad text;
ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS dias_alerta int DEFAULT 0;
ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS dias_vencimiento int DEFAULT 0;

-- Asegurar columna color en catalogos
ALTER TABLE catalogos ADD COLUMN IF NOT EXISTS color text DEFAULT 'gray';

-- Asegurar columna descripcion en sla_config
ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS descripcion text;

-- RLS: permitir a usuarios autenticados CRUD en tablas de configuración
ALTER TABLE catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all_catalogos ON catalogos;
CREATE POLICY authenticated_all_catalogos ON catalogos
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_all_sla_config ON sla_config;
CREATE POLICY authenticated_all_sla_config ON sla_config
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_all_configuraciones_sistema ON configuraciones_sistema;
CREATE POLICY authenticated_all_configuraciones_sistema ON configuraciones_sistema
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- =============================================================================
-- PERMISOS: schema (rol, modulo, leer, escribir) — PK (rol, modulo)
-- Solo roles reales del sistema: admin, calidad, colaborador
-- =============================================================================
INSERT INTO permisos (rol, modulo, leer, escribir) VALUES
  -- admin: acceso total
  ('admin',       'dashboard',     true,  true),
  ('admin',       'quejas',        true,  true),
  ('admin',       'mis_quejas',    true,  true),
  ('admin',       'documentos',    true,  true),
  ('admin',       'sacp',          true,  true),
  ('admin',       'riesgos',       true,  true),
  ('admin',       'auditorias',    true,  true),
  ('admin',       'revision',      true,  true),
  ('admin',       'procesos',      true,  true),
  ('admin',       'usuarios',      true,  true),
  ('admin',       'configuracion', true,  true),
  ('admin',       'reporteria',    true,  true),
  -- calidad: todo excepto administración
  ('calidad',     'dashboard',     true,  true),
  ('calidad',     'quejas',        true,  true),
  ('calidad',     'mis_quejas',    true,  true),
  ('calidad',     'documentos',    true,  true),
  ('calidad',     'sacp',          true,  true),
  ('calidad',     'riesgos',       true,  true),
  ('calidad',     'auditorias',    true,  true),
  ('calidad',     'revision',      true,  true),
  ('calidad',     'procesos',      true,  true),
  ('calidad',     'usuarios',      false, false),
  ('calidad',     'configuracion', false, false),
  ('calidad',     'reporteria',    true,  true),
  -- colaborador: solo sus quejas asignadas
  ('colaborador', 'dashboard',     false, false),
  ('colaborador', 'quejas',        false, false),
  ('colaborador', 'mis_quejas',    true,  true),
  ('colaborador', 'documentos',    false, false),
  ('colaborador', 'sacp',          false, false),
  ('colaborador', 'riesgos',       false, false),
  ('colaborador', 'auditorias',    false, false),
  ('colaborador', 'revision',      false, false),
  ('colaborador', 'procesos',      false, false),
  ('colaborador', 'usuarios',      false, false),
  ('colaborador', 'configuracion', false, false),
  ('colaborador', 'reporteria',    false, false)
ON CONFLICT (rol, modulo) DO UPDATE
  SET leer = EXCLUDED.leer, escribir = EXCLUDED.escribir;

-- =============================================================================
-- CATÁLOGOS
-- =============================================================================
INSERT INTO catalogos (tipo, valor, color, orden, activo) VALUES
  -- Prioridades
  ('prioridad', 'Alta',   'red',    1, true),
  ('prioridad', 'Media',  'amber',  2, true),
  ('prioridad', 'Baja',   'green',  3, true),

  -- Estados de queja
  ('estado_queja', 'Recibido',    'blue',   1, true),
  ('estado_queja', 'En Investigación', 'amber', 2, true),
  ('estado_queja', 'Pendiente de Revisión GC', 'purple', 3, true),
  ('estado_queja', 'Resuelto',    'green',  4, true),
  ('estado_queja', 'Finalizado',  'gray',   5, true),
  ('estado_queja', 'No Procede',  'red',    6, true),

  -- Categorías de queja
  ('categoria_queja', 'Servicio',           'blue',   1, true),
  ('categoria_queja', 'Facturación',        'amber',  2, true),
  ('categoria_queja', 'Atención al cliente','purple', 3, true),
  ('categoria_queja', 'Calidad',            'green',  4, true),
  ('categoria_queja', 'Plazo',              'red',    5, true),
  ('categoria_queja', 'Comunicación',       'blue',   6, true),
  ('categoria_queja', 'Otro',               'gray',   7, true),

  -- Tipos de hallazgo
  ('tipo_hallazgo', 'No Conformidad',           'red',    1, true),
  ('tipo_hallazgo', 'Observación',              'amber',  2, true),
  ('tipo_hallazgo', 'Oportunidad de mejora',    'blue',   3, true),
  ('tipo_hallazgo', 'Corrección',               'orange', 4, true),

  -- Estados de SACP
  ('estado_sacp', 'Abierta',       'red',    1, true),
  ('estado_sacp', 'En Proceso',    'blue',   2, true),
  ('estado_sacp', 'En Validación', 'amber',  3, true),
  ('estado_sacp', 'Cerrada',       'green',  4, true),

  -- Tipos de SACP
  ('tipo_sacp', 'Correctiva',  'red',    1, true),
  ('tipo_sacp', 'Preventiva',  'blue',   2, true),
  ('tipo_sacp', 'Corrección',  'orange', 3, true),
  ('tipo_sacp', 'Operativa',   'amber',  4, true),

  -- Tipos de documento
  ('tipo_documento', 'Política',       'red',    1, true),
  ('tipo_documento', 'Procedimiento',  'blue',   2, true),
  ('tipo_documento', 'Instructivo',    'green',  3, true),
  ('tipo_documento', 'Registro',       'amber',  4, true),
  ('tipo_documento', 'Formato',        'purple', 5, true),
  ('tipo_documento', 'Manual',         'gray',   6, true),

  -- Estados de documento
  ('estado_documento', 'Borrador',    'gray',   1, true),
  ('estado_documento', 'En Revisión', 'amber',  2, true),
  ('estado_documento', 'Publicado',   'green',  3, true),
  ('estado_documento', 'Archivado',   'red',    4, true),

  -- Estados de auditoría
  ('estado_auditoria', 'Planificada', 'blue',   1, true),
  ('estado_auditoria', 'En Curso',    'amber',  2, true),
  ('estado_auditoria', 'Completada',  'green',  3, true),

  -- Estados de reunión
  ('estado_reunion', 'Planificada', 'blue',   1, true),
  ('estado_reunion', 'Realizada',   'green',  2, true),
  ('estado_reunion', 'Cancelada',   'red',    3, true)

ON CONFLICT (tipo, valor) DO UPDATE
  SET color = EXCLUDED.color, orden = EXCLUDED.orden, activo = EXCLUDED.activo;

-- =============================================================================
-- SLA CONFIG
-- =============================================================================
INSERT INTO sla_config (proceso, prioridad, dias_alerta, dias_vencimiento) VALUES
  ('quejas', 'Alta',  1,  3),
  ('quejas', 'Media', 3,  15),
  ('quejas', 'Baja',  5,  30)
ON CONFLICT (proceso, prioridad) DO UPDATE
  SET dias_alerta = EXCLUDED.dias_alerta, dias_vencimiento = EXCLUDED.dias_vencimiento;

-- =============================================================================
-- CONFIGURACIONES GENERALES
-- =============================================================================
INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria) VALUES
  ('org.nombre',         '"ECA-QMS"',                        'Nombre de la organización',               'general'),
  ('org.logo_url',       '""',                               'URL del logo institucional',               'general'),
  ('org.zona_horaria',   '"America/Costa_Rica"',             'Zona horaria del sistema',                 'general'),
  ('quejas.folio_prefix','"Q-"',                             'Prefijo para folios de quejas',            'numeracion'),
  ('sacp.folio_prefix',  '"SACP-"',                          'Prefijo para folios de SACP',              'numeracion')
ON CONFLICT (clave) DO NOTHING;

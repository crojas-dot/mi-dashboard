-- =============================================================================
-- Migración 012: Índices de rendimiento para columnas frecuentes en WHERE/JOIN
-- =============================================================================

-- Quejas
CREATE INDEX IF NOT EXISTS idx_quejas_responsable_id ON quejas (responsable_id);
CREATE INDEX IF NOT EXISTS idx_quejas_estado ON quejas (estado);
CREATE INDEX IF NOT EXISTS idx_quejas_folio ON quejas (folio);
CREATE INDEX IF NOT EXISTS idx_quejas_fecha ON quejas (fecha DESC);

-- Acciones (SACP)
CREATE INDEX IF NOT EXISTS idx_acciones_responsable_id ON acciones (responsable_id);
CREATE INDEX IF NOT EXISTS idx_acciones_estado ON acciones (estado);
CREATE INDEX IF NOT EXISTS idx_acciones_origen ON acciones (origen, origen_id);

-- Notificaciones
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones (usuario_id, leida, archivada) WHERE leida = false AND archivada = false;

-- Adjuntos de quejas
CREATE INDEX IF NOT EXISTS idx_queja_adjuntos_queja_id ON queja_adjuntos (queja_id);

-- Actividad de quejas
CREATE INDEX IF NOT EXISTS idx_quejas_actividad_queja_id ON quejas_actividad (queja_id);

-- Comentarios de quejas
CREATE INDEX IF NOT EXISTS idx_quejas_comentarios_queja_id ON quejas_comentarios (queja_id);

-- Catálogos (compuesto para filtros frecuentes)
CREATE INDEX IF NOT EXISTS idx_catalogos_modulo_tipo ON catalogos (modulo, tipo);

-- Hallazgos
CREATE INDEX IF NOT EXISTS idx_hallazgos_auditoria_id ON hallazgos (auditoria_id);

-- Documentos
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos (estado);

-- Usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id ON usuarios (auth_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol_estado ON usuarios (rol, estado);

-- SLA Config
CREATE INDEX IF NOT EXISTS idx_sla_config_proceso ON sla_config (proceso);

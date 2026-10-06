-- ============================================================
-- 016_indices_limpieza.sql
-- Limpieza de índices redundantes + FKs sin índice.
-- Ejecutar en SQL Editor de Supabase (requiere rol postgres).
-- Idempotente: puede correrse varias veces.
-- ============================================================

-- 1) Índices redundantes (eliminar)
DROP INDEX IF EXISTS idx_notificaciones_usuario_id;   -- duplicado de idx_notificaciones_usuario
DROP INDEX IF EXISTS idx_hallazgos_auditoria_id;      -- duplicado de idx_hallazgos_auditoria
DROP INDEX IF EXISTS idx_usuarios_auth_id;            -- redundante con usuarios_auth_id_key (UNIQUE)
DROP INDEX IF EXISTS idx_quejas_folio;                -- redundante con quejas_folio_key (UNIQUE)

-- 2) FKs importantes a acciones (integridad referencial con SACP)
CREATE INDEX IF NOT EXISTS idx_quejas_derivado_sacp ON quejas (derivado_sacp_id);
CREATE INDEX IF NOT EXISTS idx_hallazgos_derivado_sacp ON hallazgos (derivado_sacp_id);

-- 3) FKs a usuarios (para DELETE/UPDATE de usuario y consultas por responsable)
CREATE INDEX IF NOT EXISTS idx_riesgos_responsable ON riesgos (responsable_id);
CREATE INDEX IF NOT EXISTS idx_reuniones_organizador ON reuniones (organizador_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_auditor_lider ON auditorias (auditor_lider_id);
CREATE INDEX IF NOT EXISTS idx_hallazgos_responsable ON hallazgos (responsable_id);
CREATE INDEX IF NOT EXISTS idx_quejas_comentarios_usuario ON quejas_comentarios (usuario_id);
CREATE INDEX IF NOT EXISTS idx_queja_adjuntos_usuario ON queja_adjuntos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_quejas_actividad_usuario ON quejas_actividad (usuario_id);
CREATE INDEX IF NOT EXISTS idx_tareas_responsable ON tareas (responsable_id);
CREATE INDEX IF NOT EXISTS idx_procesos_responsable ON procesos (responsable_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante ON solicitudes_documentales (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_revisor ON solicitudes_documentales (revisor_id);
CREATE INDEX IF NOT EXISTS idx_versiones_doc_autor ON versiones_documentos (autor_id);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_formularios_creador ON formularios_publicos (creado_por);
CREATE INDEX IF NOT EXISTS idx_informes_creador ON informes_config (creado_por);

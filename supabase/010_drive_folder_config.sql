-- ============================================================
-- 010_drive_folder_config.sql
-- Configuración para adjuntos de quejas en Google Drive (Workspace)
-- vía Service Account (server-to-server).
--
-- La clave 'drive_folder_id_quejas' guarda el ID de la carpeta raíz
-- de Drive donde el endpoint /api/drive/upload crea (o reutiliza)
-- la subcarpeta por folio (ej. "QUEJA-2026-0045") y sube los archivos.
--
-- El valor es un STRING jsonb. Editable desde /configuracion →
-- tab "General" por un admin. La lectura del endpoint se hace con
-- service_role (bypasea RLS de configuraciones_sistema).
--
-- REQUISITOS EN GOOGLE (fuera de Supabase):
--   1. Proyecto GCP con la Google Drive API habilitada.
--   2. Service Account creada + clave JSON → GOOGLE_CLIENT_EMAIL
--      y GOOGLE_PRIVATE_KEY en .env.local.
--   3. COMPARTIR la carpeta raíz de Drive con el email de la
--      Service Account como Editor (si no, Drive devuelve 403).
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

INSERT INTO public.configuraciones_sistema (clave, valor, descripcion, categoria)
VALUES (
  'drive_folder_id_quejas',
  '"REEMPLAZAME_POR_EL_ID_DE_LA_CARPETA_RAIZ_DE_DRIVE"'::jsonb,
  'ID de la carpeta raíz de Google Drive donde se guardan los adjuntos de quejas. El sistema crea una subcarpeta por folio (ej. QUEJA-2026-0045) dentro de esta carpeta. Compartir la carpeta con la Service Account como Editor.',
  'general'
)
ON CONFLICT (clave) DO NOTHING;

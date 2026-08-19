-- ============================================================
-- 008_eliminar_overload_transicionar_queja.sql
-- Elimina el overload viejo de transicionar_queja (uuid, text, text)
-- que convivía con el nuevo (uuid, text, text, text, uuid, text)
-- creado manualmente, causando el error de PostgREST
-- "Could not choose the best candidate function".
-- El cliente ya envía SIEMPRE los 6 parámetros.
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

DROP FUNCTION IF EXISTS public.transicionar_queja(uuid, text, text);

GRANT EXECUTE ON FUNCTION public.transicionar_queja(uuid, text, text, text, uuid, text) TO authenticated;
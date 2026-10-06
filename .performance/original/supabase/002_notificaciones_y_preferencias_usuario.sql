-- ============================================================
-- 002_notificaciones_y_preferencias_usuario.sql
-- ECA-QMS — Migración idempotente (puede correrse varias veces).
-- Requiere: 001_quejas_formulario_publico_y_alertas.sql aplicada.
-- Crea:
--   1. usuarios.notif_habilitadas, usuarios.notif_sonido
--   2. notificaciones.archivada (soft delete)
--   3. RPC actualizar_mis_preferencias_notificacion(p_habilitadas, p_sonido)
--      SECURITY DEFINER: actualiza sólo la fila del usuario autenticado (auth.uid()).
-- NO toca RLS de tablas existentes.
-- ============================================================

-- 1) Preferencias de notificación por usuario --------------------
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS notif_habilitadas boolean NOT NULL DEFAULT true;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS notif_sonido boolean NOT NULL DEFAULT true;

-- 2) Soft delete de notificaciones --------------------------------
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS archivada boolean NOT NULL DEFAULT false;

-- 3) RPC de autoservicio de preferencias ---------------------------
-- Actualiza SOLO la fila del usuario autenticado (auth.uid() == usuarios.auth_id).
-- No requiere abrir UPDATE en usuarios para el rol autenticado: SECURITY DEFINER
-- ejecuta con la identidad del owner (postgres) y valida la pertenencia explícitamente.
CREATE OR REPLACE FUNCTION public.actualizar_mis_preferencias_notificacion(
  p_habilitadas boolean DEFAULT true,
  p_sonido boolean DEFAULT true
)
RETURNS public.usuarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_usuario public.usuarios;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión autenticada';
  END IF;

  UPDATE public.usuarios
  SET notif_habilitadas = p_habilitadas,
      notif_sonido = p_sonido
  WHERE auth_id = v_auth_id
  RETURNING * INTO v_usuario;

  IF v_usuario.id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tu perfil de usuario';
  END IF;

  RETURN v_usuario;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_mis_preferencias_notificacion(boolean, boolean)
  TO authenticated;
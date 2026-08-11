-- ============================================================
-- 003_seleccion_sonido_notificacion.sql
-- ECA-QMS — Migración idempotente (puede correrse varias veces).
-- Requiere: 002_notificaciones_y_preferencias_usuario.sql aplicada.
-- Crea/actualiza:
--   1. usuarios.notif_sonido_id (text, CHECK en 8 ids curados: 4 de notificación + 4 de juego)
--   2. RPC actualizar_mis_preferencias_notificacion(p_habilitadas, p_sonido, p_sonido_id)
--      SECURITY DEFINER: actualiza sólo la fila del usuario autenticado (auth.uid()).
-- NO toca RLS de tablas existentes.
-- ============================================================

-- 1) Selección de sonido ----------------------------------------
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS notif_sonido_id text;

-- Restringe a los 8 sonidos curados que usa el frontend (react-sounds IDs).
-- Si en el futuro se agregan más, hay que actualizar este CHECK y el frontend en conjunto.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_notif_sonido_id_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_notif_sonido_id_check
  CHECK (notif_sonido_id IS NULL OR notif_sonido_id IN (
    'notification/info',
    'notification/success',
    'notification/popup',
    'notification/error',
    'game/coin',
    'game/void',
    'game/hit',
    'game/miss'
  ));

-- 2) RPC de autoservicio de preferencias (extendido) --------------
-- DROP previo: Postgres no permite cambiar el tipo de retorno de una
-- función existente (42P13), así que se eliminan las versiones viejas
-- (2 y 3 argumentos) antes de recrear la definitiva.
DROP FUNCTION IF EXISTS public.actualizar_mis_preferencias_notificacion(boolean, boolean);
DROP FUNCTION IF EXISTS public.actualizar_mis_preferencias_notificacion(boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.actualizar_mis_preferencias_notificacion(
  p_habilitadas boolean DEFAULT true,
  p_sonido boolean DEFAULT true,
  p_sonido_id text DEFAULT 'notification/info'
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
      notif_sonido = p_sonido,
      notif_sonido_id = p_sonido_id
  WHERE auth_id = v_auth_id
  RETURNING * INTO v_usuario;

  IF v_usuario.id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tu perfil de usuario';
  END IF;

  RETURN v_usuario;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_mis_preferencias_notificacion(boolean, boolean, text)
  TO authenticated;
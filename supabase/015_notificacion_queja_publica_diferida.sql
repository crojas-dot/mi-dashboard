-- ============================================================
-- 015_notificacion_queja_publica_diferida.sql
-- ECA-QMS — Migración idempotente (puede correrse varias veces).
-- Requiere: 004_realtime_y_notificacion_queja_publica.sql aplicada.
-- Objetivo: diferir la notificación de "nueva queja" hasta que los
-- adjuntos hayan sido subidos a Drive y registrados en queja_adjuntos.
--
-- Antes, crear_queja_publica insertaba la notificación dentro de la misma
-- transacción que crea la queja, por lo que la campana sonaba al instante
-- (y el panel la mostraba) ANTES de que existiera ningún adjunto.
--
-- Cambio:
--   1. crear_queja_publica deja de notificar: solo crea la queja.
--   2. Nuevo RPC notificar_queja_publica(p_folio): dispara la notificación
--      a admin/calidad. El frontend lo invoca DESPUÉS de subir adjuntos.
-- ============================================================

-- 1) Redefinir crear_queja_publica SIN notificación ----------------------
-- DROP previo por si cambia el tipo de retorno entre versiones.
DROP FUNCTION IF EXISTS public.crear_queja_publica(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.crear_queja_publica(
  p_token text,
  p_cliente_nombre text,
  p_email_cliente text,
  p_telefono text,
  p_categoria text,
  p_descripcion text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form formularios_publicos;
  v_folio text;
BEGIN
  SELECT * INTO v_form
  FROM formularios_publicos
  WHERE token = p_token AND activo = true
  LIMIT 1;

  IF v_form.id IS NULL THEN
    RAISE EXCEPTION 'El enlace no es válido o ya no está disponible';
  END IF;

  IF p_cliente_nombre IS NULL OR btrim(p_cliente_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del quejoso es obligatorio';
  END IF;

  v_folio := generar_folio_queja();

  INSERT INTO quejas (
    folio, cliente_nombre, email_cliente, telefono,
    categoria, descripcion, estado, fecha
  ) VALUES (
    v_folio,
    btrim(p_cliente_nombre),
    p_email_cliente,
    p_telefono,
    p_categoria,
    p_descripcion,
    'Recibido',
    now()
  );

  RETURN v_folio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_queja_publica(text, text, text, text, text, text) TO anon, authenticated;

-- 2) Nuevo RPC: notificar_queja_publica --------------------------------
-- Dispara la notificación a admin/calidad activos. Se llama desde el
-- frontend DESPUÉS de registrar los adjuntos, para que la campana suene
-- cuando la queja ya tiene sus evidencias (o se confirma que no las hay).
CREATE OR REPLACE FUNCTION public.notificar_queja_publica(
  p_folio text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja_id uuid;
  v_categoria text;
  v_staff record;
BEGIN
  SELECT id, categoria INTO v_queja_id, v_categoria
  FROM quejas
  WHERE folio = p_folio
  LIMIT 1;

  IF v_queja_id IS NULL THEN
    RAISE EXCEPTION 'Queja no encontrada para el folio %', p_folio;
  END IF;

  -- Evitar notificaciones duplicadas si el frontend reintenta.
  IF EXISTS (
    SELECT 1 FROM public.notificaciones
    WHERE tipo = 'queja_nueva' AND origen_id = v_queja_id::text
  ) THEN
    RETURN;
  END IF;

  FOR v_staff IN
    SELECT id, email FROM public.usuarios
    WHERE rol IN ('admin', 'calidad')
      AND (estado IS NULL OR estado = 'activo')
  LOOP
    INSERT INTO public.notificaciones (usuario_id, fecha, tipo, mensaje, enlace, origen_id)
    VALUES (
      v_staff.id,
      now(),
      'queja_nueva',
      'Nueva queja ' || p_folio || ' registrada: ' || COALESCE(v_categoria, ''),
      '/quejas',
      v_queja_id::text
    );

    INSERT INTO public.mail_queue (destinatario, asunto, cuerpo, estado, intentos, created_at)
    SELECT v_staff.email, 'Nueva queja ' || p_folio, 'Se recibió una nueva queja con folio ' || p_folio || '.', 'pendiente', 0, now()
    WHERE v_staff.email IS NOT NULL;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_queja_publica(text) TO anon, authenticated;

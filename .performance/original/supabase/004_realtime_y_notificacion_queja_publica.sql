-- ============================================================
-- 004_realtime_y_notificacion_queja_publica.sql
-- ECA-QMS — Migración idempotente (puede correrse varias veces).
-- Requiere: 003_seleccion_sonido_notificacion.sql aplicada.
-- Crea/actualiza:
--   1. Realtime habilitado para quejas y notificaciones (publicación supabase_realtime)
--   2. RPC crear_queja_publica: además de insertar la queja, notifica a los
--      admin/calidad activos para que la nueva queja aparezca en su campana.
-- NO toca RLS de tablas existentes.
-- ============================================================

-- 1) Realtime -------------------------------------------------------
-- Habilitar la publicación de cambios para que el frontend reciba
-- INSERT/UPDATE de quejas y notificaciones y pueda invalidar su caché.
ALTER TABLE public.quejas REPLICA IDENTITY FULL;
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quejas'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quejas;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificaciones'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
    END IF;
  END IF;
END
$$;

-- 2) Notificar a staff cuando llega una queja pública -----------------
-- DROP previo: versiones anteriores de este RPC podrían tener otro tipo
-- de retorno (p.ej. TABLE(folio text)), y Postgres no permite cambiarlo.
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
  v_queja_id uuid;
  v_staff record;
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
  )
  RETURNING id INTO v_queja_id;

  -- Notificar a admin/calidad activos para que la vean en la campana
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
      'Nueva queja ' || v_folio || ' registrada: ' || p_categoria,
      '/quejas',
      v_queja_id::text
    );

    INSERT INTO public.mail_queue (destinatario, asunto, cuerpo, estado, intentos, created_at)
    SELECT v_staff.email, 'Nueva queja ' || v_folio, 'Se recibió una nueva queja con folio ' || v_folio || '.', 'pendiente', 0, now()
    WHERE v_staff.email IS NOT NULL;
  END LOOP;

  RETURN v_folio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_queja_publica(text, text, text, text, text, text) TO anon, authenticated;
-- ============================================================
-- 001_quejas_formulario_publico_y_alertas.sql
-- ECA-QMS — Migración idempotente (puede correrse varias veces).
-- Proyecto: fykhrrpeoehwqznccmfp
-- Crea:
--   1. columna quejas.fecha_limite_investigacion
--   2. tabla formularios_publicos (RLS: staff CRUD, anon SELECT activo=true)
--   3. RPC crear_queja_publica(...) SECURITY DEFINER (anon + authenticated)
--   4. funcion procesar_alertas_quejas() + agendado pg_cron (si disponible)
--   5. seed idempotente de estado_queja (Recibido/No Procede/En Investigación/Resuelto/Finalizado)
-- NO toca RLS de tablas existentes.
-- ============================================================

-- 1) Columna de fecha límite de investigación --------------------
ALTER TABLE quejas ADD COLUMN IF NOT EXISTS fecha_limite_investigacion timestamp with time zone;

-- 2) Tabla formularios_publicos -----------------------------------
CREATE TABLE IF NOT EXISTS formularios_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL DEFAULT 'quejas',
  nombre text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para formularios_publicos
ALTER TABLE formularios_publicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formularios_publicos_anon_select" ON formularios_publicos;
CREATE POLICY "formularios_publicos_anon_select" ON formularios_publicos
  FOR SELECT TO anon USING (activo = true);

DROP POLICY IF EXISTS "formularios_publicos_auth_all" ON formularios_publicos;
CREATE POLICY "formularios_publicos_auth_all" ON formularios_publicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) RPC: crear_queja_publica -------------------------------------
-- El frontend público NO inserta directo en quejas; llama este RPC.
-- SECURITY DEFINER para que anon pueda insertar sin abrir INSERT a anon.
-- Genera folio con generar_folio_queja() y crea la queja con estado 'Recibido'.
CREATE OR REPLACE FUNCTION crear_queja_publica(
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

GRANT EXECUTE ON FUNCTION crear_queja_publica(text, text, text, text, text, text) TO anon, authenticated;

-- 4) Alertas automáticas de investigación --------------------------
-- Crea notificaciones para quejas en 'En Investigación' a 3 y 1 días
-- del vencimiento de fecha_limite_investigacion.
-- Destinatario: responsable_id si existe, si no todos los admin/calidad activos.
CREATE OR REPLACE FUNCTION procesar_alertas_quejas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja record;
  v_dias int;
  v_destinos uuid[];
  v_destino uuid;
  v_tipo text;
  v_mensaje text;
BEGIN
  FOR v_queja IN
    SELECT q.id, q.folio, q.fecha_limite_investigacion, q.responsable_id
    FROM quejas q
    WHERE q.estado = 'En Investigación'
      AND q.fecha_limite_investigacion IS NOT NULL
  LOOP
    v_dias := (v_queja.fecha_limite_investigacion::date - CURRENT_DATE);

    IF v_dias NOT IN (3, 1) THEN
      CONTINUE;
    END IF;

    IF v_dias = 3 THEN
      v_tipo := 'alerta_queja_3d';
      v_mensaje := 'La queja ' || v_queja.folio || ' vence en 3 días.';
    ELSE
      v_tipo := 'alerta_queja_1d';
      v_mensaje := 'La queja ' || v_queja.folio || ' vence mañana.';
    END IF;

    IF v_queja.responsable_id IS NOT NULL THEN
      v_destinos := ARRAY[v_queja.responsable_id];
    ELSE
      SELECT ARRAY_AGG(u.id) INTO v_destinos
      FROM usuarios u
      WHERE u.rol IN ('admin', 'calidad')
        AND (u.estado IS NULL OR u.estado = 'activo');
    END IF;

    IF v_destinos IS NULL THEN
      CONTINUE;
    END IF;

    FOREACH v_destino IN ARRAY v_destinos LOOP
      -- Evitar duplicados por cada corrida del cron
      IF NOT EXISTS (
        SELECT 1 FROM notificaciones n
        WHERE n.usuario_id = v_destino
          AND n.origen_id = v_queja.id::text
          AND n.tipo = v_tipo
          AND n.leida IS NOT true
      ) THEN
        INSERT INTO notificaciones (usuario_id, fecha, tipo, mensaje, enlace, origen_id)
        VALUES (v_destino, now(), v_tipo, v_mensaje, '/quejas', v_queja.id::text);

        -- Infraestructura de correo (sin worker: el envio real NO esta implementado)
        INSERT INTO mail_queue (destinatario, asunto, cuerpo, estado, intentos, created_at)
        SELECT email, 'Vencimiento de queja ' || v_queja.folio, v_mensaje, 'pendiente', 0, now()
        FROM usuarios u WHERE u.id = v_destino AND u.email IS NOT NULL;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Agendar diario (06:00). Si pg_cron no existe, se salta silenciosamente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('alerta-quejas-investigacion');
    PERFORM cron.schedule(
      'alerta-quejas-investigacion',
      '0 6 * * *',
      'SELECT procesar_alertas_quejas();'
    );
  END IF;
END;
$$;

-- 5) Seed idempotente de estados de queja --------------------------
-- Agrega los 5 estados del flujo si faltan; NO borra otros estados.
INSERT INTO catalogos (tipo, valor, color, orden, activo, modulo)
SELECT 'estado_queja', v.valor, v.color, v.orden, true, 'quejas'
FROM (VALUES
  ('Recibido',       'blue',  1),
  ('No Procede',     'red',   2),
  ('En Investigación','amber',3),
  ('Resuelto',       'green', 4),
  ('Finalizado',     'gray',  5)
) AS v(valor, color, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogos c
  WHERE c.tipo = 'estado_queja' AND c.valor = v.valor
);

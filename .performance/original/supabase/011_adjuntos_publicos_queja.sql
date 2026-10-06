-- ============================================================
-- 011_adjuntos_publicos_queja.sql  (v4 — dual-write nombre + url legacy)
--
-- Adjuntos de evidencias desde el formulario público /q/[token].
--
-- HALLAZGOS DE CAMPO:
--   * v2: la tabla REAL difiere del 007 del repo (42703 sobre "nombre").
--   * v3: columna legacy "nombre_archivo" NOT NULL sin default (23502).
--   * v4: columna legacy "url_archivo" NOT NULL sin default (23502).
--
-- Estrategia v4:
--   1. Garantiza columnas estándar + legadas en ambos mundos
--      (ADD COLUMN IF NOT EXISTS) y flexibiliza url_archivo
--      (DROP NOT NULL solo si existe).
--   2. Avisa por NOTICE/WARNING si quedan columnas NOT NULL sin
--      default desconocidas.
--   3. registrar_adjunto_queja_publica: RETURNS uuid, INSERT explícito,
--      p_nombre → nombre + nombre_archivo, p_storage_path →
--      storage_path + url_archivo. Valida estado «Recibido», tope 10.
--   4. registrar_adjunto_queja (interno, 007): misma alineación dual,
--      conserva staff/responsable + logs y RETURNS fila completa.
--
-- El frontend /q/[token] ya envía { p_queja_id, p_nombre, p_storage_path,
-- p_tamano, p_tipo_mime }: la firma NO cambia.
--
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Esquema: garantiza columnas estándar + legacy en ambos mundos
-- ------------------------------------------------------------
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS nombre         text NOT NULL DEFAULT '';
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS nombre_archivo text NOT NULL DEFAULT '';
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS storage_path   text NOT NULL DEFAULT '';
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS url_archivo    text NOT NULL DEFAULT '';

-- Flexibiliza la columna heredada (idempotente y solo si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queja_adjuntos' AND column_name = 'url_archivo'
  ) THEN
    ALTER TABLE public.queja_adjuntos ALTER COLUMN url_archivo DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS tamano         bigint NOT NULL DEFAULT 0;
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS tipo_mime      text NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS usuario_id     uuid REFERENCES public.usuarios(id);
ALTER TABLE public.queja_adjuntos ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now();

-- RLS idempotente (igual que 007)
ALTER TABLE public.queja_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queja_adjuntos_staff_select" ON public.queja_adjuntos;
CREATE POLICY "queja_adjuntos_staff_select" ON public.queja_adjuntos
  FOR SELECT TO authenticated USING (public.app_es_staff());

DROP POLICY IF EXISTS "queja_adjuntos_colaborador_propias" ON public.queja_adjuntos;
CREATE POLICY "queja_adjuntos_colaborador_propias" ON public.queja_adjuntos
  FOR SELECT TO authenticated
  USING (
    public.app_es_colaborador()
    AND EXISTS (
      SELECT 1 FROM public.quejas q
      WHERE q.id = queja_id AND q.responsable_id = public.app_usuario_actual_id()
    )
  );

-- Diagnóstico: ¿quedan columnas NOT NULL sin default fuera del manejo estándar?
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queja_adjuntos'
      AND is_nullable = 'NO'
      AND column_default IS NULL
      AND column_name NOT IN ('id', 'queja_id', 'nombre', 'nombre_archivo', 'storage_path', 'url_archivo', 'tamano', 'tipo_mime')
  LOOP
    RAISE WARNING '[queja_adjuntos] Columna NOT NULL sin default NO manejada: "%". Si un INSERT futuro falla con 23502, mapearla o darle DEFAULT.', r.column_name;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2) RPC público: registrar_adjunto_queja_publica → RETURNS uuid
--    (cambia el tipo de retorno: requiere DROP previo)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_adjunto_queja_publica(uuid, text, text, bigint, text);

CREATE FUNCTION public.registrar_adjunto_queja_publica(
  p_queja_id uuid,
  p_nombre text,
  p_storage_path text,
  p_tamano bigint DEFAULT NULL,
  p_tipo_mime text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjunto_id uuid;
  v_estado     text;
BEGIN
  IF btrim(COALESCE(p_nombre, '')) = '' OR btrim(COALESCE(p_storage_path, '')) = '' THEN
    RAISE EXCEPTION 'Nombre y ruta del adjunto son obligatorios';
  END IF;

  SELECT estado INTO v_estado FROM public.quejas WHERE id = p_queja_id;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Queja no encontrada';
  END IF;
  IF v_estado <> 'Recibido' THEN
    RAISE EXCEPTION 'Solo se pueden adjuntar evidencias mientras la queja está en estado «Recibido»';
  END IF;

  IF (SELECT count(*) FROM public.queja_adjuntos WHERE queja_id = p_queja_id) >= 10 THEN
    RAISE EXCEPTION 'Límite de 10 evidencias por queja alcanzado';
  END IF;

  -- Mapeo explícito: p_nombre alimenta ambas columnas de nombre
  -- (legacy nombre_archivo NOT NULL + estándar nombre) y p_storage_path
  -- alimenta storage_path + url_archivo legacy
  INSERT INTO public.queja_adjuntos (
    queja_id,
    nombre,
    nombre_archivo,
    storage_path,
    url_archivo,
    tamano,
    tipo_mime,
    usuario_id,
    created_at
  ) VALUES (
    p_queja_id,
    btrim(p_nombre),
    btrim(p_nombre),
    btrim(p_storage_path),
    btrim(p_storage_path),
    COALESCE(p_tamano, 0),
    COALESCE(nullif(btrim(COALESCE(p_tipo_mime, '')), ''), 'application/octet-stream'),
    NULL,
    now()
  )
  RETURNING id INTO v_adjunto_id;

  RETURN v_adjunto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_adjunto_queja_publica(uuid, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_adjunto_queja_publica(uuid, text, text, bigint, text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) RPC interno: registrar_adjunto_queja (007) alineado a la tabla real
--    (misma firma; escribe logs como el original)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_adjunto_queja(uuid, text, text, bigint, text);

CREATE FUNCTION public.registrar_adjunto_queja(
  p_queja_id uuid,
  p_nombre text,
  p_storage_path text,
  p_tamano bigint DEFAULT 0,
  p_tipo_mime text DEFAULT 'application/octet-stream'
)
RETURNS public.queja_adjuntos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjunto   public.queja_adjuntos;
  v_usuario_id uuid;
BEGIN
  v_usuario_id := public.app_usuario_actual_id();
  IF v_usuario_id IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;

  IF NOT public.app_es_staff() AND NOT (
    public.app_es_colaborador()
    AND EXISTS (
      SELECT 1 FROM public.quejas q
      WHERE q.id = p_queja_id AND q.responsable_id = v_usuario_id
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF btrim(COALESCE(p_nombre, '')) = '' OR btrim(COALESCE(p_storage_path, '')) = '' THEN
    RAISE EXCEPTION 'Nombre y ruta del adjunto son obligatorios';
  END IF;

  INSERT INTO public.queja_adjuntos (
    queja_id,
    nombre,
    nombre_archivo,
    storage_path,
    url_archivo,
    tamano,
    tipo_mime,
    usuario_id,
    created_at
  ) VALUES (
    p_queja_id,
    btrim(p_nombre),
    btrim(p_nombre),
    btrim(p_storage_path),
    btrim(p_storage_path),
    COALESCE(p_tamano, 0),
    COALESCE(nullif(btrim(COALESCE(p_tipo_mime, '')), ''), 'application/octet-stream'),
    v_usuario_id,
    now()
  )
  RETURNING * INTO v_adjunto;

  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), v_usuario_id, 'adjunto', 'quejas',
    'Adjunto "' || v_adjunto.nombre || '" agregado a la queja ' || p_queja_id);

  RETURN v_adjunto;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_adjunto_queja(uuid, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_adjunto_queja(uuid, text, text, bigint, text) TO authenticated;

-- ECA-QMS: atributos del registro de GC y consecutivo anual de Quejas.
-- Ejecutar una sola vez en Supabase SQL Editor ANTES de publicar el frontend nuevo.
-- No renombra folios ni carpetas Drive existentes: los adjuntos guardan IDs de archivo.
BEGIN;

ALTER TABLE public.quejas
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS area_afectada text,
  ADD COLUMN IF NOT EXISTS fecha_recepcion_gc date,
  ADD COLUMN IF NOT EXISTS numero_oficio_resolucion text,
  ADD COLUMN IF NOT EXISTS observaciones text;

COMMENT ON COLUMN public.quejas.tipo IS 'Tipo del registro: Queja, Observación, Sugerencia, etc.; distinto de categoria (clasificación interna).';
COMMENT ON COLUMN public.quejas.fecha_recepcion_gc IS 'Fecha local en que Gestión de Calidad recibió el caso; fecha conserva la creación exacta.';
COMMENT ON COLUMN public.quejas.numero_oficio_resolucion IS 'Número del oficio de resolución; se completa durante la gestión interna.';
COMMENT ON COLUMN public.quejas.observaciones IS 'Observaciones internas del registro; no se capturan en el formulario público.';

-- Recuperar valores seguros de registros previos sin inventar áreas u oficios.
UPDATE public.quejas
SET tipo = CASE
    WHEN categoria IN ('Queja', 'Observación', 'Sugerencia', 'Denuncia', 'Reclamo', 'Felicitación') THEN categoria
    ELSE 'Queja'
  END
WHERE tipo IS NULL;

UPDATE public.quejas
SET fecha_recepcion_gc = (fecha AT TIME ZONE 'America/Costa_Rica')::date
WHERE fecha_recepcion_gc IS NULL AND fecha IS NOT NULL;

-- Una fila por año: el UPSERT bloquea solo ese contador y evita duplicados
-- incluso cuando varias personas envían formularios al mismo tiempo.
CREATE TABLE IF NOT EXISTS public.folios_quejas_anuales (
  anio integer PRIMARY KEY,
  ultimo integer NOT NULL CHECK (ultimo >= 0)
);
ALTER TABLE public.folios_quejas_anuales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folios_quejas_anuales FROM PUBLIC, anon, authenticated;

-- Continuar después del máximo almacenado, tanto del formato viejo como del nuevo.
WITH existentes AS (
  SELECT regexp_match(folio, '^(?:QUEJA-)?([0-9]{4})-([0-9]+)$') AS partes
  FROM public.quejas
)
INSERT INTO public.folios_quejas_anuales (anio, ultimo)
SELECT partes[1]::integer, max(partes[2]::integer)
FROM existentes
WHERE partes IS NOT NULL
GROUP BY partes[1]::integer
ON CONFLICT (anio) DO UPDATE
SET ultimo = greatest(public.folios_quejas_anuales.ultimo, EXCLUDED.ultimo);

-- Mínimos visibles en el Excel compartido. Si el archivo completo tiene un
-- consecutivo mayor aún no migrado, reemplazar estos valores por el máximo real.
INSERT INTO public.folios_quejas_anuales (anio, ultimo)
VALUES (2025, 16), (2026, 3)
ON CONFLICT (anio) DO UPDATE
SET ultimo = greatest(public.folios_quejas_anuales.ultimo, EXCLUDED.ultimo);

CREATE OR REPLACE FUNCTION public.generar_folio_queja()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_anio integer := extract(year FROM timezone('America/Costa_Rica', now()))::integer;
  v_ultimo integer;
BEGIN
  INSERT INTO public.folios_quejas_anuales (anio, ultimo)
  VALUES (v_anio, 1)
  ON CONFLICT (anio) DO UPDATE
  SET ultimo = public.folios_quejas_anuales.ultimo + 1
  RETURNING ultimo INTO v_ultimo;

  -- A partir de 1000 no truncar el número a tres caracteres.
  RETURN v_anio::text || '-' || CASE
    WHEN length(v_ultimo::text) >= 3 THEN v_ultimo::text
    ELSE lpad(v_ultimo::text, 3, '0')
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.generar_folio_queja() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_folio_queja() TO authenticated;

-- RPC pública nueva sin sobrecargar la firma anterior (PostgREST no tolera
-- bien los overloads). La fecha de recepción la fija el servidor en Costa Rica.
CREATE OR REPLACE FUNCTION public.crear_queja_publica_con_atributos(
  p_token text,
  p_cliente_nombre text,
  p_email_cliente text,
  p_telefono text,
  p_tipo text,
  p_descripcion text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_folio text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.formularios_publicos
    WHERE token = p_token AND activo = true AND modulo = 'quejas'
  ) THEN
    RAISE EXCEPTION 'El enlace no es válido o ya no está disponible';
  END IF;
  IF btrim(coalesce(p_cliente_nombre, '')) = ''
     OR btrim(coalesce(p_tipo, '')) = ''
     OR btrim(coalesce(p_descripcion, '')) = '' THEN
    RAISE EXCEPTION 'Nombre, tipo y descripción son obligatorios';
  END IF;
  IF p_tipo NOT IN ('Queja', 'Observación', 'Sugerencia', 'Denuncia', 'Reclamo', 'Felicitación') THEN
    RAISE EXCEPTION 'El tipo de registro no es válido';
  END IF;

  v_folio := public.generar_folio_queja();
  INSERT INTO public.quejas (
    folio, cliente_nombre, email_cliente, telefono, categoria, tipo,
    descripcion, estado, fecha, fecha_recepcion_gc
  ) VALUES (
    v_folio, btrim(p_cliente_nombre), nullif(btrim(p_email_cliente), ''),
    nullif(btrim(p_telefono), ''), btrim(p_tipo), btrim(p_tipo),
    btrim(p_descripcion), 'Recibido', now(),
    timezone('America/Costa_Rica', now())::date
  );
  RETURN v_folio;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.crear_queja_interna_con_atributos(
  p_cliente_nombre text,
  p_email_cliente text,
  p_categoria text,
  p_descripcion text,
  p_prioridad text,
  p_tipo text,
  p_area_afectada text,
  p_fecha_recepcion_gc date,
  p_numero_oficio_resolucion text,
  p_observaciones text
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queja public.quejas;
  v_dias integer;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF btrim(coalesce(p_cliente_nombre, '')) = ''
     OR btrim(coalesce(p_categoria, '')) = ''
     OR btrim(coalesce(p_prioridad, '')) = ''
     OR btrim(coalesce(p_tipo, '')) = ''
     OR btrim(coalesce(p_area_afectada, '')) = '' THEN
    RAISE EXCEPTION 'Nombre, tipo, área afectada, categoría y prioridad son obligatorios';
  END IF;

  SELECT dias_vencimiento INTO v_dias
  FROM public.sla_config
  WHERE proceso = 'quejas' AND prioridad = btrim(p_prioridad)
  LIMIT 1;

  INSERT INTO public.quejas (
    folio, cliente_nombre, email_cliente, categoria, descripcion,
    prioridad, estado, fecha, fecha_sla, tipo, area_afectada,
    fecha_recepcion_gc, numero_oficio_resolucion, observaciones
  ) VALUES (
    public.generar_folio_queja(), btrim(p_cliente_nombre),
    nullif(btrim(p_email_cliente), ''), btrim(p_categoria),
    nullif(btrim(p_descripcion), ''), btrim(p_prioridad),
    'Recibido', now(), now() + make_interval(days => coalesce(v_dias, 7)),
    btrim(p_tipo), btrim(p_area_afectada),
    coalesce(p_fecha_recepcion_gc, timezone('America/Costa_Rica', now())::date),
    nullif(btrim(p_numero_oficio_resolucion), ''),
    nullif(btrim(p_observaciones), '')
  ) RETURNING * INTO v_queja;

  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), public.app_usuario_actual_id(), 'crear', 'quejas',
    'Queja interna ' || v_queja.folio || ' creada');
  RETURN v_queja;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_queja_interna_con_atributos(text,text,text,text,text,text,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_queja_interna_con_atributos(text,text,text,text,text,text,text,date,text,text) TO authenticated;

-- Solo GC/admin pueden corregir los atributos del registro. El oficio y las
-- observaciones se pueden completar después de crear la queja.
CREATE OR REPLACE FUNCTION public.actualizar_atributos_queja(
  p_queja_id uuid,
  p_tipo text,
  p_area_afectada text,
  p_fecha_recepcion_gc date,
  p_numero_oficio_resolucion text,
  p_observaciones text
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queja public.quejas;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF btrim(coalesce(p_tipo, '')) = '' OR btrim(coalesce(p_area_afectada, '')) = '' THEN
    RAISE EXCEPTION 'Tipo y área afectada son obligatorios';
  END IF;

  UPDATE public.quejas SET
    tipo = btrim(p_tipo),
    area_afectada = btrim(p_area_afectada),
    fecha_recepcion_gc = p_fecha_recepcion_gc,
    numero_oficio_resolucion = nullif(btrim(p_numero_oficio_resolucion), ''),
    observaciones = nullif(btrim(p_observaciones), '')
  WHERE id = p_queja_id
  RETURNING * INTO v_queja;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;

  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), public.app_usuario_actual_id(), 'actualizar', 'quejas',
    'Atributos del registro ' || v_queja.folio || ' actualizados');
  RETURN v_queja;
END;
$$;
REVOKE ALL ON FUNCTION public.actualizar_atributos_queja(uuid,text,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_atributos_queja(uuid,text,text,date,text,text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

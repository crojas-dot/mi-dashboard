-- ============================================================
-- 007_quejas_adjuntos_y_reapertura.sql
-- Adjuntos de quejas (tabla + RPC + bucket de storage) y
-- reapertura de quejas (RPC reabrir_queja).
-- REQUIERE: aplicar primero 006_permisos_dinamicos_colaborador.sql
-- (usa public.app_es_colaborador). Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla queja_adjuntos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queja_adjuntos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queja_id     uuid NOT NULL REFERENCES public.quejas(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  storage_path text NOT NULL,
  tamano       bigint NOT NULL DEFAULT 0,
  tipo_mime    text NOT NULL DEFAULT 'application/octet-stream',
  usuario_id   uuid REFERENCES public.usuarios(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queja_adjuntos ENABLE ROW LEVEL SECURITY;

-- Lectura: staff ve todo; colaborador solo quejas donde es responsable.
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

-- Los INSERT pasan solo por el RPC registrar_adjunto_queja (sin política de INSERT).

-- ------------------------------------------------------------
-- 2) RPC registrar_adjunto_queja
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_adjunto_queja(
  p_queja_id uuid,
  p_nombre text,
  p_storage_path text,
  p_tamano bigint,
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

  INSERT INTO public.queja_adjuntos (queja_id, nombre, storage_path, tamano, tipo_mime, usuario_id, created_at)
  VALUES (
    p_queja_id,
    btrim(p_nombre),
    btrim(p_storage_path),
    COALESCE(p_tamano, 0),
    COALESCE(nullif(btrim(p_tipo_mime), ''), 'application/octet-stream'),
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

-- ------------------------------------------------------------
-- 3) RPC reabrir_queja (staff: Resuelto/Finalizado → En Investigación)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reabrir_queja(
  p_queja_id uuid,
  p_motivo text
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja     public.quejas;
  v_usuario_id uuid;
  v_destino   record;
  v_mensaje   text;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'El motivo de reapertura es obligatorio';
  END IF;

  v_usuario_id := public.app_usuario_actual_id();
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;
  IF v_queja.estado NOT IN ('Resuelto', 'Finalizado') THEN
    RAISE EXCEPTION 'Solo se puede reabrir una queja resuelta o finalizada';
  END IF;

  UPDATE public.quejas
  SET estado = 'En Investigación',
      fecha_limite_investigacion = now() + interval '15 days',
      resolucion = NULL,
      notas = COALESCE(notas, '') || E'\n[Reapertura] ' || btrim(p_motivo)
  WHERE id = p_queja_id
  RETURNING * INTO v_queja;

  v_mensaje := 'La queja ' || v_queja.folio || ' fue reabierta y vuelve a investigación.';
  FOR v_destino IN
    SELECT id FROM public.usuarios
    WHERE (id = v_queja.responsable_id OR rol IN ('admin', 'calidad'))
      AND estado = 'activo'
      AND id IS DISTINCT FROM v_usuario_id
  LOOP
    INSERT INTO public.notificaciones (usuario_id, fecha, tipo, mensaje, enlace, origen_id)
    VALUES (v_destino.id, now(), 'queja_estado', v_mensaje, '/quejas', v_queja.id);
  END LOOP;

  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), v_usuario_id, 'reapertura', 'quejas',
    v_mensaje || ' Motivo: ' || btrim(p_motivo));

  RETURN v_queja;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_adjunto_queja(uuid, text, text, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reabrir_queja(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_adjunto_queja(uuid, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_queja(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 4) Bucket de storage para adjuntos (privado) + políticas
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('quejas-adjuntos', 'quejas-adjuntos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "quejas_adjuntos_storage_select" ON storage.objects;
CREATE POLICY "quejas_adjuntos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quejas-adjuntos');

DROP POLICY IF EXISTS "quejas_adjuntos_storage_insert" ON storage.objects;
CREATE POLICY "quejas_adjuntos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quejas-adjuntos');
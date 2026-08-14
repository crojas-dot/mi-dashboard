-- ============================================================
-- 006_permisos_dinamicos_colaborador.sql
-- Motor de permisos dinámico (permisos: rol+modulo, leer/escribir),
-- rol colaborador (Mis Quejas), actividad de quejas y máquina de
-- estados con "Pendiente de Revisión GC".
-- Aplicar después de 001-005. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla permisos (nueva forma: PK rol+modulo, leer/escribir)
--    Reemplaza la antigua (rol, modulo, accion, permitido).
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.permisos CASCADE;

CREATE TABLE public.permisos (
  rol      text NOT NULL,
  modulo   text NOT NULL,
  leer     boolean NOT NULL DEFAULT false,
  escribir boolean NOT NULL DEFAULT false,
  PRIMARY KEY (rol, modulo)
);

ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permisos_staff_select" ON public.permisos;
DROP POLICY IF EXISTS "permisos_admin_write" ON public.permisos;
CREATE POLICY "permisos_staff_select" ON public.permisos
  FOR SELECT TO authenticated USING (public.app_es_staff());
CREATE POLICY "permisos_admin_write" ON public.permisos
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

-- ------------------------------------------------------------
-- 2) Helpers de rol y permisos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_es_colaborador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_id = auth.uid()
      AND estado = 'activo'
      AND rol = 'colaborador'
  );
$$;

-- Consulta el motor de permisos para el rol del usuario actual.
CREATE OR REPLACE FUNCTION public.app_tiene_permiso(
  p_modulo text,
  p_requiere_escribir boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.permisos p
    JOIN public.usuarios u ON u.rol = p.rol
    WHERE u.auth_id = auth.uid()
      AND u.estado = 'activo'
      AND p.modulo = p_modulo
      AND p.leer = true
      AND (NOT p_requiere_escribir OR p.escribir = true)
  );
$$;

-- Permisos del usuario actual (para el cliente, evita RLS).
CREATE OR REPLACE FUNCTION public.app_mis_permisos()
RETURNS SETOF public.permisos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.rol, p.modulo, p.leer, p.escribir
  FROM public.permisos p
  JOIN public.usuarios u ON u.rol = p.rol
  WHERE u.auth_id = auth.uid() AND u.estado = 'activo';
$$;

REVOKE ALL ON FUNCTION public.app_es_colaborador() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tiene_permiso(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_mis_permisos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_es_colaborador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_tiene_permiso(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_mis_permisos() TO authenticated;

-- ------------------------------------------------------------
-- 3) Matriz de permisos por rol
-- ------------------------------------------------------------
INSERT INTO public.permisos (rol, modulo, leer, escribir) VALUES
  -- admin: acceso total
  ('admin',       'dashboard',     true,  true),
  ('admin',       'quejas',        true,  true),
  ('admin',       'mis_quejas',    true,  true),
  ('admin',       'documentos',    true,  true),
  ('admin',       'sacp',          true,  true),
  ('admin',       'riesgos',       true,  true),
  ('admin',       'auditorias',    true,  true),
  ('admin',       'revision',      true,  true),
  ('admin',       'procesos',      true,  true),
  ('admin',       'usuarios',      true,  true),
  ('admin',       'configuracion', true,  true),
  ('admin',       'reporteria',    true,  true),
  -- calidad: todo excepto administración
  ('calidad',     'dashboard',     true,  true),
  ('calidad',     'quejas',        true,  true),
  ('calidad',     'mis_quejas',    true,  true),
  ('calidad',     'documentos',    true,  true),
  ('calidad',     'sacp',          true,  true),
  ('calidad',     'riesgos',       true,  true),
  ('calidad',     'auditorias',    true,  true),
  ('calidad',     'revision',      true,  true),
  ('calidad',     'procesos',      true,  true),
  ('calidad',     'usuarios',      false, false),
  ('calidad',     'configuracion', false, false),
  ('calidad',     'reporteria',    true,  true),
  -- colaborador: solo sus quejas asignadas
  ('colaborador', 'dashboard',     false, false),
  ('colaborador', 'quejas',        false, false),
  ('colaborador', 'mis_quejas',    true,  true),
  ('colaborador', 'documentos',    false, false),
  ('colaborador', 'sacp',          false, false),
  ('colaborador', 'riesgos',       false, false),
  ('colaborador', 'auditorias',    false, false),
  ('colaborador', 'revision',      false, false),
  ('colaborador', 'procesos',      false, false),
  ('colaborador', 'usuarios',      false, false),
  ('colaborador', 'configuracion', false, false),
  ('colaborador', 'reporteria',    false, false)
ON CONFLICT (rol, modulo) DO UPDATE
  SET leer = EXCLUDED.leer, escribir = EXCLUDED.escribir;

-- ------------------------------------------------------------
-- 4) quejas_actividad (seguimiento del procesamiento del colaborador)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quejas_actividad (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queja_id    uuid NOT NULL REFERENCES public.quejas(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'nota',
  descripcion text NOT NULL,
  usuario_id  uuid REFERENCES public.usuarios(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quejas_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quejas_actividad_select_own" ON public.quejas_actividad;
DROP POLICY IF EXISTS "quejas_actividad_insert_own" ON public.quejas_actividad;
CREATE POLICY "quejas_actividad_select_own" ON public.quejas_actividad
  FOR SELECT TO authenticated
  USING (
    public.app_tiene_permiso('quejas', false)
    OR (
      public.app_tiene_permiso('mis_quejas', false)
      AND EXISTS (
        SELECT 1 FROM public.quejas q
        WHERE q.id = queja_id AND q.responsable_id = public.app_usuario_actual_id()
      )
    )
  );
CREATE POLICY "quejas_actividad_insert_own" ON public.quejas_actividad
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_tiene_permiso('quejas', true)
    OR (
      public.app_tiene_permiso('mis_quejas', true)
      AND EXISTS (
        SELECT 1 FROM public.quejas q
        WHERE q.id = queja_id AND q.responsable_id = public.app_usuario_actual_id()
      )
    )
  );

-- ------------------------------------------------------------
-- 5) RLS para que el colaborador lea solo SUS quejas y comentarios
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "quejas_colaborador_propias" ON public.quejas;
CREATE POLICY "quejas_colaborador_propias" ON public.quejas
  FOR SELECT TO authenticated
  USING (
    public.app_es_colaborador()
    AND public.app_tiene_permiso('mis_quejas', false)
    AND responsable_id = public.app_usuario_actual_id()
  );

DROP POLICY IF EXISTS "quejas_comentarios_colaborador_propias" ON public.quejas_comentarios;
CREATE POLICY "quejas_comentarios_colaborador_propias" ON public.quejas_comentarios
  FOR SELECT TO authenticated
  USING (
    public.app_es_colaborador()
    AND public.app_tiene_permiso('mis_quejas', false)
    AND EXISTS (
      SELECT 1 FROM public.quejas q
      WHERE q.id = queja_id AND q.responsable_id = public.app_usuario_actual_id()
    )
  );

-- ------------------------------------------------------------
-- 6) Máquina de estados con "Pendiente de Revisión GC"
--    Conserva FOR UPDATE, notificaciones, logs y retorno public.quejas.
--    Colaborador: solo sobre quejas donde es responsable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transicionar_queja(
  p_queja_id uuid,
  p_nuevo_estado text,
  p_resolucion text DEFAULT NULL
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja          public.quejas;
  v_usuario_id     uuid;
  v_es_staff       boolean;
  v_es_responsable boolean;
  v_destino        record;
  v_mensaje        text;
BEGIN
  v_usuario_id := public.app_usuario_actual_id();
  IF v_usuario_id IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;

  v_es_staff := public.app_es_staff();
  v_es_responsable := (v_queja.responsable_id = v_usuario_id);
  IF NOT (v_es_staff OR (public.app_es_colaborador() AND v_es_responsable)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'En Investigación' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_limite_investigacion = now() + interval '15 days'
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'No Procede' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede marcar como No Procede'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion), fecha_cierre = now()
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'En Investigación' AND p_nuevo_estado = 'Pendiente de Revisión GC' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion)
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'En Investigación' AND p_nuevo_estado = 'Resuelto' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede resolver directamente'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion)
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Pendiente de Revisión GC' AND p_nuevo_estado = 'Resuelto' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede aprobar la resolución'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_cierre = COALESCE(fecha_cierre, now())
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Pendiente de Revisión GC' AND p_nuevo_estado = 'En Investigación' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede devolver la queja'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = NULL
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Resuelto' AND p_nuevo_estado = 'Finalizado' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede finalizar la queja'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_cierre = COALESCE(fecha_cierre, now())
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSE
    RAISE EXCEPTION 'Transición no permitida: % → %', v_queja.estado, p_nuevo_estado;
  END IF;

  v_mensaje := 'La queja ' || v_queja.folio || ' cambió a ' || v_queja.estado || '.';
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
  VALUES (now(), v_usuario_id, 'transición', 'quejas', v_mensaje);
  RETURN v_queja;
END;
$$;

REVOKE ALL ON FUNCTION public.transicionar_queja(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicionar_queja(uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 7) Catálogo: nuevo estado de queja
-- ------------------------------------------------------------
INSERT INTO public.catalogos (tipo, valor, color, orden, activo, modulo)
SELECT 'estado_queja', 'Pendiente de Revisión GC', 'purple', 5, true, 'quejas'
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogos
  WHERE tipo = 'estado_queja' AND valor = 'Pendiente de Revisión GC'
);
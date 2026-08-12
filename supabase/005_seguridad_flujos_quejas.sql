-- ============================================================
-- 005_seguridad_flujos_quejas.sql
-- Refuerza roles, configuraciones y el flujo transaccional de quejas.
-- Aplicar después de 001-004.
-- ============================================================

-- Helpers con SECURITY DEFINER para evitar depender de políticas recursivas
-- sobre public.usuarios.
CREATE OR REPLACE FUNCTION public.app_es_staff()
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
      AND rol IN ('admin', 'calidad')
  );
$$;

CREATE OR REPLACE FUNCTION public.app_es_admin()
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
      AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_usuario_actual_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.app_es_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_es_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_usuario_actual_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_es_staff(), public.app_es_admin(), public.app_usuario_actual_id() TO authenticated;

-- Los catálogos públicos quedan limitados a los valores activos requeridos por
-- el formulario de quejas. El resto de la configuración sólo se expone al staff.
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuraciones_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogos_anon_public_quejas" ON public.catalogos;
DROP POLICY IF EXISTS "catalogos_staff_select" ON public.catalogos;
DROP POLICY IF EXISTS "catalogos_admin_write" ON public.catalogos;
CREATE POLICY "catalogos_anon_public_quejas" ON public.catalogos
  FOR SELECT TO anon
  USING (modulo = 'quejas' AND tipo = 'categoria_queja' AND (activo IS NULL OR activo = true));
CREATE POLICY "catalogos_staff_select" ON public.catalogos
  FOR SELECT TO authenticated USING (public.app_es_staff());
CREATE POLICY "catalogos_admin_write" ON public.catalogos
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

DROP POLICY IF EXISTS "sla_staff_select" ON public.sla_config;
DROP POLICY IF EXISTS "sla_admin_write" ON public.sla_config;
CREATE POLICY "sla_staff_select" ON public.sla_config
  FOR SELECT TO authenticated USING (public.app_es_staff());
CREATE POLICY "sla_admin_write" ON public.sla_config
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

DROP POLICY IF EXISTS "config_admin_only" ON public.configuraciones_sistema;
CREATE POLICY "config_admin_only" ON public.configuraciones_sistema
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

DROP POLICY IF EXISTS "permisos_staff_select" ON public.permisos;
DROP POLICY IF EXISTS "permisos_admin_write" ON public.permisos;
CREATE POLICY "permisos_staff_select" ON public.permisos
  FOR SELECT TO authenticated USING (public.app_es_staff());
CREATE POLICY "permisos_admin_write" ON public.permisos
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

-- La administración de enlaces públicos es exclusiva de administradores.
DROP POLICY IF EXISTS "formularios_publicos_auth_all" ON public.formularios_publicos;
DROP POLICY IF EXISTS "formularios_publicos_admin_all" ON public.formularios_publicos;
CREATE POLICY "formularios_publicos_admin_all" ON public.formularios_publicos
  FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());

-- Corrige el vínculo con auth.users para cualquier actualización propia que
-- permanezca fuera de las RPC de preferencias.
DROP POLICY IF EXISTS "authenticated_update_own_usuario" ON public.usuarios;
DROP POLICY IF EXISTS "authenticated_update_own_usuario_auth" ON public.usuarios;
CREATE POLICY "authenticated_update_own_usuario_auth" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);

-- Las notificaciones son privadas por destinatario.
DROP POLICY IF EXISTS "authenticated_all_notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_select_propias" ON public.notificaciones;
DROP POLICY IF EXISTS "notificaciones_update_propias" ON public.notificaciones;
CREATE POLICY "notificaciones_select_propias" ON public.notificaciones
  FOR SELECT TO authenticated USING (usuario_id = public.app_usuario_actual_id());
CREATE POLICY "notificaciones_update_propias" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = public.app_usuario_actual_id())
  WITH CHECK (usuario_id = public.app_usuario_actual_id());

-- Las quejas y sus comentarios se consultan por staff; las mutaciones pasan
-- por funciones que bloquean el registro y validan cada transición.
DROP POLICY IF EXISTS "authenticated_all_quejas" ON public.quejas;
DROP POLICY IF EXISTS "quejas_staff_select" ON public.quejas;
CREATE POLICY "quejas_staff_select" ON public.quejas
  FOR SELECT TO authenticated USING (public.app_es_staff());

DROP POLICY IF EXISTS "authenticated_all_quejas_comentarios" ON public.quejas_comentarios;
DROP POLICY IF EXISTS "quejas_comentarios_staff_select" ON public.quejas_comentarios;
CREATE POLICY "quejas_comentarios_staff_select" ON public.quejas_comentarios
  FOR SELECT TO authenticated USING (public.app_es_staff());

-- Backfill de SLA para expedientes anteriores. Se mantiene la fecha original
-- del expediente para no reiniciar plazos al aplicar esta migración.
UPDATE public.quejas q
SET fecha_sla = COALESCE(q.fecha, now()) + make_interval(days => COALESCE((
  SELECT s.dias_vencimiento
  FROM public.sla_config s
  WHERE s.proceso = 'quejas' AND s.prioridad = q.prioridad
  LIMIT 1
), 7))
WHERE q.fecha_sla IS NULL;

CREATE OR REPLACE FUNCTION public.crear_queja_interna(
  p_cliente_nombre text,
  p_email_cliente text,
  p_categoria text,
  p_descripcion text,
  p_prioridad text
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja public.quejas;
  v_dias integer;
BEGIN
  IF NOT public.app_es_staff() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF btrim(COALESCE(p_cliente_nombre, '')) = '' OR btrim(COALESCE(p_categoria, '')) = '' OR btrim(COALESCE(p_prioridad, '')) = '' THEN
    RAISE EXCEPTION 'Cliente, categoría y prioridad son obligatorios';
  END IF;

  SELECT dias_vencimiento INTO v_dias
  FROM public.sla_config
  WHERE proceso = 'quejas' AND prioridad = btrim(p_prioridad)
  LIMIT 1;

  INSERT INTO public.quejas (
    folio, cliente_nombre, email_cliente, categoria, descripcion,
    prioridad, estado, fecha, fecha_sla
  ) VALUES (
    public.generar_folio_queja(), btrim(p_cliente_nombre), nullif(btrim(p_email_cliente), ''),
    btrim(p_categoria), nullif(btrim(p_descripcion), ''), btrim(p_prioridad),
    'Recibido', now(), now() + make_interval(days => COALESCE(v_dias, 7))
  ) RETURNING * INTO v_queja;

  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), public.app_usuario_actual_id(), 'crear', 'quejas', 'Queja interna ' || v_queja.folio || ' creada');

  RETURN v_queja;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_detalles_queja(
  p_queja_id uuid,
  p_categoria text DEFAULT NULL,
  p_prioridad text DEFAULT NULL,
  p_responsable_id uuid DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS public.quejas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja public.quejas;
  v_dias integer;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;

  IF p_prioridad IS NOT NULL THEN
    SELECT dias_vencimiento INTO v_dias
    FROM public.sla_config WHERE proceso = 'quejas' AND prioridad = btrim(p_prioridad) LIMIT 1;
  END IF;

  UPDATE public.quejas
  SET categoria = COALESCE(nullif(btrim(p_categoria), ''), categoria),
      prioridad = COALESCE(nullif(btrim(p_prioridad), ''), prioridad),
      responsable_id = COALESCE(p_responsable_id, responsable_id),
      notas = COALESCE(p_notas, notas),
      fecha_sla = CASE WHEN p_prioridad IS NULL THEN fecha_sla
        ELSE COALESCE(fecha, now()) + make_interval(days => COALESCE(v_dias, 7)) END
  WHERE id = p_queja_id
  RETURNING * INTO v_queja;

  RETURN v_queja;
END;
$$;

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
  v_queja public.quejas;
  v_usuario_id uuid;
  v_destino record;
  v_mensaje text;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  v_usuario_id := public.app_usuario_actual_id();
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;

  IF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'En Investigación' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_limite_investigacion = now() + interval '15 days'
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'No Procede' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion), fecha_cierre = now()
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'En Investigación' AND p_nuevo_estado = 'Resuelto' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion)
    WHERE id = p_queja_id RETURNING * INTO v_queja;
  ELSIF v_queja.estado = 'Resuelto' AND p_nuevo_estado = 'Finalizado' THEN
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

CREATE OR REPLACE FUNCTION public.derivar_queja_a_sacp(p_queja_id uuid)
RETURNS public.acciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queja public.quejas;
  v_accion public.acciones;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;
  IF v_queja.estado NOT IN ('En Investigación', 'Resuelto') THEN
    RAISE EXCEPTION 'Sólo se puede derivar una queja en investigación o resuelta';
  END IF;
  IF v_queja.derivado_sacp_id IS NOT NULL THEN
    SELECT * INTO v_accion FROM public.acciones WHERE id = v_queja.derivado_sacp_id;
    RETURN v_accion;
  END IF;

  INSERT INTO public.acciones (
    folio, tipo, origen, origen_id, descripcion, estado,
    seguimiento_porcentaje, fecha_apertura
  ) VALUES (
    public.generar_folio_sacp(), 'Correctiva', 'queja', v_queja.id,
    COALESCE(v_queja.descripcion, v_queja.cliente_nombre), 'Abierta', 0, now()
  ) RETURNING * INTO v_accion;

  UPDATE public.quejas SET derivado_sacp_id = v_accion.id WHERE id = v_queja.id;
  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), public.app_usuario_actual_id(), 'derivar', 'quejas', 'Queja ' || v_queja.folio || ' derivada a ' || v_accion.folio);
  RETURN v_accion;
END;
$$;

CREATE OR REPLACE FUNCTION public.agregar_comentario_queja(
  p_queja_id uuid,
  p_comentario text,
  p_tipo text DEFAULT 'interno',
  p_visible_cliente boolean DEFAULT false
)
RETURNS public.quejas_comentarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comentario public.quejas_comentarios;
  v_queja public.quejas;
  v_usuario_id uuid;
  v_destino record;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF btrim(COALESCE(p_comentario, '')) = '' THEN RAISE EXCEPTION 'El comentario es obligatorio'; END IF;
  IF p_tipo NOT IN ('interno', 'cliente') THEN RAISE EXCEPTION 'Tipo de comentario inválido'; END IF;
  v_usuario_id := public.app_usuario_actual_id();
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;

  INSERT INTO public.quejas_comentarios (queja_id, usuario_id, comentario, tipo, visible_cliente, fecha)
  VALUES (p_queja_id, v_usuario_id, btrim(p_comentario), p_tipo, p_visible_cliente, now())
  RETURNING * INTO v_comentario;

  FOR v_destino IN
    SELECT id FROM public.usuarios
    WHERE (id = v_queja.responsable_id OR rol IN ('admin', 'calidad'))
      AND estado = 'activo'
      AND id IS DISTINCT FROM v_usuario_id
  LOOP
    INSERT INTO public.notificaciones (usuario_id, fecha, tipo, mensaje, enlace, origen_id)
    VALUES (v_destino.id, now(), 'queja_comentario', 'Nuevo comentario en la queja ' || v_queja.folio || '.', '/quejas', v_queja.id);
  END LOOP;

  RETURN v_comentario;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_queja_interna(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_detalles_queja(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transicionar_queja(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.derivar_queja_a_sacp(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agregar_comentario_queja(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_queja_interna(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_detalles_queja(uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transicionar_queja(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agregar_comentario_queja(uuid, text, text, boolean) TO authenticated;

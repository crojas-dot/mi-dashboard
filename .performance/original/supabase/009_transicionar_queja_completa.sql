-- ============================================================
-- 009_transicionar_queja_completa.sql
-- Reemplaza transicionar_queja (6 parámetros) con la implementación
-- COMPLETA: flujo nuevo (Procede/No Procede con justificación y
-- responsable), revisión GC (En Investigación → Pendiente de Revisión
-- GC → Resuelto/En Investigación), cierre y reapertura con motivo.
-- Elimina también el overload viejo de 3 parámetros.
-- REQUIERE: 006 (app_es_colaborador) y 008 aplicadas.
-- Aplicar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

DROP FUNCTION IF EXISTS public.transicionar_queja(uuid, text, text);

DROP FUNCTION IF EXISTS public.transicionar_queja(uuid, text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.transicionar_queja(
  p_queja_id uuid,
  p_nuevo_estado text,
  p_resolucion text DEFAULT NULL,
  p_justificacion_procede text DEFAULT NULL,
  p_responsable_id uuid DEFAULT NULL,
  p_motivo_reapertura text DEFAULT NULL
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

  -- Recibido → En Investigación (staff): asigna responsable si viene, guarda
  -- justificación en notas y arranca el contador de 15 días.
  IF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'En Investigación' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede iniciar la investigación'; END IF;
    UPDATE public.quejas
    SET estado = p_nuevo_estado,
        fecha_limite_investigacion = now() + interval '15 days',
        responsable_id = COALESCE(p_responsable_id, responsable_id),
        notas = CASE WHEN btrim(COALESCE(p_justificacion_procede, '')) <> ''
          THEN COALESCE(notas, '') || E'\n[Procede] ' || btrim(p_justificacion_procede)
          ELSE notas END
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- Recibido → No Procede (staff, exige resolución)
  ELSIF v_queja.estado = 'Recibido' AND p_nuevo_estado = 'No Procede' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede marcar como No Procede'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion), fecha_cierre = now()
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- En Investigación → Pendiente de Revisión GC (staff o colaborador responsable, exige resolución)
  ELSIF v_queja.estado = 'En Investigación' AND p_nuevo_estado = 'Pendiente de Revisión GC' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion)
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- En Investigación → Resuelto (staff, exige resolución)
  ELSIF v_queja.estado = 'En Investigación' AND p_nuevo_estado = 'Resuelto' AND btrim(COALESCE(p_resolucion, '')) <> '' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede resolver directamente'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = btrim(p_resolucion)
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- Pendiente de Revisión GC → Resuelto (staff)
  ELSIF v_queja.estado = 'Pendiente de Revisión GC' AND p_nuevo_estado = 'Resuelto' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede aprobar la resolución'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_cierre = COALESCE(fecha_cierre, now())
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- Pendiente de Revisión GC → En Investigación (staff, devolución)
  ELSIF v_queja.estado = 'Pendiente de Revisión GC' AND p_nuevo_estado = 'En Investigación' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede devolver la queja'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, resolucion = NULL
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- Resuelto → Finalizado (staff, cierre)
  ELSIF v_queja.estado = 'Resuelto' AND p_nuevo_estado = 'Finalizado' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede finalizar la queja'; END IF;
    UPDATE public.quejas SET estado = p_nuevo_estado, fecha_cierre = COALESCE(fecha_cierre, now())
    WHERE id = p_queja_id RETURNING * INTO v_queja;

  -- Resuelto/Finalizado → En Investigación (staff, reapertura con motivo)
  ELSIF v_queja.estado IN ('Resuelto', 'Finalizado') AND p_nuevo_estado = 'En Investigación' AND btrim(COALESCE(p_motivo_reapertura, '')) <> '' THEN
    IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede reabrir la queja'; END IF;
    UPDATE public.quejas
    SET estado = 'En Investigación',
        fecha_limite_investigacion = now() + interval '15 days',
        resolucion = NULL,
        notas = COALESCE(notas, '') || E'\n[Reapertura] ' || btrim(p_motivo_reapertura)
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

REVOKE ALL ON FUNCTION public.transicionar_queja(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicionar_queja(uuid, text, text, text, uuid, text) TO authenticated;
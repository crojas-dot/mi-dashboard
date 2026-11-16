-- Reapertura excepcional: snapshot inmutable del ciclo anterior y un nuevo run del motor SLA.
-- No modifica los contratos de otras transiciones ni los calendarios compartidos.
CREATE TABLE public.queja_reaperturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queja_id uuid NOT NULL REFERENCES public.quejas(id) ON DELETE RESTRICT,
  ciclo integer NOT NULL CHECK (ciclo > 0),
  actor_id uuid NOT NULL REFERENCES public.usuarios(id),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 10000),
  anterior_estado text NOT NULL CHECK (anterior_estado = 'Finalizado'),
  anterior_fecha_cierre timestamptz,
  anterior_fecha_limite timestamptz,
  anterior_responsable_id uuid,
  anterior_resolucion text,
  anterior_resolucion_formato text,
  anterior_numero_oficio text,
  anterior_run_id uuid,
  reapertura_at timestamptz NOT NULL,
  nuevo_inicio timestamptz NOT NULL,
  nueva_fecha_limite timestamptz NOT NULL,
  nuevo_run_id uuid NOT NULL REFERENCES public.qms_stage_runs(id),
  regla_dias integer NOT NULL CHECK (regla_dias = 15),
  regla_tipo text NOT NULL CHECK (regla_tipo = 'business_days'),
  calendario_id bigint NOT NULL,
  UNIQUE (queja_id, ciclo)
);
CREATE INDEX queja_reaperturas_por_queja ON public.queja_reaperturas(queja_id, reapertura_at DESC);
ALTER TABLE public.queja_reaperturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queja_reaperturas FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.queja_reaperturas TO authenticated, service_role;
CREATE POLICY queja_reaperturas_read ON public.queja_reaperturas
 FOR SELECT TO authenticated USING (
   (SELECT auth.uid()) IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.quejas q WHERE q.id = queja_id)
 );

CREATE FUNCTION public.qms_reopen_finalized_complaint(
  p_id uuid, p_expected bigint, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  old_case public.quejas;
  new_case public.quejas;
  previous_run public.qms_stage_runs;
  new_run public.qms_stage_runs;
  current_rule public.qms_stage_versions;
  actor uuid;
  reason text := btrim(coalesce(p_reason, ''));
  cycle_no integer;
  due_local text;
BEGIN
  -- El RPC es el límite de seguridad: no se confía en que React oculte el botón.
  actor := public.app_usuario_actual_id();
  IF auth.uid() IS NULL OR actor IS NULL
    OR NOT (coalesce(public.app_es_admin(), false)
      OR (coalesce(public.app_es_staff(), false)
          AND coalesce(public.app_tiene_permiso('quejas', true), false))) THEN
    RAISE EXCEPTION 'No autorizado para reabrir quejas.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO old_case FROM public.quejas WHERE id = p_id FOR UPDATE;
  IF old_case.id IS NULL THEN
    RAISE EXCEPTION 'Queja no encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF old_case.estado <> 'Finalizado' THEN
    RAISE EXCEPTION 'Solo pueden reabrirse quejas en estado Finalizado.' USING ERRCODE = '22023';
  END IF;
  IF p_expected IS NULL OR old_case.revision IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Otra persona modificó la queja. Actualizá antes de reabrir.' USING ERRCODE = '40001';
  END IF;
  IF length(reason) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'El motivo de reapertura es obligatorio (máximo 10.000 caracteres).' USING ERRCODE = '22023';
  END IF;

  -- Se congela la regla vigente antes de comenzar el run automático del mismo motor.
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('qms.config', 0));
  SELECT * INTO current_rule FROM public.qms_stage_versions
    WHERE stage_id = 'quejas.investigation' ORDER BY id DESC LIMIT 1;
  IF current_rule.id IS NULL OR current_rule.duration <> 15 OR current_rule.day_type <> 'business_days' THEN
    RAISE EXCEPTION 'La regla vigente de investigación debe ser de 15 días hábiles.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO previous_run FROM public.qms_stage_runs
    WHERE case_id = p_id AND stage_id = 'quejas.investigation'
    ORDER BY started_at DESC LIMIT 1;
  SELECT coalesce(max(ciclo), 0) + 1 INTO cycle_no
    FROM public.queja_reaperturas WHERE queja_id = p_id;

  -- qms_sync_queja crea el nuevo run con calendario, feriados y vencimiento reales.
  -- El campo de cierre anterior queda preservado en queja_reaperturas.
  UPDATE public.quejas SET estado = 'En Investigación',
    reabierta = true, motivo_reapertura = reason,
    fecha_cierre = NULL, resolucion = NULL, resolucion_formato = 'plain'
    WHERE id = p_id RETURNING * INTO new_case;

  SELECT * INTO new_run FROM public.qms_stage_runs
    WHERE case_id = p_id AND stage_id = 'quejas.investigation'
      AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
  IF new_run.id IS NULL OR new_run.expires_at IS NULL
    OR new_run.rule_id IS DISTINCT FROM current_rule.id
    OR new_run.expires_at IS DISTINCT FROM new_case.fecha_limite_investigacion THEN
    RAISE EXCEPTION 'No se pudo confirmar el nuevo plazo de reapertura.' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.queja_reaperturas (
    queja_id, ciclo, actor_id, motivo, anterior_estado, anterior_fecha_cierre,
    anterior_fecha_limite, anterior_responsable_id, anterior_resolucion,
    anterior_resolucion_formato, anterior_numero_oficio, anterior_run_id, reapertura_at, nuevo_inicio,
    nueva_fecha_limite, nuevo_run_id, regla_dias, regla_tipo, calendario_id
  ) VALUES (
    p_id, cycle_no, actor, reason, old_case.estado, old_case.fecha_cierre,
    coalesce(old_case.fecha_limite_investigacion, previous_run.expires_at),
    old_case.responsable_id, old_case.resolucion,
    old_case.resolucion_formato, old_case.numero_oficio_resolucion, previous_run.id, now(),
    new_run.started_at, new_run.expires_at, new_run.id, 15, 'business_days', new_run.calendar_id
  );

  due_local := to_char(new_run.expires_at AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY');

  -- El timeline existente usa quejas_actividad; no crea un segundo historial.
  INSERT INTO public.quejas_actividad(queja_id, usuario_id, tipo, descripcion, created_at)
    VALUES (p_id, actor, 'reapertura',
      'REAPERTURA_QUEJA · Ciclo ' || cycle_no ||
      ' · Finalizado → En Investigación · Motivo: ' || reason ||
      ' · Vencimiento anterior: ' ||
      coalesce(to_char(old_case.fecha_limite_investigacion AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY'), 'Sin plazo') ||
      ' · Nuevo vencimiento: ' || due_local, now());

  -- El público del módulo sigue siendo staff y el responsable asignado.
  INSERT INTO public.notificaciones(usuario_id, fecha, tipo, mensaje, enlace, origen_id)
  SELECT u.id, now(), 'queja_estado',
    'La queja ' || new_case.folio || ' fue reabierta. Nuevo plazo: ' || due_local ||
      CASE WHEN u.rol IN ('admin', 'calidad') THEN '. Motivo: ' || left(reason, 300) ELSE '' END,
    CASE WHEN u.rol = 'colaborador' THEN '/mis-quejas' ELSE '/quejas' END, p_id::text
  FROM public.usuarios u
  WHERE u.estado = 'activo' AND u.id IS DISTINCT FROM actor
    AND (u.id = old_case.responsable_id OR u.rol IN ('admin', 'calidad'));

  INSERT INTO public.logs(fecha, usuario_id, accion, modulo, detalle)
    VALUES(now(), actor, 'REAPERTURA_QUEJA', 'quejas',
      'Ciclo ' || cycle_no || ', folio ' || new_case.folio ||
      ', Finalizado → En Investigación, vencimiento ' || due_local);

  RETURN (SELECT to_jsonb(q) FROM public.qms_quejas q WHERE q.id = p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.qms_reopen_finalized_complaint(uuid,bigint,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qms_reopen_finalized_complaint(uuid,bigint,text)
  TO authenticated, service_role;

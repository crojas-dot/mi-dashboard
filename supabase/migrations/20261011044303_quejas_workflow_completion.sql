-- Quejas: registro GC versionado, recepción automática y plazos por etapa.
-- No renumera expedientes/Drive ni recalcula plazos históricos ya emitidos.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.quejas
  ADD COLUMN IF NOT EXISTS resolucion_formato text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS notas_formato text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS justificacion_procede text,
  ADD COLUMN IF NOT EXISTS justificacion_procede_formato text NOT NULL DEFAULT 'plain';

CREATE UNIQUE INDEX IF NOT EXISTS quejas_oficio_unique
  ON public.quejas (upper(btrim(numero_oficio_resolucion)))
  WHERE nullif(btrim(numero_oficio_resolucion), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS catalogos_quejas_area_unique
  ON public.catalogos (lower(btrim(valor)))
  WHERE modulo = 'quejas' AND tipo = 'area_afectada';

-- RPCs autorizados son la única escritura cliente; RLS no cubre TRUNCATE.
DO $grants$
DECLARE columns_sql text;
BEGIN
  REVOKE ALL ON public.quejas FROM PUBLIC, anon, authenticated;
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns_sql
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.quejas'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON public.quejas FROM PUBLIC, anon, authenticated', columns_sql);
  GRANT SELECT ON public.quejas TO authenticated;
  GRANT ALL ON public.quejas TO service_role;
END;
$grants$;

CREATE OR REPLACE FUNCTION public.qms_complaint_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF length(btrim(coalesce(NEW.cliente_nombre, ''))) NOT BETWEEN 1 AND 150
       OR length(btrim(coalesce(NEW.email_cliente, ''))) NOT BETWEEN 3 AND 254
       OR btrim(NEW.email_cliente) !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
       OR length(btrim(coalesce(NEW.descripcion, ''))) NOT BETWEEN 1 AND 10000
       OR NEW.categoria IS NULL
       OR NEW.categoria NOT IN ('Queja','Observación','Denuncia','Sugerencia','Reclamo','Felicitación') THEN
      RAISE EXCEPTION 'Nombre, correo válido, tipo y descripción son obligatorios.' USING ERRCODE = '22023';
    END IF;
    NEW.fecha := now();
    NEW.fecha_recepcion_gc := (NEW.fecha AT TIME ZONE 'America/Costa_Rica')::date;
    NEW.tipo := NEW.categoria;
    NEW.email_cliente := btrim(NEW.email_cliente);
  ELSE
    -- Recepción y tipo declarado pertenecen al alta, no al registro manual de GC.
    NEW.fecha := OLD.fecha;
    NEW.fecha_recepcion_gc := coalesce(OLD.fecha_recepcion_gc, (OLD.fecha AT TIME ZONE 'America/Costa_Rica')::date);
    NEW.tipo := coalesce(OLD.tipo, CASE WHEN OLD.categoria IN ('Queja','Observación','Denuncia','Sugerencia','Reclamo','Felicitación') THEN OLD.categoria ELSE 'Queja' END);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.numero_oficio_resolucion IS DISTINCT FROM OLD.numero_oficio_resolucion THEN
    NEW.numero_oficio_resolucion := nullif(btrim(NEW.numero_oficio_resolucion), '');
    IF length(NEW.numero_oficio_resolucion) > 120 OR NEW.numero_oficio_resolucion ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'El número de oficio es demasiado largo.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.resolucion_formato IS NULL OR NEW.resolucion_formato NOT IN ('plain','markdown')
     OR NEW.notas_formato IS NULL OR NEW.notas_formato NOT IN ('plain','markdown')
     OR NEW.justificacion_procede_formato IS NULL OR NEW.justificacion_procede_formato NOT IN ('plain','markdown') THEN
    RAISE EXCEPTION 'Formato de texto inválido.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_complaint_metadata() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_qms_complaint_metadata BEFORE INSERT OR UPDATE ON public.quejas
  FOR EACH ROW EXECUTE FUNCTION public.qms_complaint_metadata();

-- Recuperación de metadatos faltantes solamente; las fechas ya guardadas se conservan.
UPDATE public.quejas SET fecha_recepcion_gc = (fecha AT TIME ZONE 'America/Costa_Rica')::date,
  tipo = coalesce(tipo, CASE WHEN categoria IN ('Queja','Observación','Denuncia','Sugerencia','Reclamo','Felicitación') THEN categoria ELSE 'Queja' END)
WHERE fecha_recepcion_gc IS NULL OR tipo IS NULL;

CREATE OR REPLACE FUNCTION public.qms_save_complaint_area(p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE item public.catalogos; clean text := btrim(coalesce(p_value, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.app_es_admin(), false)
      OR (coalesce(public.app_es_staff(), false) AND coalesce(public.app_tiene_permiso('quejas', true), false))) THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;
  IF length(clean) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'El área debe tener entre 1 y 150 caracteres.' USING ERRCODE = '22023'; END IF;
  -- Una creación simultánea de la misma área recupera la entrada existente.
  PERFORM pg_advisory_xact_lock(hashtextextended('quejas.area.' || lower(clean), 0));
  SELECT * INTO item FROM public.catalogos
    WHERE modulo = 'quejas' AND tipo = 'area_afectada' AND lower(btrim(valor)) = lower(clean) FOR UPDATE;
  IF item.id IS NULL THEN
    INSERT INTO public.catalogos (modulo, tipo, valor, activo, orden)
      VALUES ('quejas', 'area_afectada', clean, true, 0) RETURNING * INTO item;
  ELSIF item.activo IS FALSE THEN
    UPDATE public.catalogos SET activo = true WHERE id = item.id RETURNING * INTO item;
  END IF;
  RETURN to_jsonb(item);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qms_update_complaint_register(
  p_id uuid, p_expected bigint, p_area text, p_office_number text, p_observations text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE q public.quejas; area text := nullif(btrim(p_area), ''); office text := nullif(btrim(p_office_number), '');
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.app_es_admin(), false)
      OR (coalesce(public.app_es_staff(), false) AND coalesce(public.app_tiene_permiso('quejas', true), false))) THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO q FROM public.quejas WHERE id = p_id FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected IS NULL OR q.revision IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza antes de guardar.' USING ERRCODE = '40001';
  END IF;
  IF length(area) > 150 OR length(office) > 120 OR length(coalesce(p_observations, '')) > 10000 THEN
    RAISE EXCEPTION 'Revisa el tamaño del registro de GC.' USING ERRCODE = '22023';
  END IF;
  IF area IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.catalogos WHERE modulo = 'quejas'
      AND tipo = 'area_afectada' AND valor = area AND coalesce(activo, true)) THEN
    RAISE EXCEPTION 'Guardá o seleccioná un área válida.' USING ERRCODE = '22023';
  END IF;
  IF q.estado IN ('Resuelto','Finalizado','No Procede') AND office IS NULL THEN
    RAISE EXCEPTION 'La respuesta final necesita un número de oficio.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quejas SET area_afectada = area, numero_oficio_resolucion = office,
    observaciones = nullif(btrim(p_observations), '') WHERE id = p_id;
  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
    VALUES (now(), public.app_usuario_actual_id(), 'actualizar', 'quejas', 'Registro GC ' || q.folio || ' actualizado');
  RETURN (SELECT to_jsonb(v) FROM public.qms_quejas v WHERE v.id = p_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qms_transition_complaint(
  p_id uuid, p_expected bigint, p_state text, p_resolution text DEFAULT NULL,
  p_justification text DEFAULT NULL, p_owner uuid DEFAULT NULL, p_reopen text DEFAULT NULL,
  p_office_number text DEFAULT NULL, p_resolution_format text DEFAULT NULL, p_justification_format text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE q public.quejas; own_revision bigint; office text; staff boolean;
BEGIN
  SELECT * INTO q FROM public.quejas WHERE id = p_id FOR UPDATE;
  staff := coalesce(public.app_es_admin(), false)
    OR (coalesce(public.app_es_staff(), false) AND coalesce(public.app_tiene_permiso('quejas', true), false));
  IF auth.uid() IS NULL OR NOT (staff OR (coalesce(public.app_es_colaborador(), false)
      AND coalesce(public.app_tiene_permiso('mis_quejas', true), false)
      AND coalesce(q.responsable_id = public.app_usuario_actual_id(), false))) THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected IS NULL OR q.revision IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza antes de guardar.' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalogos WHERE modulo = 'quejas' AND tipo = 'estado_queja'
      AND codigo = p_state AND coalesce(activo, true)) THEN
    RAISE EXCEPTION 'Estado no reconocido.' USING ERRCODE = '22023';
  END IF;
  IF p_resolution_format IS NOT NULL AND (p_resolution IS NULL OR p_resolution_format NOT IN ('plain','markdown'))
     OR p_justification_format IS NOT NULL AND (p_justification IS NULL OR p_justification_format NOT IN ('plain','markdown'))
     OR length(coalesce(p_resolution, '')) > 10000 OR length(coalesce(p_justification, '')) > 10000
     OR length(coalesce(p_reopen, '')) > 10000 THEN
    RAISE EXCEPTION 'Texto o formato inválido.' USING ERRCODE = '22023';
  END IF;
  office := coalesce(nullif(btrim(p_office_number), ''), q.numero_oficio_resolucion);
  IF length(office) > 120 OR (p_state IN ('rejected','resolved','finished') AND office IS NULL) THEN
    RAISE EXCEPTION 'La respuesta final necesita un número de oficio válido.' USING ERRCODE = '22023';
  END IF;
  IF p_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_owner AND estado = 'activo') THEN
    RAISE EXCEPTION 'Seleccioná un responsable activo.' USING ERRCODE = '22023';
  END IF;
  -- Se valida la revisión original ANTES de nuestra escritura bajo el mismo lock.
  -- La revisión enviada al motor es exclusivamente la producida por esta operación.
  UPDATE public.quejas SET numero_oficio_resolucion = office,
    resolucion_formato = CASE WHEN p_resolution IS NULL THEN resolucion_formato ELSE coalesce(p_resolution_format, 'plain') END,
    justificacion_procede = CASE WHEN p_justification IS NULL THEN justificacion_procede ELSE nullif(btrim(p_justification), '') END,
    justificacion_procede_formato = CASE WHEN p_justification IS NULL THEN justificacion_procede_formato ELSE coalesce(p_justification_format, 'plain') END
    WHERE id = p_id RETURNING revision INTO own_revision;
  PERFORM public.qms_transition(p_id, own_revision, p_state, p_resolution, p_justification, p_owner, p_reopen);
  RETURN (SELECT to_jsonb(v) FROM public.qms_quejas v WHERE v.id = p_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.qms_save_complaint_area(text),
  public.qms_update_complaint_register(uuid,bigint,text,text,text),
  public.qms_transition_complaint(uuid,bigint,text,text,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qms_save_complaint_area(text),
  public.qms_update_complaint_register(uuid,bigint,text,text,text),
  public.qms_transition_complaint(uuid,bigint,text,text,text,uuid,text,text,text,text) TO authenticated, service_role;

-- El antiguo editor no tiene revisión esperada ni campos automáticos.
REVOKE ALL ON FUNCTION public.actualizar_atributos_queja(uuid,text,text,date,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crear_queja_interna(
  p_cliente_nombre text, p_email_cliente text, p_categoria text, p_descripcion text, p_prioridad text
)
RETURNS public.quejas LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE q public.quejas;
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.app_es_admin(), false)
      OR (coalesce(public.app_es_staff(), false) AND coalesce(public.app_tiene_permiso('quejas', true), false))) THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;
  -- El trigger valida también llamadas directas y calcula tipo/recepción/plazo.
  INSERT INTO public.quejas(folio,cliente_nombre,email_cliente,categoria,descripcion,estado,fecha)
    VALUES(public.generar_folio_queja(),btrim(p_cliente_nombre),btrim(p_email_cliente),
      btrim(p_categoria),btrim(p_descripcion),'Recibido',now()) RETURNING * INTO q;
  INSERT INTO public.logs(fecha,usuario_id,accion,modulo,detalle)
    VALUES(now(),public.app_usuario_actual_id(),'crear','quejas','Queja interna ' || q.folio || ' creada');
  RETURN q;
END;
$function$;
REVOKE ALL ON FUNCTION public.crear_queja_interna(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_queja_interna(text,text,text,text,text) TO authenticated, service_role;

-- Retroceder en el mismo calendario del snapshot para los avisos de 3/1 días.
CREATE FUNCTION public.qms_complaint_notice_due(p_due timestamptz,p_offset integer,p_type text,p_calendar bigint)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $function$
DECLARE d date := (p_due AT TIME ZONE 'America/Costa_Rica')::date; n integer := 0; safety integer := 0;
BEGIN
  IF p_offset IS NULL THEN RETURN NULL; END IF;
  IF p_offset < 0 OR p_offset > 3660 THEN RAISE EXCEPTION 'Aviso inválido.'; END IF;
  WHILE n < p_offset LOOP
    d := d - 1; safety := safety + 1;
    IF p_type = 'calendar_days' OR public.qms_business_day(d,p_calendar) THEN n := n+1; END IF;
    IF safety > 30000 THEN RAISE EXCEPTION 'Calendario inválido.'; END IF;
  END LOOP;
  RETURN (d + time '06:00') AT TIME ZONE 'America/Costa_Rica';
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_complaint_notice_due(timestamptz,integer,text,bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.qms_sync_queja()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE stage text; active_run public.qms_stage_runs; rule public.qms_stage_versions;
  cal bigint; run uuid; due timestamptz; alert integer; attention timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.revision := OLD.revision + 1;
    NEW.fecha_sla := OLD.fecha_sla;
    NEW.fecha_limite_investigacion := OLD.fecha_limite_investigacion;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

    -- La revisión GC es parte de la misma investigación: no detener ni reiniciar sus 15 días.
    IF OLD.estado IN ('En Investigación','Pendiente de Revisión GC')
       AND NEW.estado IN ('En Investigación','Pendiente de Revisión GC') THEN
      SELECT * INTO active_run FROM public.qms_stage_runs
        WHERE case_id = NEW.id AND stage_id = 'quejas.investigation'
          AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
      IF active_run.id IS NULL AND OLD.estado = 'Pendiente de Revisión GC' THEN
        -- Recupera solamente el snapshot que el trigger anterior cerró al enviar a GC.
        SELECT * INTO active_run FROM public.qms_stage_runs
          WHERE case_id = NEW.id AND stage_id = 'quejas.investigation'
            AND end_event = 'Pendiente de Revisión GC' ORDER BY ended_at DESC LIMIT 1 FOR UPDATE;
        IF active_run.id IS NOT NULL THEN
          UPDATE public.qms_stage_runs SET ended_at = NULL, end_event = NULL WHERE id = active_run.id;
        END IF;
      END IF;
      IF active_run.id IS NOT NULL THEN NEW.fecha_limite_investigacion := active_run.expires_at; END IF;
      RETURN NEW;
    END IF;
    UPDATE public.qms_stage_runs SET ended_at = now(), end_event = NEW.estado
      WHERE case_id = NEW.id AND ended_at IS NULL;
  END IF;
  stage := CASE NEW.estado WHEN 'Recibido' THEN 'quejas.evaluation'
    WHEN 'En Investigación' THEN 'quejas.investigation' END;
  IF stage IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('qms.config', 0));
  SELECT * INTO rule FROM public.qms_stage_versions WHERE stage_id = stage ORDER BY id DESC LIMIT 1;
  SELECT id INTO cal FROM public.qms_calendars ORDER BY id DESC LIMIT 1;
  IF rule.id IS NULL OR cal IS NULL THEN RAISE EXCEPTION 'Falta configurar el plazo y el calendario.' USING ERRCODE = '22023'; END IF;
  due := public.qms_due(now(), rule.duration, rule.day_type, cal);
  SELECT public.qms_complaint_notice_due(due, max(a), rule.day_type, cal)
    INTO attention FROM unnest(rule.alerts) a;
  INSERT INTO public.qms_stage_runs(case_id,stage_id,rule_id,calendar_id,snapshot,started_at,expires_at,attention_at)
    VALUES(NEW.id,stage,rule.id,cal,jsonb_build_object('rule',to_jsonb(rule),
      'calendar',(SELECT to_jsonb(c) FROM public.qms_calendars c WHERE c.id = cal)),now(),due,attention)
    RETURNING id INTO run;
  FOREACH alert IN ARRAY rule.alerts LOOP
    INSERT INTO public.qms_deadline_notices(run_id,offset_days,due_at)
      VALUES(run,alert,public.qms_complaint_notice_due(due, alert, rule.day_type, cal));
  END LOOP;
  IF rule.expiration_action = 'notify_quality' THEN
    INSERT INTO public.qms_deadline_notices(run_id,offset_days,due_at) VALUES(run,0,due + interval '1 microsecond');
  END IF;
  IF stage = 'quejas.evaluation' THEN NEW.fecha_sla := due; ELSE NEW.fecha_limite_investigacion := due; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_sync_queja() FROM PUBLIC, anon, authenticated;

-- Nueva versión para altas futuras. Un snapshot vigente nunca se altera al configurar.
DO $stage$
DECLARE previous public.qms_stage_versions; next_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('qms.config', 0));
  SELECT * INTO previous FROM public.qms_stage_versions
    WHERE stage_id = 'quejas.evaluation' ORDER BY id DESC LIMIT 1;
  IF previous.id IS NULL THEN RAISE EXCEPTION 'No existe la etapa de evaluación inicial.'; END IF;
  IF previous.duration <> 3 OR previous.day_type <> 'business_days' THEN
    INSERT INTO public.qms_stage_versions(stage_id,duration,day_type,alerts,expiration_action,created_by)
      VALUES('quejas.evaluation',3,'business_days',ARRAY[1],previous.expiration_action,NULL) RETURNING id INTO next_id;
    INSERT INTO public.qms_config_audit(entity,old_value,new_value,reason,actor_id)
      SELECT 'quejas.evaluation',to_jsonb(previous),to_jsonb(v),'Recepción: 3 días hábiles confirmados por ECA',NULL
      FROM public.qms_stage_versions v WHERE id = next_id;
  END IF;
END;
$stage$;

-- Columnas nuevas al final conservan contratos de vistas dependientes.
CREATE OR REPLACE VIEW public.qms_quejas WITH (security_invoker = true) AS
 SELECT q.id,
    q.folio,
    q.cliente_nombre,
    q.email_cliente,
    q.telefono,
    q.categoria,
    q.descripcion,
    q.prioridad,
    q.estado,
    q.fecha_sla,
    q.fecha,
    q.notas,
    q.resolucion,
    q.responsable_id,
    q.derivado_sacp_id,
    q.fecha_cierre,
    q.fecha_limite_investigacion,
    q.reabierta,
    q.motivo_reapertura,
    q.revision,
    c.codigo AS estado_codigo,
    COALESCE(c.valor, q.estado) AS estado_nombre,
    COALESCE(c.color, 'secondary'::text) AS estado_color,
    r.expires_at AS plazo_vence,
    r.stage_id AS plazo_etapa,
        CASE
            WHEN r.id IS NULL THEN 'completed'::text
            ELSE qms_classify(r.expires_at, r.attention_at)
        END AS plazo_situacion,
        CASE
            WHEN r.expires_at IS NULL THEN NULL::integer
            ELSE (r.expires_at AT TIME ZONE 'America/Costa_Rica'::text)::date - (now() AT TIME ZONE 'America/Costa_Rica'::text)::date
        END AS plazo_dias,
    q.tipo, q.area_afectada, q.fecha_recepcion_gc, q.numero_oficio_resolucion, q.observaciones, q.resolucion_formato, q.notas_formato, q.justificacion_procede, q.justificacion_procede_formato
   FROM public.quejas q
     LEFT JOIN LATERAL ( SELECT catalogos.codigo,
            catalogos.valor,
            catalogos.color
           FROM catalogos
          WHERE catalogos.modulo = 'quejas'::text AND catalogos.tipo = 'estado_queja'::text AND catalogos.valor_interno = q.estado
          ORDER BY catalogos.orden, catalogos.id
         LIMIT 1) c ON true
     LEFT JOIN LATERAL (SELECT * FROM public.qms_stage_runs sr WHERE sr.case_id = q.id
       AND (sr.ended_at IS NULL OR (q.estado = 'Pendiente de Revisión GC'
         AND sr.stage_id = 'quejas.investigation' AND sr.end_event = 'Pendiente de Revisión GC'))
       ORDER BY (sr.ended_at IS NULL) DESC, sr.started_at DESC LIMIT 1) r ON true;

-- Gateway service-only conserva la idempotencia y admite Observación.
CREATE OR REPLACE FUNCTION public.public_form_create_submission(p_form_id uuid, p_form_token text, p_submission_id uuid, p_payload_hash text, p_rate_key_hash text, p_cliente_nombre text, p_email_cliente text, p_telefono text, p_categoria text, p_descripcion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_form public.formularios_publicos%ROWTYPE; v_submission public.public_form_submissions%ROWTYPE;
        v_created boolean; v_folio text; v_queja_id uuid; v_rate jsonb;
BEGIN
  IF p_form_id IS NULL OR p_submission_id IS NULL OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
     OR p_cliente_nombre IS NULL OR length(btrim(p_cliente_nombre)) NOT BETWEEN 1 AND 150
     OR length(btrim(coalesce(p_email_cliente,''))) NOT BETWEEN 3 AND 254
     OR btrim(p_email_cliente) !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' OR length(coalesce(p_telefono,'')) > 40
     OR p_categoria IS NULL OR p_categoria NOT IN ('Queja','Observación','Denuncia','Sugerencia','Reclamo','Felicitación')
     OR p_descripcion IS NULL OR length(btrim(p_descripcion)) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PUBLIC_SUBMISSION_INPUT_INVALID';
  END IF;
  SELECT f.* INTO v_form FROM public.formularios_publicos f
  WHERE f.id = p_form_id AND f.token = p_form_token AND f.activo AND f.modulo = 'quejas' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_FORM_UNAVAILABLE'; END IF;
  -- UNIQUE reclama el envío antes de asignar folio; competidores esperan al commit.
  INSERT INTO public.public_form_submissions (form_id,submission_id,payload_hash)
  VALUES (p_form_id,p_submission_id,p_payload_hash)
  ON CONFLICT (form_id,submission_id) DO NOTHING RETURNING true INTO v_created;
  SELECT s.* INTO STRICT v_submission FROM public.public_form_submissions s
  WHERE s.form_id = p_form_id AND s.submission_id = p_submission_id FOR UPDATE;
  IF v_submission.payload_hash <> p_payload_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_SUBMISSION_CONFLICT';
  END IF;
  IF coalesce(v_created,false) THEN
    v_rate := public.public_form_consume_rate(p_rate_key_hash,'accepted',20,3600);
    IF NOT (v_rate->>'allowed')::boolean THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PUBLIC_RATE_LIMITED', DETAIL = v_rate->>'retry_after';
    END IF;
    -- Generador oficial y workflow existente, en la misma transacción de la reclamación.
    v_folio := public.crear_queja_publica(v_form.token,btrim(p_cliente_nombre),nullif(btrim(p_email_cliente),''),
      nullif(btrim(p_telefono),''),p_categoria,btrim(p_descripcion));
    SELECT q.id INTO STRICT v_queja_id FROM public.quejas q WHERE q.folio = v_folio;
    UPDATE public.public_form_submissions SET queja_id = v_queja_id WHERE form_id = p_form_id AND submission_id = p_submission_id;
  ELSE
    SELECT q.id,q.folio INTO STRICT v_queja_id,v_folio FROM public.quejas q WHERE q.id = v_submission.queja_id;
  END IF;
  RETURN jsonb_build_object('queja_id',v_queja_id,'folio',v_folio,'created',coalesce(v_created,false),'finalized',v_submission.finalized_at IS NOT NULL,'created_at',v_submission.created_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.public_form_create_submission(uuid,text,uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_form_create_submission(uuid,text,uuid,text,text,text,text,text,text,text) TO service_role;


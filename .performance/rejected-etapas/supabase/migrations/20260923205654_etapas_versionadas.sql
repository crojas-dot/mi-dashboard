-- Etapas versionadas. Ejecutar como propietario, en una transacción.
-- Requiere las migraciones 001–016. No recalcula fechas existentes.
BEGIN;
CREATE TABLE public.qms_calendars (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 weekdays integer[] NOT NULL CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
 holidays jsonb NOT NULL DEFAULT '[]', timezone text NOT NULL DEFAULT 'America/Costa_Rica' CHECK (timezone='America/Costa_Rica'),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES public.usuarios(id)
);
INSERT INTO public.qms_calendars(weekdays) VALUES (ARRAY[1,2,3,4,5]);
CREATE TABLE public.qms_stages (
 id text PRIMARY KEY, process_id text NOT NULL, name text NOT NULL,
 start_event text NOT NULL, end_event text NOT NULL
);
INSERT INTO public.qms_stages VALUES
 ('quejas.evaluation','quejas','Evaluación inicial','Queja registrada','Procedencia evaluada'),
 ('quejas.investigation','quejas','Investigación','Investigación iniciada o reabierta','Investigación enviada a revisión o resuelta');
CREATE TABLE public.qms_stage_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, stage_id text NOT NULL REFERENCES public.qms_stages(id),
 duration integer NOT NULL CHECK(duration BETWEEN 1 AND 3660), day_type text NOT NULL CHECK(day_type IN ('business_days','calendar_days')),
 alerts integer[] NOT NULL, expiration_action text NOT NULL CHECK(expiration_action IN ('notify_quality','mark_only')),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES public.usuarios(id)
);
INSERT INTO public.qms_stage_versions(stage_id,duration,day_type,alerts,expiration_action) VALUES
 ('quejas.evaluation',3,'calendar_days',ARRAY[1],'notify_quality'),
 ('quejas.investigation',15,'business_days',ARRAY[3,1],'notify_quality');
CREATE TABLE public.qms_config_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity text NOT NULL,
 old_value jsonb, new_value jsonb NOT NULL, reason text, actor_id uuid REFERENCES public.usuarios(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.qms_stage_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.quejas(id) DEFERRABLE INITIALLY DEFERRED,
 stage_id text NOT NULL REFERENCES public.qms_stages(id), rule_id bigint REFERENCES public.qms_stage_versions(id),
 calendar_id bigint REFERENCES public.qms_calendars(id), snapshot jsonb NOT NULL,
 started_at timestamptz NOT NULL, expires_at timestamptz, attention_at timestamptz,
 ended_at timestamptz, end_event text, provenance text NOT NULL DEFAULT 'configured' CHECK(provenance IN ('configured','legacy_unknown'))
);
CREATE UNIQUE INDEX qms_one_active_run ON public.qms_stage_runs(case_id) WHERE ended_at IS NULL;
CREATE INDEX qms_active_due ON public.qms_stage_runs(expires_at,case_id) WHERE ended_at IS NULL;
CREATE INDEX qms_runs_case ON public.qms_stage_runs(case_id,started_at DESC);
CREATE TABLE public.qms_deadline_notices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.qms_stage_runs(id),
 offset_days integer NOT NULL, due_at timestamptz NOT NULL, processed_at timestamptz,
 UNIQUE(run_id,offset_days)
);
CREATE INDEX qms_notices_due ON public.qms_deadline_notices(due_at) WHERE processed_at IS NULL;
ALTER TABLE public.quejas ADD COLUMN revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.catalogos ADD COLUMN codigo text;
ALTER TABLE public.catalogos ADD COLUMN valor_interno text;
UPDATE public.catalogos SET codigo=id::text, valor_interno=valor;
-- El valor interno conserva compatibilidad con RPCs existentes; nunca es la etiqueta editable.
INSERT INTO public.catalogos(modulo,tipo,valor,color,orden,activo,codigo,valor_interno)
 SELECT 'quejas','estado_queja',label,color,ord,true,code,label FROM (VALUES
 ('received','Recibido','secondary',1),('investigation','En Investigación','primary',2),
 ('quality_review','Pendiente de Revisión GC','warning',3),('resolved','Resuelto','success',4),
 ('finished','Finalizado','success',5),('rejected','No Procede','secondary',6)) v(code,label,color,ord)
 WHERE NOT EXISTS(SELECT 1 FROM public.catalogos c WHERE c.modulo='quejas' AND c.tipo='estado_queja' AND c.valor=label);
UPDATE public.catalogos c SET codigo=v.code,color=v.color FROM (VALUES
 ('received','Recibido','secondary'),('investigation','En Investigación','primary'),
 ('quality_review','Pendiente de Revisión GC','warning'),('resolved','Resuelto','success'),
 ('finished','Finalizado','success'),('rejected','No Procede','secondary')) v(code,label,color)
 WHERE c.modulo='quejas' AND c.tipo='estado_queja' AND c.valor_interno=v.label;
UPDATE public.catalogos SET color=CASE color WHEN 'blue' THEN 'primary' WHEN 'green' THEN 'success' WHEN 'red' THEN 'danger' WHEN 'amber' THEN 'warning' ELSE 'secondary' END
 WHERE color IS NULL OR color NOT IN ('primary','info','success','warning','danger','secondary');
ALTER TABLE public.catalogos ALTER COLUMN codigo SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.catalogos ALTER COLUMN codigo SET NOT NULL;
-- No escoger silenciosamente entre dos códigos iguales: revisar duplicados
-- de estados antes de desplegar si una instalación histórica los contiene.
CREATE UNIQUE INDEX qms_catalog_code ON catalogos(modulo,tipo,codigo);
ALTER TABLE public.catalogos ADD CONSTRAINT catalogo_semantic_color CHECK(color IN ('primary','info','success','warning','danger','secondary'));

CREATE FUNCTION public.qms_business_day(p_day date,p_calendar bigint) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT extract(isodow FROM p_day)::int=ANY(weekdays) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(holidays) h WHERE (h->>'date')::date=p_day)
 FROM qms_calendars WHERE id=p_calendar;
$$;
CREATE FUNCTION public.qms_due(p_start timestamptz,p_days integer,p_type text,p_calendar bigint) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE d date := (p_start AT TIME ZONE 'America/Costa_Rica')::date; n integer:=0; safety integer:=0;
BEGIN
 IF p_days<1 OR p_days>3660 OR p_type NOT IN ('business_days','calendar_days') THEN RAISE EXCEPTION 'Plazo inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM qms_calendars WHERE id=p_calendar) THEN RAISE EXCEPTION 'Calendario no encontrado'; END IF;
 WHILE n<p_days LOOP
   d:=d+1; safety:=safety+1;
   IF p_type='calendar_days' OR qms_business_day(d,p_calendar) THEN n:=n+1; END IF;
   IF safety>30000 THEN RAISE EXCEPTION 'El calendario no permite calcular el vencimiento'; END IF;
 END LOOP;
 WHILE NOT qms_business_day(d,p_calendar) LOOP
   d:=d+1; safety:=safety+1;
   IF safety>30000 THEN RAISE EXCEPTION 'El calendario no permite calcular el vencimiento'; END IF;
 END LOOP;
 RETURN (d+1)::timestamp AT TIME ZONE 'America/Costa_Rica' - interval '1 microsecond';
END; $$;

CREATE FUNCTION public.qms_publish_stage(p_stage text,p_expected bigint,p_duration integer,p_type text,p_alerts integer[],p_action text,p_reason text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous qms_stage_versions; result bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT app_es_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('qms.config',0));
 SELECT * INTO previous FROM qms_stage_versions WHERE stage_id=p_stage ORDER BY id DESC LIMIT 1;
 IF previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'La configuración cambió. Actualiza antes de guardar.' USING ERRCODE='40001'; END IF;
 IF p_duration IS NULL OR p_duration NOT BETWEEN 1 AND 3660 OR p_type IS NULL OR p_type NOT IN ('business_days','calendar_days')
 OR p_action IS NULL OR p_action NOT IN ('notify_quality','mark_only') OR p_alerts IS NULL
 OR EXISTS(SELECT 1 FROM unnest(p_alerts) a WHERE a IS NULL OR a<1 OR a>p_duration)
 OR cardinality(p_alerts)<>(SELECT count(DISTINCT a) FROM unnest(p_alerts) a)
 THEN RAISE EXCEPTION 'Revisa duración, tipo de días, acción y alertas: positivas, únicas y dentro del plazo.' USING ERRCODE='22023'; END IF;
 INSERT INTO qms_stage_versions(stage_id,duration,day_type,alerts,expiration_action,created_by)
 VALUES(p_stage,p_duration,p_type,p_alerts,p_action,app_usuario_actual_id()) RETURNING id INTO result;
 INSERT INTO qms_config_audit(entity,old_value,new_value,reason,actor_id)
 SELECT p_stage,to_jsonb(previous),to_jsonb(v),p_reason,app_usuario_actual_id() FROM qms_stage_versions v WHERE id=result;
 RETURN result;
END; $$;
CREATE FUNCTION public.qms_publish_calendar(p_expected bigint,p_weekdays integer[],p_holidays jsonb,p_reason text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous qms_calendars; result bigint; h jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT app_es_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('qms.config',0));
 SELECT * INTO previous FROM qms_calendars ORDER BY id DESC LIMIT 1;
 IF previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'El calendario cambió. Actualiza antes de guardar.' USING ERRCODE='40001'; END IF;
 IF p_weekdays IS NULL OR cardinality(p_weekdays) NOT BETWEEN 1 AND 7 OR NOT p_weekdays<@ARRAY[1,2,3,4,5,6,7]
 OR array_position(p_weekdays,NULL) IS NOT NULL OR cardinality(p_weekdays)<>(SELECT count(DISTINCT d) FROM unnest(p_weekdays) d)
 OR p_holidays IS NULL OR jsonb_typeof(p_holidays)<>'array' OR jsonb_array_length(p_holidays)>1000
 THEN RAISE EXCEPTION 'Calendario inválido' USING ERRCODE='22023'; END IF;
 FOR h IN SELECT * FROM jsonb_array_elements(p_holidays) LOOP
   IF coalesce(h->>'date','')!~'^\d{4}-\d{2}-\d{2}$' OR nullif(btrim(h->>'description'),'') IS NULL THEN RAISE EXCEPTION 'Cada feriado necesita fecha y descripción'; END IF;
   PERFORM (h->>'date')::date;
 END LOOP;
 IF (SELECT count(DISTINCT h->>'date') FROM jsonb_array_elements(p_holidays) h)<>jsonb_array_length(p_holidays) THEN RAISE EXCEPTION 'Hay feriados duplicados'; END IF;
 INSERT INTO qms_calendars(weekdays,holidays,created_by) VALUES(p_weekdays,p_holidays,app_usuario_actual_id()) RETURNING id INTO result;
 INSERT INTO qms_config_audit(entity,old_value,new_value,reason,actor_id)
 SELECT 'calendar',to_jsonb(previous),to_jsonb(c),p_reason,app_usuario_actual_id() FROM qms_calendars c WHERE id=result;
 RETURN result;
END; $$;

-- Importación explícita: conservar fechas originales, sin atribuirles reglas nuevas.
INSERT INTO qms_stage_runs(case_id,stage_id,snapshot,started_at,expires_at,ended_at,provenance)
 SELECT id,CASE WHEN estado='Recibido' THEN 'quejas.evaluation' ELSE 'quejas.investigation' END,
 jsonb_build_object('source','legacy','original_state',estado,'original_due',CASE WHEN estado='Recibido' THEN fecha_sla ELSE fecha_limite_investigacion END),
 coalesce(fecha,now()),CASE WHEN estado='Recibido' THEN fecha_sla ELSE fecha_limite_investigacion END,
 CASE WHEN estado NOT IN ('Recibido','En Investigación') THEN coalesce(fecha_cierre,now()) END,'legacy_unknown'
 FROM quejas;

CREATE FUNCTION public.qms_sync_queja() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE stage text; active_run qms_stage_runs; rule qms_stage_versions; cal bigint; run uuid; due timestamptz; alert integer; attention timestamptz;
BEGIN
 IF TG_OP='UPDATE' THEN
   NEW.revision:=OLD.revision+1;
   IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
     SELECT * INTO active_run FROM qms_stage_runs WHERE case_id=NEW.id AND ended_at IS NULL;
     -- Cambiar prioridad no recalcula el snapshot ni el vencimiento de una etapa.
     NEW.fecha_sla:=OLD.fecha_sla;
     NEW.fecha_limite_investigacion:=OLD.fecha_limite_investigacion;
     RETURN NEW;
   END IF;
   UPDATE qms_stage_runs SET ended_at=now(),end_event=NEW.estado WHERE case_id=NEW.id AND ended_at IS NULL;
 END IF;
 stage:=CASE NEW.estado WHEN 'Recibido' THEN 'quejas.evaluation' WHEN 'En Investigación' THEN 'quejas.investigation' END;
 IF stage IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('qms.config',0));
 SELECT * INTO rule FROM qms_stage_versions WHERE stage_id=stage ORDER BY id DESC LIMIT 1;
 SELECT id INTO cal FROM qms_calendars ORDER BY id DESC LIMIT 1;
 due:=qms_due(now(),rule.duration,rule.day_type,cal);
 -- Anticipaciones en días naturales, a las 06:00 de Costa Rica. No recalcular después.
 SELECT ((due AT TIME ZONE 'America/Costa_Rica')::date-max(a)+time '06:00') AT TIME ZONE 'America/Costa_Rica' INTO attention FROM unnest(rule.alerts) a;
 INSERT INTO qms_stage_runs(case_id,stage_id,rule_id,calendar_id,snapshot,started_at,expires_at,attention_at)
 VALUES(NEW.id,stage,rule.id,cal,jsonb_build_object('rule',to_jsonb(rule),'calendar',(SELECT to_jsonb(c) FROM qms_calendars c WHERE c.id=cal)),now(),due,attention) RETURNING id INTO run;
 FOREACH alert IN ARRAY rule.alerts LOOP
   INSERT INTO qms_deadline_notices(run_id,offset_days,due_at)
   VALUES(run,alert,((due AT TIME ZONE 'America/Costa_Rica')::date-alert+time '06:00') AT TIME ZONE 'America/Costa_Rica');
 END LOOP;
 IF rule.expiration_action='notify_quality' THEN INSERT INTO qms_deadline_notices(run_id,offset_days,due_at) VALUES(run,0,due+interval '1 microsecond'); END IF;
 IF stage='quejas.evaluation' THEN NEW.fecha_sla:=due; ELSE NEW.fecha_limite_investigacion:=due; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER qms_queja_stage BEFORE INSERT OR UPDATE ON public.quejas FOR EACH ROW EXECUTE FUNCTION qms_sync_queja();

CREATE FUNCTION public.qms_transition(p_id uuid,p_expected bigint,p_state text,p_resolution text DEFAULT NULL,p_justification text DEFAULT NULL,p_owner uuid DEFAULT NULL,p_reopen text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q quejas; target text;
BEGIN
 SELECT * INTO q FROM quejas WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT (coalesce(app_es_staff(),false) OR (coalesce(app_es_colaborador(),false) AND coalesce(q.responsable_id=app_usuario_actual_id(),false))) THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF q.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;
 IF p_expected IS NULL OR q.revision<>p_expected THEN RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza el expediente antes de guardar.' USING ERRCODE='40001'; END IF;
 SELECT valor_interno INTO target FROM catalogos WHERE modulo='quejas' AND tipo='estado_queja' AND codigo=p_state LIMIT 1;
 IF target IS NULL THEN RAISE EXCEPTION 'Estado no reconocido'; END IF;
 IF q.estado='Recibido' AND target='En Investigación' AND
 (nullif(btrim(p_justification),'') IS NULL OR coalesce(p_owner,q.responsable_id) IS NULL) THEN RAISE EXCEPTION 'Selecciona un responsable y escribe la justificación'; END IF;
 PERFORM public.transicionar_queja(p_id,target,p_resolution,p_justification,p_owner,p_reopen);
 RETURN (SELECT to_jsonb(v) FROM qms_quejas v WHERE id=p_id);
END; $$;
CREATE FUNCTION public.qms_update_details(p_id uuid,p_expected bigint,p_categoria text DEFAULT NULL,p_prioridad text DEFAULT NULL,p_owner uuid DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q quejas;
BEGIN
 IF auth.uid() IS NULL OR NOT app_es_staff() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM quejas WHERE id=p_id FOR UPDATE;
 IF p_expected IS NULL OR q.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza antes de guardar.' USING ERRCODE='40001'; END IF;
 PERFORM public.actualizar_detalles_queja(p_id,p_categoria,p_prioridad,p_owner,p_notes);
 RETURN (SELECT to_jsonb(v) FROM qms_quejas v WHERE id=p_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.transicionar_queja(uuid,text,text,text,uuid,text) FROM PUBLIC,authenticated;
REVOKE EXECUTE ON FUNCTION public.actualizar_detalles_queja(uuid,text,text,uuid,text) FROM PUBLIC,authenticated;
DO $$ BEGIN
 IF to_regprocedure('public.reabrir_queja(uuid,text)') IS NOT NULL THEN
   REVOKE EXECUTE ON FUNCTION public.reabrir_queja(uuid,text) FROM PUBLIC,authenticated;
 END IF;
END $$;

CREATE FUNCTION public.qms_catalog_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Desactiva el valor para conservar su historial'; END IF;
 IF TG_OP='UPDATE' AND (NEW.modulo IS DISTINCT FROM OLD.modulo OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN RAISE EXCEPTION 'El catálogo interno no puede cambiar de módulo o tipo'; END IF;
 IF TG_OP='INSERT' AND NEW.tipo LIKE 'estado_%' THEN RAISE EXCEPTION 'Los estados pertenecen al flujo definido en código. Edita su nombre y color.'; END IF;
 IF TG_OP='UPDATE' AND (NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.valor_interno IS DISTINCT FROM OLD.valor_interno) THEN RAISE EXCEPTION 'El identificador interno es inmutable'; END IF;
 IF TG_OP='INSERT' THEN NEW.valor_interno:=NEW.valor; END IF;
 IF TG_OP='UPDATE' AND OLD.tipo LIKE 'estado_%' AND NEW.activo=false THEN RAISE EXCEPTION 'Los estados del flujo no se pueden desactivar'; END IF;
 INSERT INTO qms_config_audit(entity,old_value,new_value,actor_id) VALUES('catalogos',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),app_usuario_actual_id());
 RETURN NEW;
END; $$;
CREATE TRIGGER qms_catalog_audit BEFORE INSERT OR UPDATE OR DELETE ON catalogos FOR EACH ROW EXECUTE FUNCTION qms_catalog_guard();

-- Las lecturas respetan RLS. Los RPC privilegiados tienen autorización explícita.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
ALTER TABLE qms_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms_stage_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms_config_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms_stage_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms_deadline_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_calendar_read ON qms_calendars FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
CREATE POLICY qms_stage_read ON qms_stages FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
CREATE POLICY qms_version_read ON qms_stage_versions FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
CREATE POLICY qms_audit_read ON qms_config_audit FOR SELECT TO authenticated USING(app_es_admin());
CREATE POLICY qms_run_read ON qms_stage_runs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM quejas q WHERE q.id=case_id));
GRANT SELECT ON qms_calendars,qms_stages,qms_stage_versions,qms_config_audit,qms_stage_runs TO authenticated;
REVOKE ALL ON qms_calendars,qms_stages,qms_stage_versions,qms_config_audit,qms_stage_runs,qms_deadline_notices FROM anon;
REVOKE ALL ON FUNCTION qms_sync_queja(),qms_catalog_guard(),qms_publish_stage(text,bigint,integer,text,integer[],text,text),qms_publish_calendar(bigint,integer[],jsonb,text),qms_transition(uuid,bigint,text,text,text,uuid,text),qms_update_details(uuid,bigint,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qms_publish_stage(text,bigint,integer,text,integer[],text,text),qms_publish_calendar(bigint,integer[],jsonb,text),qms_transition(uuid,bigint,text,text,text,uuid,text),qms_update_details(uuid,bigint,text,text,uuid,text) TO authenticated;

CREATE FUNCTION public.qms_classify(p_due timestamptz,p_attention timestamptz,p_now timestamptz DEFAULT now()) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN p_due IS NULL THEN 'unconfigured' WHEN p_due<p_now THEN 'overdue'
 WHEN (p_due AT TIME ZONE 'America/Costa_Rica')::date=(p_now AT TIME ZONE 'America/Costa_Rica')::date THEN 'today'
 WHEN p_attention IS NOT NULL AND p_now>=p_attention THEN 'soon' ELSE 'within' END;
$$;
CREATE VIEW public.qms_quejas WITH (security_invoker=true) AS
 SELECT q.*,c.codigo AS estado_codigo,coalesce(c.valor,q.estado) AS estado_nombre,coalesce(c.color,'secondary') AS estado_color,
 r.expires_at AS plazo_vence,r.stage_id AS plazo_etapa,
 CASE WHEN r.id IS NULL THEN 'completed' ELSE qms_classify(r.expires_at,r.attention_at) END AS plazo_situacion,
 CASE WHEN r.expires_at IS NULL THEN NULL ELSE (r.expires_at AT TIME ZONE 'America/Costa_Rica')::date-(now() AT TIME ZONE 'America/Costa_Rica')::date END AS plazo_dias
 FROM quejas q LEFT JOIN LATERAL(SELECT codigo,valor,color FROM catalogos WHERE modulo='quejas' AND tipo='estado_queja' AND valor_interno=q.estado ORDER BY orden,id LIMIT 1)c ON true
 LEFT JOIN qms_stage_runs r ON r.case_id=q.id AND r.ended_at IS NULL;
GRANT SELECT ON qms_quejas TO authenticated;
CREATE VIEW qms_current_stages WITH(security_invoker=true) AS
 SELECT s.*,to_jsonb(v) AS rule FROM qms_stages s CROSS JOIN LATERAL
 (SELECT * FROM qms_stage_versions WHERE stage_id=s.id ORDER BY id DESC LIMIT 1)v;
GRANT SELECT ON qms_current_stages TO authenticated;
CREATE INDEX qms_versions_latest ON qms_stage_versions(stage_id,id DESC);

CREATE FUNCTION public.qms_process_notices() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n record; delivered integer:=0;
BEGIN
 -- Solo scheduler/service role. Claim + entrega interna + ACK en una transacción.
 FOR n IN SELECT a.*,r.case_id,r.ended_at FROM qms_deadline_notices a JOIN qms_stage_runs r ON r.id=a.run_id
 WHERE a.processed_at IS NULL AND a.due_at<=now() ORDER BY a.due_at LIMIT 250 FOR UPDATE OF a SKIP LOCKED LOOP
   IF n.ended_at IS NULL THEN
     INSERT INTO notificaciones(usuario_id,fecha,tipo,mensaje,enlace,origen_id)
     SELECT u.id,now(),'qms_plazo',CASE WHEN n.offset_days=0 THEN 'Plazo vencido: ' ELSE 'Próximo vencimiento: ' END||q.folio,
     '/quejas',q.id FROM usuarios u JOIN quejas q ON q.id=n.case_id
     WHERE u.estado='activo' AND (u.rol IN ('admin','calidad') OR u.id=q.responsable_id);
     delivered:=delivered+1;
   END IF;
   UPDATE qms_deadline_notices SET processed_at=now() WHERE id=n.id;
 END LOOP;
 RETURN delivered;
END; $$;
REVOKE ALL ON FUNCTION qms_process_notices() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION qms_process_notices() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
   PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='alerta-quejas-investigacion';
   PERFORM cron.schedule('qms-plazos','*/5 * * * *','SELECT public.qms_process_notices();');
 ELSE RAISE NOTICE 'Programar qms_process_notices cada cinco minutos con rol de servicio: pg_cron no está instalado.'; END IF;
END $$;
-- Evitar que clientes antiguos vuelvan a ejecutar el generador de alertas anterior.
DO $$ BEGIN
 IF to_regprocedure('public.procesar_alertas_quejas()') IS NOT NULL THEN
   REVOKE EXECUTE ON FUNCTION public.procesar_alertas_quejas() FROM PUBLIC,anon,authenticated;
 END IF;
END $$;
-- Eventos reales: no deducir fechas de cierre a partir del estado actual.
CREATE TABLE qms_case_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, module text NOT NULL, case_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('opened','closed','resolved')), occurred_at timestamptz NOT NULL,
 provenance text NOT NULL DEFAULT 'observed'
);
CREATE INDEX qms_events_timeline ON qms_case_events(module,occurred_at,kind);
INSERT INTO qms_case_events(module,case_id,kind,occurred_at,provenance)
 SELECT 'quejas',id,'opened',fecha,'legacy' FROM quejas WHERE fecha IS NOT NULL
 UNION ALL SELECT 'quejas',id,'closed',fecha_cierre,'legacy' FROM quejas WHERE fecha_cierre IS NOT NULL
 UNION ALL SELECT 'sacp',id,'opened',fecha_apertura,'legacy' FROM acciones WHERE fecha_apertura IS NOT NULL
 UNION ALL SELECT 'documentos',id,'opened',created_at,'legacy' FROM documentos WHERE created_at IS NOT NULL
 UNION ALL SELECT 'riesgos',id,'opened',fecha_identificacion,'legacy' FROM riesgos WHERE fecha_identificacion IS NOT NULL;
CREATE FUNCTION qms_record_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE module text:=TG_ARGV[0]; is_closed boolean; was_closed boolean;
BEGIN
 IF TG_OP='INSERT' THEN INSERT INTO qms_case_events(module,case_id,kind,occurred_at) VALUES(module,NEW.id,'opened',now());
 ELSE
   is_closed:=NEW.estado=ANY(string_to_array(TG_ARGV[1],','));
   was_closed:=OLD.estado=ANY(string_to_array(TG_ARGV[1],','));
   IF is_closed AND NOT was_closed THEN INSERT INTO qms_case_events(module,case_id,kind,occurred_at) VALUES(module,NEW.id,'closed',now()); END IF;
   IF was_closed AND NOT is_closed THEN INSERT INTO qms_case_events(module,case_id,kind,occurred_at) VALUES(module,NEW.id,'opened',now()); END IF;
   IF module='quejas' AND NEW.estado='Resuelto' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
     INSERT INTO qms_case_events(module,case_id,kind,occurred_at) VALUES(module,NEW.id,'resolved',now());
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qms_queja_event AFTER INSERT OR UPDATE OF estado ON quejas FOR EACH ROW EXECUTE FUNCTION qms_record_event('quejas','Finalizado,No Procede,Cerrada');
CREATE TRIGGER qms_sacp_event AFTER INSERT OR UPDATE OF estado ON acciones FOR EACH ROW EXECUTE FUNCTION qms_record_event('sacp','Cerrada');
CREATE TRIGGER qms_document_event AFTER INSERT OR UPDATE OF estado ON documentos FOR EACH ROW EXECUTE FUNCTION qms_record_event('documentos','Publicado,Archivado');
CREATE TRIGGER qms_risk_event AFTER INSERT OR UPDATE OF estado ON riesgos FOR EACH ROW EXECUTE FUNCTION qms_record_event('riesgos','Inactivo,Cerrado');
ALTER TABLE qms_case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_event_read ON qms_case_events FOR SELECT TO authenticated USING (
 (module='quejas' AND EXISTS(SELECT 1 FROM quejas WHERE id=case_id)) OR
 (module='sacp' AND EXISTS(SELECT 1 FROM acciones WHERE id=case_id)) OR
 (module='documentos' AND EXISTS(SELECT 1 FROM documentos WHERE id=case_id)) OR
 (module='riesgos' AND EXISTS(SELECT 1 FROM riesgos WHERE id=case_id))
);
GRANT SELECT ON qms_case_events TO authenticated;
REVOKE ALL ON FUNCTION qms_record_event() FROM PUBLIC;

-- Una fuente de clasificación para tablas y dashboard. Otras áreas conservan
-- sus fechas manuales; no se les inventan reglas por etapa ni umbrales de alerta.
CREATE VIEW qms_work_items WITH(security_invoker=true) AS
 SELECT id,'quejas'::text AS module,folio,cliente_nombre AS title,categoria,estado_nombre AS state,estado_color AS color,prioridad,
 plazo_vence AS due,plazo_situacion AS situation,plazo_dias AS days,plazo_etapa AS stage
 FROM qms_quejas WHERE estado NOT IN ('Finalizado','No Procede','Cerrada')
 UNION ALL SELECT id,'sacp',folio,descripcion,tipo,estado,'primary',prioridad,fecha_limite::timestamptz,
 qms_classify(fecha_limite::date+time '23:59:59.999999' AT TIME ZONE 'America/Costa_Rica',NULL),
 fecha_limite::date-(now() AT TIME ZONE 'America/Costa_Rica')::date,NULL FROM acciones WHERE estado<>'Cerrada'
 UNION ALL SELECT id,'documentos',NULL,titulo,NULL,estado,'secondary',NULL,NULL,'unconfigured',NULL,NULL FROM documentos WHERE estado IN ('Borrador','En Revisión')
 UNION ALL SELECT id,'riesgos',folio,descripcion,NULL,estado,'warning',NULL,NULL,'unconfigured',NULL,NULL FROM riesgos WHERE estado='Activo';
GRANT SELECT ON qms_work_items TO authenticated;
CREATE FUNCTION qms_dashboard(p_module text DEFAULT 'all') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH items AS MATERIALIZED(SELECT * FROM qms_work_items WHERE p_module='all' OR module=p_module),
 buckets AS (SELECT situation,count(*) AS total FROM items GROUP BY situation),
 modules AS (SELECT module AS label,count(*) AS total FROM items GROUP BY module),
 states AS (SELECT estado_nombre AS label,estado_color AS color,count(*) AS total FROM qms_quejas GROUP BY estado_nombre,estado_color),
 categories AS (SELECT coalesce(categoria,'Sin categoría') AS label,'info' AS color,count(*) AS total FROM qms_quejas GROUP BY categoria),
 timeline AS (SELECT to_char(occurred_at AT TIME ZONE 'America/Costa_Rica','YYYY-MM') AS month,
 count(*) FILTER(WHERE kind='opened') AS opened,
 count(*) FILTER(WHERE kind=CASE WHEN p_module='quejas' THEN 'resolved' ELSE 'closed' END) AS closed
 FROM qms_case_events WHERE (p_module='all' OR module=p_module) AND occurred_at>=now()-interval '12 months'
 GROUP BY 1 HAVING count(*) FILTER(WHERE kind IN ('opened',CASE WHEN p_module='quejas' THEN 'resolved' ELSE 'closed' END))>0),
 attention AS (SELECT * FROM items WHERE situation IN ('overdue','today','soon') OR (module='quejas' AND state=(SELECT valor FROM catalogos WHERE modulo='quejas' AND codigo='quality_review' LIMIT 1))
 ORDER BY CASE situation WHEN 'overdue' THEN 0 WHEN 'today' THEN 1 WHEN 'soon' THEN 2 ELSE 3 END,due NULLS LAST,id LIMIT 25),
 stages AS (SELECT s.*,v.duration,v.day_type,v.alerts,v.id AS version,
 (SELECT coalesce(jsonb_object_agg(b.situation,b.total),'{}') FROM (SELECT situation,count(*) total FROM items WHERE stage=s.id GROUP BY situation)b) AS buckets
 FROM qms_stages s CROSS JOIN LATERAL(SELECT * FROM qms_stage_versions WHERE stage_id=s.id ORDER BY id DESC LIMIT 1)v),
 current_month AS(SELECT count(*) FILTER(WHERE kind='opened') AS received,count(*) FILTER(WHERE kind='resolved') AS resolved FROM qms_case_events WHERE module='quejas' AND occurred_at>=date_trunc('month',now() AT TIME ZONE 'America/Costa_Rica') AT TIME ZONE 'America/Costa_Rica')
 SELECT jsonb_build_object(
 'as_of',now(),'buckets',coalesce((SELECT jsonb_object_agg(situation,total) FROM buckets),'{}'),
 'modules',coalesce((SELECT jsonb_agg(m ORDER BY total DESC,label) FROM modules m),'[]'),
 'states',coalesce((SELECT jsonb_agg(s ORDER BY total DESC,label) FROM states s),'[]'),
 'categories',coalesce((SELECT jsonb_agg(c ORDER BY total DESC,label) FROM categories c),'[]'),
 'trend',coalesce((SELECT jsonb_agg(t ORDER BY month) FROM timeline t),'[]'),
 'attention',coalesce((SELECT jsonb_agg(a) FROM attention a),'[]'),
 'stages',coalesce((SELECT jsonb_agg(s ORDER BY id) FROM stages s),'[]'),
 'month',(SELECT to_jsonb(c) FROM current_month c),
 'history_note','Las resoluciones se registran desde esta actualización. Los cierres históricos sin fecha no se reconstruyen. Aperturas incluye reaperturas.'
 );
$$;
REVOKE ALL ON FUNCTION qms_dashboard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qms_dashboard(text) TO authenticated;
COMMIT;

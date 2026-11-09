-- Avisos operativos: mismo transporte/ACK, identidad y calendario propios del evento.
-- Se instala apagado. Activar mediante qms_set_internal_notices(true), nunca con UPDATE.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.qms_internal_notice_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  cutoff_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.qms_internal_notice_settings DEFAULT VALUES;
ALTER TABLE public.qms_internal_notice_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qms_internal_notice_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.qms_internal_notice_settings TO service_role;

ALTER TABLE public.queja_mail_outbox
  ADD COLUMN usuario_id uuid REFERENCES public.usuarios(id),
  ADD COLUMN run_id uuid REFERENCES public.qms_stage_runs(id),
  ADD COLUMN event_key text,
  DROP CONSTRAINT queja_mail_outbox_tipo_check,
  DROP CONSTRAINT queja_mail_outbox_status_check,
  DROP CONSTRAINT queja_mail_outbox_queja_id_tipo_key;
ALTER TABLE public.queja_mail_outbox
  ADD CONSTRAINT queja_mail_outbox_tipo_check CHECK (tipo IN
    ('recibido','investigacion','final','interno_recibido','interno_evaluacion_1',
     'interno_asignacion','interno_investigacion_5','interno_investigacion_3',
     'interno_evaluacion_vencida','interno_investigacion_vencida')),
  ADD CONSTRAINT queja_mail_outbox_status_check CHECK
    (status IN ('pending','leased','retry','sent','uncertain','failed','skipped')),
  ADD CONSTRAINT queja_mail_outbox_audience_check CHECK (
    (tipo IN ('recibido','investigacion','final') AND usuario_id IS NULL AND run_id IS NULL AND event_key IS NULL)
    OR (tipo LIKE 'interno_%' AND usuario_id IS NOT NULL AND run_id IS NOT NULL
      AND event_key IS NOT NULL AND length(event_key) BETWEEN 1 AND 180)),
  ADD CONSTRAINT queja_mail_outbox_skip_check CHECK
    (status <> 'skipped' OR (tipo LIKE 'interno_%' AND safe_error IS NOT DISTINCT FROM 'obsolete_notice'));
CREATE UNIQUE INDEX queja_mail_citizen_once ON public.queja_mail_outbox(queja_id,tipo)
  WHERE tipo IN ('recibido','investigacion','final');
CREATE UNIQUE INDEX queja_mail_internal_once ON public.queja_mail_outbox(event_key,usuario_id)
  WHERE event_key IS NOT NULL;
CREATE INDEX queja_mail_internal_run ON public.queja_mail_outbox(run_id,usuario_id)
  WHERE run_id IS NOT NULL;
CREATE INDEX queja_mail_internal_user ON public.queja_mail_outbox(usuario_id)
  WHERE usuario_id IS NOT NULL;
-- El permiso de lectura previo es por columnas: estas identidades siguen privadas.

CREATE FUNCTION public.qms_internal_notice_eligible(
  p_case uuid,p_user uuid,p_kind text,p_run uuid,p_created timestamptz
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.qms_internal_notice_settings s
   JOIN public.quejas q ON q.id=p_case
   JOIN public.usuarios u ON u.id=p_user AND u.estado='activo'
   JOIN public.qms_stage_runs r ON r.id=p_run AND r.case_id=q.id AND r.ended_at IS NULL
   WHERE s.singleton AND s.enabled AND p_created>=s.cutoff_at
     AND r.provenance='configured' AND r.calendar_id IS NOT NULL
     AND r.snapshot->'rule'->>'day_type'='business_days'
     AND q.estado IN ('Recibido','En Investigación','Pendiente de Revisión GC')
     AND CASE
       WHEN p_kind IN ('interno_recibido','interno_evaluacion_1','interno_investigacion_5') THEN u.rol='calidad'
       WHEN p_kind='interno_asignacion' THEN u.id=q.responsable_id
       WHEN p_kind IN ('interno_investigacion_3','interno_evaluacion_vencida','interno_investigacion_vencida')
         THEN u.rol='calidad' OR u.id=q.responsable_id
       ELSE false END
     AND CASE
       WHEN p_kind IN ('interno_recibido','interno_evaluacion_1','interno_evaluacion_vencida')
         THEN r.stage_id='quejas.evaluation' AND q.estado='Recibido'
       ELSE r.stage_id='quejas.investigation' AND q.estado IN ('En Investigación','Pendiente de Revisión GC') END
     AND CASE
       WHEN p_kind IN ('interno_evaluacion_vencida','interno_investigacion_vencida') THEN r.expires_at<now()
       WHEN p_kind IN ('interno_evaluacion_1','interno_investigacion_5','interno_investigacion_3') THEN
         r.expires_at>=now() AND
         (now() AT TIME ZONE 'America/Costa_Rica')::date =
         (public.qms_complaint_notice_due(r.expires_at,
           CASE p_kind WHEN 'interno_evaluacion_1' THEN 1 WHEN 'interno_investigacion_5' THEN 5 ELSE 3 END,
           'business_days',r.calendar_id) AT TIME ZONE 'America/Costa_Rica')::date
       ELSE true END
 );
$function$;

CREATE FUNCTION public.qms_enqueue_internal_notice(
  p_case uuid,p_kind text,p_run uuid,p_key text,p_message text,p_owner_only boolean DEFAULT false
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE q public.quejas; inserted integer;
BEGIN
  SELECT * INTO q FROM public.quejas WHERE id=p_case;
  -- Una fila del outbox es también el registro de deduplicación de su campana.
  WITH added AS (
    INSERT INTO public.queja_mail_outbox(queja_id,tipo,destinatario,folio,estado,usuario_id,run_id,event_key)
    SELECT q.id,p_kind,lower(btrim(u.email)),q.folio,q.estado,u.id,p_run,p_key
    FROM public.usuarios u
    WHERE public.qms_internal_notice_eligible(q.id,u.id,p_kind,p_run,now())
      AND (NOT p_owner_only OR u.id=q.responsable_id)
      AND length(btrim(u.email)) BETWEEN 3 AND 254
      AND btrim(u.email) ~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
    ON CONFLICT (event_key,usuario_id) WHERE event_key IS NOT NULL DO NOTHING
    RETURNING usuario_id
  ), bells AS (
    INSERT INTO public.notificaciones(usuario_id,fecha,tipo,mensaje,enlace,origen_id)
    SELECT a.usuario_id,now(),CASE WHEN p_kind='interno_recibido' THEN 'queja_nueva' ELSE p_kind END,
      p_message,CASE WHEN u.rol IN ('admin','calidad') THEN '/quejas' ELSE '/mis-quejas' END,q.id::text
    FROM added a JOIN public.usuarios u ON u.id=a.usuario_id
    RETURNING 1
  ) SELECT count(*)::integer INTO inserted FROM bells;
  RETURN inserted;
END;
$function$;

-- Añade únicamente avisos futuros al calendario conocido; no toca snapshot ni expires_at.
CREATE FUNCTION public.qms_schedule_internal_run(p_run uuid,p_cutoff timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE r public.qms_stage_runs; a integer; d timestamptz;
BEGIN
  SELECT * INTO r FROM public.qms_stage_runs WHERE id=p_run;
  IF r.id IS NULL OR r.ended_at IS NOT NULL OR r.provenance<>'configured'
      OR r.calendar_id IS NULL OR r.snapshot->'rule'->>'day_type' IS DISTINCT FROM 'business_days'
      OR r.stage_id NOT IN ('quejas.evaluation','quejas.investigation') THEN RETURN; END IF;
  FOREACH a IN ARRAY CASE WHEN r.stage_id='quejas.evaluation' THEN ARRAY[1,0] ELSE ARRAY[5,3,0] END LOOP
    d := CASE WHEN a=0 THEN r.expires_at+interval '1 microsecond'
      ELSE public.qms_complaint_notice_due(r.expires_at,a,'business_days',r.calendar_id) END;
    IF d>=p_cutoff THEN
      INSERT INTO public.qms_deadline_notices(run_id,offset_days,due_at) VALUES(r.id,a,d)
      ON CONFLICT (run_id,offset_days) DO UPDATE SET due_at=EXCLUDED.due_at
        WHERE public.qms_deadline_notices.processed_at IS NULL;
    END IF;
  END LOOP;
END;
$function$;

CREATE FUNCTION public.qms_set_internal_notices(p_enabled boolean)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE s public.qms_internal_notice_settings; r record;
BEGIN
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Configuración inválida.' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.qms_internal_notice_settings WHERE singleton FOR UPDATE;
  IF p_enabled AND NOT s.enabled THEN
    s.cutoff_at := clock_timestamp();
    UPDATE public.qms_internal_notice_settings SET enabled=true,cutoff_at=s.cutoff_at WHERE singleton;
    -- Los pendientes previos al corte son historia, no una campaña de correo al activar.
    UPDATE public.qms_deadline_notices a SET processed_at=now()
      WHERE a.processed_at IS NULL AND a.due_at<s.cutoff_at AND EXISTS (
        SELECT 1 FROM public.qms_stage_runs sr WHERE sr.id=a.run_id
          AND sr.stage_id IN ('quejas.evaluation','quejas.investigation'));
    FOR r IN SELECT id FROM public.qms_stage_runs WHERE ended_at IS NULL
      AND stage_id IN ('quejas.evaluation','quejas.investigation') ORDER BY case_id LOOP
      PERFORM public.qms_schedule_internal_run(r.id,s.cutoff_at);
    END LOOP;
  ELSE
    UPDATE public.qms_internal_notice_settings SET enabled=p_enabled WHERE singleton;
  END IF;
  RETURN s.cutoff_at;
END;
$function$;

CREATE FUNCTION public.qms_internal_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE run uuid;
BEGIN
  IF NEW.responsable_id IS NULL OR NEW.responsable_id IS NOT DISTINCT FROM OLD.responsable_id
      OR NEW.estado NOT IN ('En Investigación','Pendiente de Revisión GC') THEN RETURN NEW; END IF;
  SELECT id INTO run FROM public.qms_stage_runs WHERE case_id=NEW.id AND ended_at IS NULL;
  PERFORM public.qms_enqueue_internal_notice(NEW.id,'interno_asignacion',run,
    'assignment:'||NEW.id::text||':'||NEW.revision::text,
    'Se te asignó la queja '||NEW.folio||'. Consultá su plazo de investigación.',true);
  RETURN NEW;
END;
$function$;
CREATE TRIGGER qms_internal_assignment AFTER UPDATE OF responsable_id ON public.quejas
  FOR EACH ROW EXECUTE FUNCTION public.qms_internal_assignment();

CREATE OR REPLACE FUNCTION public.qms_enqueue_complaint_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE kind text; recipient text;
BEGIN
  IF TG_OP='INSERT' AND NEW.estado='Recibido' THEN kind:='recibido';
  ELSIF TG_OP='UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    kind:=CASE WHEN NEW.estado='En Investigación' THEN 'investigacion'
      WHEN NEW.estado IN ('Resuelto','No Procede') THEN 'final' END;
  END IF;
  IF kind IS NULL THEN RETURN NEW; END IF;
  recipient:=lower(btrim(coalesce(NEW.email_cliente,'')));
  IF length(recipient) NOT BETWEEN 3 AND 254 OR
      recipient !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' THEN RETURN NEW; END IF;
  INSERT INTO public.queja_mail_outbox(queja_id,tipo,destinatario,folio,estado,numero_oficio)
    VALUES(NEW.id,kind,recipient,NEW.folio,NEW.estado,NEW.numero_oficio_resolucion)
    ON CONFLICT (queja_id,tipo) WHERE tipo IN ('recibido','investigacion','final') DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qms_process_notices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE c record; n record; kind text; message text; delivered integer:=0;
  processed integer:=0; cutoff timestamptz;
BEGIN
  SELECT cutoff_at INTO cutoff FROM public.qms_internal_notice_settings WHERE singleton AND enabled;
  IF cutoff IS NULL THEN RETURN 0; END IF;
  -- El workflow toma queja antes de run. Mantener ese orden evita deadlocks con un cierre.
  <<cases>>
  FOR c IN SELECT q.id,q.folio FROM public.quejas q WHERE EXISTS (
    SELECT 1 FROM public.qms_stage_runs r JOIN public.qms_deadline_notices a ON a.run_id=r.id
    WHERE r.case_id=q.id AND a.processed_at IS NULL AND a.due_at<=now()
  ) ORDER BY q.id LIMIT 250 FOR UPDATE OF q SKIP LOCKED LOOP
    FOR n IN SELECT a.*,r.stage_id,r.expires_at,r.ended_at FROM public.qms_stage_runs r
      JOIN public.qms_deadline_notices a ON a.run_id=r.id
      WHERE r.case_id=c.id AND a.processed_at IS NULL AND a.due_at<=now()
      ORDER BY a.due_at,a.id LIMIT (250-processed) FOR UPDATE OF a SKIP LOCKED LOOP
      kind:=CASE
        WHEN n.stage_id='quejas.evaluation' AND n.offset_days=1 THEN 'interno_evaluacion_1'
        WHEN n.stage_id='quejas.evaluation' AND n.offset_days=0 THEN 'interno_evaluacion_vencida'
        WHEN n.stage_id='quejas.investigation' AND n.offset_days=5 THEN 'interno_investigacion_5'
        WHEN n.stage_id='quejas.investigation' AND n.offset_days=3 THEN 'interno_investigacion_3'
        WHEN n.stage_id='quejas.investigation' AND n.offset_days=0 THEN 'interno_investigacion_vencida' END;
      IF kind IS NOT NULL AND n.ended_at IS NULL AND n.due_at>=cutoff THEN
        message:=CASE WHEN n.offset_days=0 THEN 'Venció el plazo de '
          ELSE 'Faltan '||n.offset_days::text||CASE WHEN n.offset_days=1 THEN ' día hábil de ' ELSE ' días hábiles de ' END END
          ||CASE WHEN n.stage_id='quejas.evaluation' THEN 'evaluación' ELSE 'investigación' END||' de la queja '||c.folio||'.';
        delivered:=delivered+public.qms_enqueue_internal_notice(c.id,kind,n.run_id,
          'deadline:'||n.run_id::text||':'||n.offset_days::text,message);
      END IF;
      UPDATE public.qms_deadline_notices SET processed_at=now() WHERE id=n.id;
      processed:=processed+1;
      IF processed>=250 THEN EXIT cases; END IF;
    END LOOP;
  END LOOP;
  RETURN delivered;
END;
$function$;

-- Una configuración nueva cambia alertas futuras, jamás el plazo de un expediente abierto.
DO $rules$
DECLARE previous public.qms_stage_versions; desired integer[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('qms.config',0));
  FOR previous IN SELECT DISTINCT ON (stage_id) * FROM public.qms_stage_versions
    WHERE stage_id IN ('quejas.evaluation','quejas.investigation') ORDER BY stage_id,id DESC LOOP
    desired:=CASE WHEN previous.stage_id='quejas.evaluation' THEN ARRAY[1] ELSE ARRAY[5,3] END;
    IF previous.day_type='business_days' AND (previous.alerts IS DISTINCT FROM desired
        OR previous.expiration_action IS DISTINCT FROM 'notify_quality') THEN
      INSERT INTO public.qms_stage_versions(stage_id,duration,day_type,alerts,expiration_action,created_by)
        VALUES(previous.stage_id,previous.duration,previous.day_type,desired,'notify_quality',NULL);
      INSERT INTO public.qms_config_audit(entity,old_value,new_value,reason,actor_id)
        SELECT previous.stage_id,to_jsonb(previous),to_jsonb(v),'Calendario de avisos internos aprobado por ECA',NULL
        FROM public.qms_stage_versions v WHERE v.stage_id=previous.stage_id ORDER BY v.id DESC LIMIT 1;
    END IF;
  END LOOP;
END;
$rules$;

-- El endpoint anterior sigue siendo compatible: solo reclama los tres correos ciudadanos.
CREATE OR REPLACE FUNCTION public.qms_mail_claim_batch(
  p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint
) RETURNS TABLE(id uuid,claim_token uuid,tipo text,destinatario text,folio text,estado text,numero_oficio text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE inserted integer; moment bigint:=floor(extract(epoch FROM now()))::bigint;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 60 AND 600
      OR p_run_nonce IS NULL OR p_issued_at IS NULL OR p_issued_at<moment-300 OR p_issued_at>moment+30 THEN
    RAISE EXCEPTION 'Solicitud de worker inválida.' USING ERRCODE='22023';
  END IF;
  DELETE FROM public.queja_mail_run_nonces WHERE nonce IN
    (SELECT n.nonce FROM public.queja_mail_run_nonces n WHERE n.expires_at<now() ORDER BY n.expires_at LIMIT 1000);
  INSERT INTO public.queja_mail_run_nonces VALUES(p_run_nonce,now()+interval '10 minutes') ON CONFLICT(nonce) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=0 THEN RETURN; END IF;
  UPDATE public.queja_mail_outbox SET status='uncertain',safe_error='lease_expired',updated_at=now()
    WHERE status='leased' AND lease_until<=now();
  UPDATE public.queja_mail_outbox SET status='failed',safe_error='attempt_limit',updated_at=now()
    WHERE status IN ('pending','retry') AND attempts>=12;
  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM public.queja_mail_outbox o
    WHERE o.tipo IN ('recibido','investigacion','final') AND o.status IN ('pending','retry')
      AND o.next_attempt_at<=now() AND o.attempts<12
      AND NOT EXISTS(SELECT 1 FROM public.queja_mail_outbox prior WHERE prior.queja_id=o.queja_id
        AND prior.tipo IN ('recibido','investigacion','final') AND prior.status<>'sent'
        AND CASE prior.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END
          < CASE o.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END)
    ORDER BY o.next_attempt_at,o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.queja_mail_outbox o SET status='leased',claim_token=gen_random_uuid(),
      lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio FROM claimed c;
END;
$function$;

CREATE FUNCTION public.qms_internal_delivery_eligible(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.queja_mail_outbox o
   JOIN public.usuarios u ON u.id=o.usuario_id
   WHERE o.id=p_id AND o.destinatario=lower(btrim(u.email))
     AND public.qms_internal_notice_eligible(o.queja_id,o.usuario_id,o.tipo,o.run_id,o.created_at)
     AND (o.tipo<>'interno_asignacion' OR NOT EXISTS (
       SELECT 1 FROM public.queja_mail_outbox newer WHERE newer.queja_id=o.queja_id
         AND newer.tipo='interno_asignacion'
         AND split_part(newer.event_key,':',3)::bigint>split_part(o.event_key,':',3)::bigint))
 );
$function$;

CREATE FUNCTION public.qms_mail_authorize(p_id uuid,p_claim_token uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
 SELECT EXISTS (SELECT 1 FROM public.queja_mail_outbox o
   WHERE o.id=p_id AND o.claim_token=p_claim_token AND o.status='leased' AND o.lease_until>now()
     AND public.qms_internal_delivery_eligible(o.id));
$function$;

CREATE FUNCTION public.qms_mail_claim_batch_v2(
  p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint
) RETURNS TABLE(id uuid,claim_token uuid,tipo text,destinatario text,folio text,estado text,numero_oficio text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE inserted integer; moment bigint:=floor(extract(epoch FROM now()))::bigint;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 0 AND 5 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 60 AND 600
      OR p_run_nonce IS NULL OR p_issued_at IS NULL OR p_issued_at<moment-300 OR p_issued_at>moment+30 THEN
    RAISE EXCEPTION 'Solicitud de worker inválida.' USING ERRCODE='22023';
  END IF;
  DELETE FROM public.queja_mail_run_nonces WHERE nonce IN
    (SELECT n.nonce FROM public.queja_mail_run_nonces n WHERE n.expires_at<now() ORDER BY n.expires_at LIMIT 1000);
  INSERT INTO public.queja_mail_run_nonces VALUES(p_run_nonce,now()+interval '10 minutes') ON CONFLICT(nonce) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=0 THEN RETURN; END IF;
  PERFORM public.qms_process_notices();
  -- Sin cuota/diario de MailApp el poll sigue produciendo campanas, sin reservar envíos.
  IF p_limit=0 THEN RETURN; END IF;
  -- Nunca se reenvía una reserva incierta, tampoco si el destinatario ya cambió.
  UPDATE public.queja_mail_outbox SET status='uncertain',safe_error='lease_expired',updated_at=now()
    WHERE status='leased' AND lease_until<=now();
  UPDATE public.queja_mail_outbox SET status='failed',safe_error='attempt_limit',updated_at=now()
    WHERE status IN ('pending','retry') AND attempts>=12;
  UPDATE public.queja_mail_outbox o SET status='skipped',safe_error='obsolete_notice',updated_at=now()
    WHERE o.tipo LIKE 'interno_%' AND o.status IN ('pending','retry')
      AND NOT public.qms_internal_delivery_eligible(o.id);
  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM public.queja_mail_outbox o WHERE o.status IN ('pending','retry')
      AND o.next_attempt_at<=now() AND o.attempts<12
      AND (o.tipo LIKE 'interno_%' OR NOT EXISTS (
        SELECT 1 FROM public.queja_mail_outbox prior WHERE prior.queja_id=o.queja_id
          AND prior.tipo IN ('recibido','investigacion','final') AND prior.status<>'sent'
          AND CASE prior.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END
            < CASE o.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END))
    ORDER BY o.next_attempt_at,o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.queja_mail_outbox o SET status='leased',claim_token=gen_random_uuid(),
      lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio FROM claimed c;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qms_mail_complete(
  p_id uuid,p_claim_token uuid,p_outcome text,p_retry_delay_seconds integer,p_safe_error text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE affected integer;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent','retry','uncertain','failed','skipped')
      OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds NOT BETWEEN 60 AND 86400
      OR (p_safe_error IS NOT NULL AND p_safe_error !~ '^[a-z_]{1,60}$')
      OR (p_outcome='skipped' AND p_safe_error IS DISTINCT FROM 'obsolete_notice') THEN
    RAISE EXCEPTION 'Resultado de worker inválido.' USING ERRCODE='22023';
  END IF;
  UPDATE public.queja_mail_outbox o SET status=p_outcome,
    next_attempt_at=CASE WHEN p_outcome='retry' THEN now()+make_interval(secs=>p_retry_delay_seconds) ELSE o.next_attempt_at END,
    sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE o.sent_at END,
    safe_error=CASE WHEN p_outcome='sent' THEN NULL ELSE p_safe_error END,
    claim_token=NULL,lease_until=NULL,updated_at=now()
  WHERE o.id=p_id AND o.claim_token=p_claim_token AND o.status='leased' AND o.lease_until>now()
    AND (p_outcome<>'skipped' OR o.tipo LIKE 'interno_%');
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END;
$function$;

REVOKE ALL ON FUNCTION public.qms_internal_notice_eligible(uuid,uuid,text,uuid,timestamptz),
  public.qms_enqueue_internal_notice(uuid,text,uuid,text,text,boolean),
  public.qms_schedule_internal_run(uuid,timestamptz),public.qms_set_internal_notices(boolean),
  public.qms_internal_assignment(),public.qms_process_notices(),
  public.qms_internal_delivery_eligible(uuid),
  public.qms_mail_authorize(uuid,uuid),public.qms_mail_claim_batch_v2(integer,integer,uuid,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qms_set_internal_notices(boolean),public.qms_process_notices(),
  public.qms_mail_authorize(uuid,uuid),public.qms_mail_claim_batch_v2(integer,integer,uuid,bigint) TO service_role;

-- Entrada común: alta interna ya persistida o finalización pública tras los adjuntos.
CREATE OR REPLACE FUNCTION public.notificar_queja_publica(p_folio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE q public.quejas; run uuid; operational boolean;
BEGIN
 SELECT * INTO q FROM public.quejas WHERE folio=p_folio FOR UPDATE;
 IF q.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada.'; END IF;
 IF EXISTS(SELECT 1 FROM public.notificaciones WHERE tipo='queja_nueva' AND origen_id=q.id::text) THEN RETURN; END IF;
 SELECT s.enabled AND q.fecha>=s.cutoff_at INTO operational FROM public.qms_internal_notice_settings s WHERE singleton;
 SELECT id INTO run FROM public.qms_stage_runs WHERE case_id=q.id AND ended_at IS NULL;
 IF operational THEN
   PERFORM public.qms_enqueue_internal_notice(q.id,'interno_recibido',run,'received:'||q.id::text,
     'Nueva queja '||q.folio||' recibida. El plazo de evaluación es de 3 días hábiles.');
 END IF;
 -- Conserva la campana del administrador y el comportamiento original mientras está apagado.
 INSERT INTO public.notificaciones(usuario_id,fecha,tipo,mensaje,enlace,origen_id)
 SELECT u.id,now(),'queja_nueva','Nueva queja '||q.folio||' registrada: '||coalesce(q.categoria,''),'/quejas',q.id::text
 FROM public.usuarios u WHERE u.estado='activo' AND
   (u.rol='admin' OR (u.rol='calidad' AND NOT coalesce(operational,false)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_queja_interna(p_cliente_nombre text, p_email_cliente text, p_categoria text, p_descripcion text, p_prioridad text)
 RETURNS quejas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
 PERFORM public.notificar_queja_publica(q.folio);
 RETURN q;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transicionar_queja(p_queja_id uuid, p_nuevo_estado text, p_resolucion text DEFAULT NULL::text, p_justificacion_procede text DEFAULT NULL::text, p_responsable_id uuid DEFAULT NULL::uuid, p_motivo_reapertura text DEFAULT NULL::text)
 RETURNS quejas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
 v_queja public.quejas;
 v_usuario_id uuid;
 v_es_staff boolean;
 v_es_responsable boolean;
 v_destino record;
 v_mensaje text;
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
 IF NOT v_es_staff THEN RAISE EXCEPTION 'Solo el personal de calidad puede iniciar la investigación'; END IF;
 UPDATE public.quejas
 SET estado = p_nuevo_estado,
 fecha_limite_investigacion = now() + interval '15 days',
 responsable_id = COALESCE(p_responsable_id, responsable_id),
 notas = CASE WHEN btrim(COALESCE(p_justificacion_procede, '')) <> ''
 THEN COALESCE(notas, '') || E'\n[Procede] ' || btrim(p_justificacion_procede)
 ELSE notas END
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
 AND NOT EXISTS (SELECT 1 FROM public.queja_mail_outbox o
   WHERE o.usuario_id=usuarios.id AND o.tipo='interno_asignacion'
     AND o.event_key='assignment:'||v_queja.id::text||':'||v_queja.revision::text)
 LOOP
 INSERT INTO public.notificaciones (usuario_id, fecha, tipo, mensaje, enlace, origen_id)
 VALUES (v_destino.id, now(), 'queja_estado', v_mensaje, '/quejas', v_queja.id);
 END LOOP;

 INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
 VALUES (now(), v_usuario_id, 'transición', 'quejas', v_mensaje);
 RETURN v_queja;
END;
$function$;


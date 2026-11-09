-- Dos comunicaciones ciudadanas: recepción y resultado final. Los avisos internos
-- conservan sus hitos, autorización y ACK. Pausar el poll y comprobar reservas
-- activas antes del corte: esta migración no puede deshacer un MailApp ya iniciado.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Los IDs y snapshots históricos de investigación se conservan. Solo los eventos
-- que aún no se han reservado pueden retirarse con un motivo terminal explícito.
ALTER TABLE public.queja_mail_outbox DROP CONSTRAINT queja_mail_outbox_skip_check;
ALTER TABLE public.queja_mail_outbox ADD CONSTRAINT queja_mail_outbox_skip_check CHECK (
  status <> 'skipped'
  OR (tipo LIKE 'interno_%' AND safe_error IS NOT DISTINCT FROM 'obsolete_notice')
  OR (tipo = 'investigacion' AND safe_error IS NOT DISTINCT FROM 'citizen_notice_retired')
);
UPDATE public.queja_mail_outbox
  SET status='skipped',safe_error='citizen_notice_retired',claim_token=NULL,lease_until=NULL,updated_at=now()
  WHERE tipo='investigacion' AND status IN ('pending','retry');

CREATE OR REPLACE FUNCTION public.qms_enqueue_complaint_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE kind text; recipient text;
BEGIN
  IF TG_OP='INSERT' AND NEW.estado='Recibido' THEN kind:='recibido';
  ELSIF TG_OP='UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado
      AND NEW.estado IN ('Resuelto','No Procede') THEN kind:='final';
  END IF;
  IF kind IS NULL THEN RETURN NEW; END IF;
  recipient:=lower(btrim(coalesce(NEW.email_cliente,'')));
  IF length(recipient) NOT BETWEEN 3 AND 254 OR
      recipient !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' THEN RETURN NEW; END IF;
  INSERT INTO public.queja_mail_outbox(queja_id,tipo,destinatario,folio,estado,numero_oficio)
    VALUES(NEW.id,kind,recipient,NEW.folio,NEW.estado,NEW.numero_oficio_resolucion)
    -- Coincide con el índice histórico; no reescribir folios, tipos ni mensajes anteriores.
    ON CONFLICT (queja_id,tipo) WHERE tipo IN ('recibido','investigacion','final') DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Mantener la firma y ACL del worker legacy. La investigación retirada nunca se
-- reclama ni bloquea el resultado final, incluso si su envío histórico es incierto.
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
    WHERE o.tipo IN ('recibido','final') AND o.status IN ('pending','retry')
      AND o.next_attempt_at<=now() AND o.attempts<12
      AND NOT EXISTS(SELECT 1 FROM public.queja_mail_outbox prior WHERE prior.queja_id=o.queja_id
        AND o.tipo='final' AND prior.tipo='recibido' AND prior.status<>'sent')
    ORDER BY o.next_attempt_at,o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.queja_mail_outbox o SET status='leased',claim_token=gen_random_uuid(),
      lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio FROM claimed c;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qms_mail_claim_batch_v2(
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
  -- Claim cero conserva campanas y recordatorios, sin reservar ningún correo.
  IF p_limit=0 THEN RETURN; END IF;
  UPDATE public.queja_mail_outbox SET status='uncertain',safe_error='lease_expired',updated_at=now()
    WHERE status='leased' AND lease_until<=now();
  UPDATE public.queja_mail_outbox SET status='failed',safe_error='attempt_limit',updated_at=now()
    WHERE status IN ('pending','retry') AND attempts>=12;
  UPDATE public.queja_mail_outbox o SET status='skipped',safe_error='obsolete_notice',updated_at=now()
    WHERE o.tipo LIKE 'interno_%' AND o.status IN ('pending','retry')
      AND NOT public.qms_internal_delivery_eligible(o.id);
  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM public.queja_mail_outbox o
    WHERE (o.tipo IN ('recibido','final') OR o.tipo LIKE 'interno_%')
      AND o.status IN ('pending','retry') AND o.next_attempt_at<=now() AND o.attempts<12
      AND (o.tipo LIKE 'interno_%' OR NOT EXISTS (
        SELECT 1 FROM public.queja_mail_outbox prior WHERE prior.queja_id=o.queja_id
          AND o.tipo='final' AND prior.tipo='recibido' AND prior.status<>'sent'))
    ORDER BY o.next_attempt_at,o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.queja_mail_outbox o SET status='leased',claim_token=gen_random_uuid(),
      lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio FROM claimed c;
END;
$function$;

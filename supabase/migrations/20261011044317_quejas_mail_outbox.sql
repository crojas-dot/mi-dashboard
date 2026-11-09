-- Tres avisos ciudadanos. No migra correos históricos ni activa un proveedor.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.queja_mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queja_id uuid NOT NULL REFERENCES public.quejas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('recibido','investigacion','final')),
  destinatario text NOT NULL CHECK (length(destinatario) BETWEEN 3 AND 254
    AND destinatario ~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'),
  folio text NOT NULL CHECK (length(folio) BETWEEN 1 AND 120),
  estado text,
  numero_oficio text CHECK (length(numero_oficio) <= 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','retry','sent','uncertain','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  safe_error text CHECK (safe_error IS NULL OR safe_error ~ '^[a-z_]{1,60}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queja_id,tipo),
  CHECK (tipo <> 'final' OR estado IN ('Resuelto','No Procede'))
);
CREATE INDEX queja_mail_due ON public.queja_mail_outbox(next_attempt_at,id)
  WHERE status IN ('pending','retry');
CREATE INDEX queja_mail_case ON public.queja_mail_outbox(queja_id,created_at);
CREATE TABLE public.queja_mail_run_nonces (
  nonce uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX queja_mail_nonces_expiry ON public.queja_mail_run_nonces(expires_at);
ALTER TABLE public.queja_mail_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queja_mail_run_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queja_mail_outbox,public.queja_mail_run_nonces FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.queja_mail_outbox,public.queja_mail_run_nonces TO service_role;
-- El cliente solo puede consultar el resultado; nunca destinatarios, claims ni escritura.
GRANT SELECT(id,queja_id,tipo,status,attempts,sent_at,safe_error,created_at,updated_at)
  ON public.queja_mail_outbox TO authenticated;
CREATE POLICY queja_mail_staff_read ON public.queja_mail_outbox FOR SELECT TO authenticated
  USING ((SELECT public.app_es_admin()) OR
    ((SELECT public.app_es_staff()) AND (SELECT public.app_tiene_permiso('quejas',false))));

CREATE FUNCTION public.qms_enqueue_complaint_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE kind text; recipient text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.estado = 'Recibido' THEN kind := 'recibido';
  ELSIF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    kind := CASE WHEN NEW.estado = 'En Investigación' THEN 'investigacion'
      WHEN NEW.estado IN ('Resuelto','No Procede') THEN 'final' END;
  END IF;
  IF kind IS NULL THEN RETURN NEW; END IF;
  recipient := lower(btrim(coalesce(NEW.email_cliente,'')));
  -- Históricos sin dirección válida siguen editables; no crear un envío incorrecto.
  IF length(recipient) NOT BETWEEN 3 AND 254 OR
      recipient !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' THEN RETURN NEW; END IF;
  INSERT INTO public.queja_mail_outbox(queja_id,tipo,destinatario,folio,estado,numero_oficio)
    VALUES(NEW.id,kind,recipient,NEW.folio,NEW.estado,NEW.numero_oficio_resolucion)
    ON CONFLICT (queja_id,tipo) DO NOTHING;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_enqueue_complaint_mail() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER qms_complaint_mail AFTER INSERT OR UPDATE OF estado ON public.quejas
  FOR EACH ROW EXECUTE FUNCTION public.qms_enqueue_complaint_mail();

CREATE FUNCTION public.qms_mail_claim_batch(
  p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint
) RETURNS TABLE(id uuid,claim_token uuid,tipo text,destinatario text,folio text,estado text,numero_oficio text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE inserted integer; moment bigint := floor(extract(epoch FROM now()))::bigint;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 60 AND 600
      OR p_run_nonce IS NULL OR p_issued_at IS NULL OR p_issued_at < moment - 300 OR p_issued_at > moment + 30 THEN
    RAISE EXCEPTION 'Solicitud de worker inválida.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.queja_mail_run_nonces WHERE nonce IN
    (SELECT n.nonce FROM public.queja_mail_run_nonces n WHERE n.expires_at < now() ORDER BY n.expires_at LIMIT 1000);
  INSERT INTO public.queja_mail_run_nonces VALUES(p_run_nonce,now()+interval '10 minutes')
    ON CONFLICT (nonce) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN RETURN; END IF;
  -- Un lease vencido no demuestra que el proveedor no envió. Revisión, nunca reenvío ciego.
  UPDATE public.queja_mail_outbox o SET status='uncertain',safe_error='lease_expired',updated_at=now()
    WHERE o.status='leased' AND o.lease_until <= now();
  UPDATE public.queja_mail_outbox o SET status='failed',safe_error='attempt_limit',updated_at=now()
    WHERE o.status IN ('pending','retry') AND o.attempts >= 12;
  RETURN QUERY WITH candidates AS (
    SELECT o.id FROM public.queja_mail_outbox o
    WHERE o.status IN ('pending','retry') AND o.next_attempt_at <= now() AND o.attempts < 12
      AND NOT EXISTS (SELECT 1 FROM public.queja_mail_outbox prior WHERE prior.queja_id=o.queja_id
        AND prior.status <> 'sent'
        AND CASE prior.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END
          < CASE o.tipo WHEN 'recibido' THEN 1 WHEN 'investigacion' THEN 2 ELSE 3 END)
    ORDER BY o.next_attempt_at,o.id FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.queja_mail_outbox o SET status='leased',claim_token=gen_random_uuid(),
      lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=o.attempts+1,updated_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio FROM claimed c;
END;
$function$;

CREATE FUNCTION public.qms_mail_complete(
  p_id uuid,p_claim_token uuid,p_outcome text,p_retry_delay_seconds integer,p_safe_error text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE affected integer;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent','retry','uncertain','failed')
    OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds NOT BETWEEN 60 AND 86400
    OR (p_safe_error IS NOT NULL AND p_safe_error !~ '^[a-z_]{1,60}$') THEN
    RAISE EXCEPTION 'Resultado de worker inválido.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.queja_mail_outbox o SET status=p_outcome,
    next_attempt_at=CASE WHEN p_outcome='retry' THEN now()+make_interval(secs=>p_retry_delay_seconds) ELSE o.next_attempt_at END,
    sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE o.sent_at END,
    safe_error=CASE WHEN p_outcome='sent' THEN NULL ELSE p_safe_error END,
    claim_token=NULL,lease_until=NULL,updated_at=now()
    WHERE o.id=p_id AND o.claim_token=p_claim_token AND o.status='leased' AND o.lease_until > now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.qms_mail_claim_batch(integer,integer,uuid,bigint),
  public.qms_mail_complete(uuid,uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qms_mail_claim_batch(integer,integer,uuid,bigint),
  public.qms_mail_complete(uuid,uuid,text,integer,text) TO service_role;

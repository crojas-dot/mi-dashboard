-- Gateway aditivo: aplicar/verificar antes de desplegar cliente/API nuevos.
-- El cierre ciudadano legacy vive en la migración separada de cutover.
CREATE TABLE public.public_form_submissions (
  form_id uuid NOT NULL REFERENCES public.formularios_publicos(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  queja_id uuid UNIQUE REFERENCES public.quejas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz,
  PRIMARY KEY (form_id, submission_id)
);
CREATE TABLE public.public_form_uploads (
  form_id uuid NOT NULL, submission_id uuid NOT NULL, upload_id uuid NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 255),
  tipo_mime text NOT NULL CHECK (tipo_mime IN ('application/pdf','image/jpeg','image/png')),
  tamano integer NOT NULL CHECK (tamano BETWEEN 1 AND 4194304),
  reservation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','committed','released')),
  adjunto_id uuid UNIQUE REFERENCES public.queja_adjuntos(id) ON DELETE SET NULL, storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_id, submission_id, upload_id),
  FOREIGN KEY (form_id, submission_id) REFERENCES public.public_form_submissions(form_id, submission_id) ON DELETE CASCADE,
  CHECK ((status = 'committed' AND storage_path IS NOT NULL) OR (status <> 'committed' AND storage_path IS NULL AND adjunto_id IS NULL))
);
CREATE TABLE public.public_form_rate_limits (
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  operation text NOT NULL CHECK (operation IN ('attempt','accepted','upload')),
  attempts integer NOT NULL CHECK (attempts > 0), reset_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, operation)
);
CREATE INDEX public_form_rate_limits_reset_idx ON public.public_form_rate_limits(reset_at);
ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_form_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_form_rate_limits ENABLE ROW LEVEL SECURITY;
-- service_role ya tiene BYPASSRLS. Sin políticas ni privilegios cliente, tampoco por PUBLIC.
REVOKE ALL ON public.public_form_submissions, public.public_form_uploads, public.public_form_rate_limits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.public_form_submissions, public.public_form_uploads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_form_rate_limits TO service_role;

CREATE FUNCTION public.public_form_consume_rate(p_key_hash text, p_operation text, p_limit integer, p_window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_now timestamptz := clock_timestamp(); v_count integer; v_reset timestamptz;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' OR p_operation IS NULL
     OR p_operation NOT IN ('attempt','accepted','upload') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 60 AND 3600 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PUBLIC_RATE_INPUT_INVALID';
  END IF;
  INSERT INTO public.public_form_rate_limits AS r (key_hash, operation, attempts, reset_at)
  VALUES (p_key_hash, p_operation, 1, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (key_hash, operation) DO UPDATE
    SET attempts = CASE WHEN r.reset_at <= v_now THEN 1 ELSE least(r.attempts + 1, p_limit + 1) END,
        reset_at = CASE WHEN r.reset_at <= v_now THEN v_now + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING attempts, reset_at INTO v_count, v_reset;
  -- Limpieza acotada: no esperar por contadores usados por otra petición.
  DELETE FROM public.public_form_rate_limits WHERE (key_hash, operation) IN (
    SELECT key_hash, operation FROM public.public_form_rate_limits WHERE reset_at < v_now - interval '1 day'
    ORDER BY reset_at LIMIT 100 FOR UPDATE SKIP LOCKED
  );
  RETURN jsonb_build_object('allowed', v_count <= p_limit, 'retry_after',
    CASE WHEN v_count <= p_limit THEN 0 ELSE greatest(1,ceil(extract(epoch FROM v_reset - v_now))::integer) END);
END;
$$;

CREATE FUNCTION public.public_form_create_submission(
  p_form_id uuid, p_form_token text, p_submission_id uuid, p_payload_hash text, p_rate_key_hash text,
  p_cliente_nombre text, p_email_cliente text, p_telefono text, p_categoria text, p_descripcion text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_form public.formularios_publicos%ROWTYPE; v_submission public.public_form_submissions%ROWTYPE;
        v_created boolean; v_folio text; v_queja_id uuid; v_rate jsonb;
BEGIN
  IF p_form_id IS NULL OR p_submission_id IS NULL OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
     OR p_cliente_nombre IS NULL OR length(btrim(p_cliente_nombre)) NOT BETWEEN 1 AND 150
     OR length(coalesce(p_email_cliente,'')) > 254 OR length(coalesce(p_telefono,'')) > 40
     OR p_categoria IS NULL OR p_categoria NOT IN ('Queja','Denuncia','Sugerencia','Reclamo','Felicitación')
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
$$;

CREATE FUNCTION public.public_form_reserve_upload(
  p_form_id uuid, p_submission_id uuid, p_queja_id uuid, p_upload_id uuid,
  p_content_hash text, p_nombre text, p_tipo_mime text, p_tamano bigint
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_submission public.public_form_submissions%ROWTYPE; v_upload public.public_form_uploads%ROWTYPE;
        v_estado text; v_count bigint; v_bytes bigint; v_reserved_count bigint; v_reserved_bytes bigint;
BEGIN
  IF p_upload_id IS NULL OR p_content_hash IS NULL OR p_content_hash !~ '^[0-9a-f]{64}$'
     OR p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 1 AND 255
     OR p_tipo_mime IS NULL OR p_tipo_mime NOT IN ('application/pdf','image/jpeg','image/png')
     OR p_tamano IS NULL OR p_tamano NOT BETWEEN 1 AND 4194304 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PUBLIC_UPLOAD_INPUT_INVALID';
  END IF;
  SELECT s.* INTO v_submission FROM public.public_form_submissions s
  WHERE s.form_id = p_form_id AND s.submission_id = p_submission_id AND s.queja_id = p_queja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_SUBMISSION_UNAVAILABLE'; END IF;
  PERFORM 1 FROM public.formularios_publicos WHERE id = p_form_id AND activo AND modulo = 'quejas' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_FORM_UNAVAILABLE'; END IF;
  SELECT estado INTO v_estado FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'Recibido' THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_CLOSED'; END IF;
  SELECT u.* INTO v_upload FROM public.public_form_uploads u
  WHERE u.form_id = p_form_id AND u.submission_id = p_submission_id AND u.upload_id = p_upload_id;
  IF FOUND THEN
    IF v_upload.content_hash <> p_content_hash OR v_upload.nombre <> btrim(p_nombre) OR v_upload.tipo_mime <> p_tipo_mime OR v_upload.tamano <> p_tamano THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_CONFLICT';
    END IF;
    IF v_upload.status <> 'released' THEN
      RETURN jsonb_build_object('reservation_id',v_upload.reservation_id,'status',v_upload.status,'created',false,'adjunto_id',v_upload.adjunto_id,'storage_path',v_upload.storage_path);
    END IF;
  END IF;
  SELECT count(*),coalesce(sum(greatest(coalesce(tamano,0),0)),0) INTO v_count,v_bytes FROM public.queja_adjuntos WHERE queja_id = p_queja_id;
  SELECT count(*),coalesce(sum(tamano),0) INTO v_reserved_count,v_reserved_bytes FROM public.public_form_uploads
  WHERE form_id = p_form_id AND submission_id = p_submission_id AND status = 'reserved';
  IF v_count + v_reserved_count >= 10 OR v_bytes + v_reserved_bytes + p_tamano > 41943040 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'PUBLIC_UPLOAD_QUOTA';
  END IF;
  -- La reserva nunca caduca sola: Drive podría haber completado la subida.
  INSERT INTO public.public_form_uploads AS u (form_id,submission_id,upload_id,content_hash,nombre,tipo_mime,tamano)
  VALUES (p_form_id,p_submission_id,p_upload_id,p_content_hash,btrim(p_nombre),p_tipo_mime,p_tamano::integer)
  ON CONFLICT (form_id,submission_id,upload_id) DO UPDATE SET status = 'reserved',reservation_id = gen_random_uuid(),updated_at = now()
  RETURNING * INTO v_upload;
  RETURN jsonb_build_object('reservation_id',v_upload.reservation_id,'status',v_upload.status,'created',true,'adjunto_id',NULL,'storage_path',NULL);
END;
$$;

CREATE FUNCTION public.public_form_commit_upload(
  p_form_id uuid, p_submission_id uuid, p_queja_id uuid, p_upload_id uuid, p_reservation_id uuid, p_storage_path text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_upload public.public_form_uploads%ROWTYPE; v_estado text; v_adjunto_id uuid; v_count bigint; v_bytes bigint; v_reserved_count bigint; v_reserved_bytes bigint;
BEGIN
  IF p_storage_path IS NULL OR length(p_storage_path) NOT BETWEEN 7 AND 512 OR p_storage_path !~ '^drive:[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PUBLIC_UPLOAD_PATH_INVALID';
  END IF;
  PERFORM 1 FROM public.public_form_submissions WHERE form_id = p_form_id AND submission_id = p_submission_id AND queja_id = p_queja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_SUBMISSION_UNAVAILABLE'; END IF;
  SELECT u.* INTO v_upload FROM public.public_form_uploads u WHERE u.form_id = p_form_id AND u.submission_id = p_submission_id AND u.upload_id = p_upload_id;
  IF NOT FOUND OR v_upload.reservation_id IS DISTINCT FROM p_reservation_id OR v_upload.status = 'released' THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_RESERVATION_CONFLICT';
  END IF;
  IF v_upload.status = 'committed' THEN
    IF v_upload.storage_path <> p_storage_path THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_CONFLICT'; END IF;
    RETURN jsonb_build_object('adjunto_id',v_upload.adjunto_id,'storage_path',v_upload.storage_path,'committed',true);
  END IF;
  PERFORM 1 FROM public.formularios_publicos WHERE id = p_form_id AND activo AND modulo = 'quejas' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_FORM_UNAVAILABLE'; END IF;
  SELECT estado INTO v_estado FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'Recibido' THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_CLOSED'; END IF;
  -- Adjuntos internos pueden cambiar durante Drive: volver a comprobar antes del registro.
  SELECT count(*),coalesce(sum(greatest(coalesce(tamano,0),0)),0) INTO v_count,v_bytes FROM public.queja_adjuntos WHERE queja_id = p_queja_id;
  SELECT count(*),coalesce(sum(tamano),0) INTO v_reserved_count,v_reserved_bytes FROM public.public_form_uploads WHERE form_id = p_form_id AND submission_id = p_submission_id AND status = 'reserved';
  IF v_count + v_reserved_count > 10 OR v_bytes + v_reserved_bytes > 41943040 THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'PUBLIC_UPLOAD_QUOTA';
  END IF;
  v_adjunto_id := public.registrar_adjunto_queja_publica(p_queja_id,v_upload.nombre,p_storage_path,v_upload.tamano::bigint,v_upload.tipo_mime);
  UPDATE public.public_form_uploads SET status = 'committed',adjunto_id = v_adjunto_id,storage_path = p_storage_path,updated_at = now()
  WHERE form_id = p_form_id AND submission_id = p_submission_id AND upload_id = p_upload_id;
  RETURN jsonb_build_object('adjunto_id',v_adjunto_id,'storage_path',p_storage_path,'committed',true);
END;
$$;

CREATE FUNCTION public.public_form_release_upload(p_form_id uuid,p_submission_id uuid,p_queja_id uuid,p_upload_id uuid,p_reservation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_upload public.public_form_uploads%ROWTYPE;
BEGIN
  -- Compensación permitida también tras desactivar formulario o mover estado.
  PERFORM 1 FROM public.public_form_submissions WHERE form_id = p_form_id AND submission_id = p_submission_id AND queja_id = p_queja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_SUBMISSION_UNAVAILABLE'; END IF;
  SELECT u.* INTO v_upload FROM public.public_form_uploads u WHERE u.form_id = p_form_id AND u.submission_id = p_submission_id AND u.upload_id = p_upload_id;
  IF NOT FOUND OR v_upload.reservation_id IS DISTINCT FROM p_reservation_id OR v_upload.status = 'committed' THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_RESERVATION_CONFLICT';
  END IF;
  UPDATE public.public_form_uploads SET status = 'released',updated_at = now() WHERE form_id = p_form_id AND submission_id = p_submission_id AND upload_id = p_upload_id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.public_form_finalize_submission(p_form_id uuid,p_submission_id uuid,p_queja_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_submission public.public_form_submissions%ROWTYPE; v_folio text;
BEGIN
  SELECT s.* INTO v_submission FROM public.public_form_submissions s WHERE s.form_id = p_form_id AND s.submission_id = p_submission_id AND s.queja_id = p_queja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_SUBMISSION_UNAVAILABLE'; END IF;
  SELECT folio INTO STRICT v_folio FROM public.quejas WHERE id = p_queja_id;
  IF v_submission.finalized_at IS NOT NULL THEN RETURN jsonb_build_object('folio',v_folio,'finalized',true); END IF;
  PERFORM 1 FROM public.formularios_publicos WHERE id = p_form_id AND activo AND modulo = 'quejas' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLIC_FORM_UNAVAILABLE'; END IF;
  IF EXISTS (SELECT 1 FROM public.public_form_uploads WHERE form_id = p_form_id AND submission_id = p_submission_id AND status = 'reserved') THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PUBLIC_UPLOAD_PENDING';
  END IF;
  -- Marca y notificaciones/mail_queue se confirman juntas bajo el mismo lock.
  PERFORM public.notificar_queja_publica(v_folio);
  UPDATE public.public_form_submissions SET finalized_at = now() WHERE form_id = p_form_id AND submission_id = p_submission_id;
  RETURN jsonb_build_object('folio',v_folio,'finalized',true);
END;
$$;

REVOKE ALL ON FUNCTION public.public_form_consume_rate(text,text,integer,integer),
  public.public_form_create_submission(uuid,text,uuid,text,text,text,text,text,text,text),
  public.public_form_reserve_upload(uuid,uuid,uuid,uuid,text,text,text,bigint),
  public.public_form_commit_upload(uuid,uuid,uuid,uuid,uuid,text),
  public.public_form_release_upload(uuid,uuid,uuid,uuid,uuid),
  public.public_form_finalize_submission(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_form_consume_rate(text,text,integer,integer),
  public.public_form_create_submission(uuid,text,uuid,text,text,text,text,text,text,text),
  public.public_form_reserve_upload(uuid,uuid,uuid,uuid,text,text,text,bigint),
  public.public_form_commit_upload(uuid,uuid,uuid,uuid,uuid,text),
  public.public_form_release_upload(uuid,uuid,uuid,uuid,uuid),
  public.public_form_finalize_submission(uuid,uuid,uuid) TO service_role;

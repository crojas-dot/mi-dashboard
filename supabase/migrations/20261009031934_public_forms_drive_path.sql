-- La reserva usa URI drive:, la tabla legacy conserva el ID que usa el panel.
CREATE OR REPLACE FUNCTION public.public_form_commit_upload(
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
  v_adjunto_id := public.registrar_adjunto_queja_publica(p_queja_id,v_upload.nombre,substring(p_storage_path FROM 7),v_upload.tamano::bigint,v_upload.tipo_mime);
  UPDATE public.public_form_uploads SET status = 'committed',adjunto_id = v_adjunto_id,storage_path = p_storage_path,updated_at = now()
  WHERE form_id = p_form_id AND submission_id = p_submission_id AND upload_id = p_upload_id;
  RETURN jsonb_build_object('adjunto_id',v_adjunto_id,'storage_path',p_storage_path,'committed',true);
END;
$$;


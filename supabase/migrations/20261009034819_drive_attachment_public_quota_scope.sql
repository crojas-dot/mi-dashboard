-- Las reservas viven en el ámbito formulario/envío; queja_id está en submissions.
CREATE OR REPLACE FUNCTION public.registrar_adjunto_queja_servidor(
  p_actor_id uuid,
  p_queja_id uuid,
  p_nombre text,
  p_storage_path text,
  p_tamano bigint,
  p_tipo_mime text
) RETURNS public.queja_adjuntos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_actor public.usuarios;
  v_queja public.quejas;
  v_adjunto public.queja_adjuntos;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_mime text := btrim(coalesce(p_tipo_mime, ''));
  v_count bigint;
  v_bytes bigint;
  v_reserved_count bigint;
  v_reserved_bytes bigint;
BEGIN
  -- Mantiene rol/actividad mientras se confirma: un evento Auth tardío no puede elevar actor.
  SELECT * INTO v_actor FROM public.usuarios
  WHERE id = p_actor_id AND estado = 'activo' AND auth_id IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DRIVE_ATTACHMENT_FORBIDDEN';
  END IF;

  -- Comparte el lock del expediente con el gateway público antes de contar su cuota.
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF NOT FOUND OR NOT (
    v_actor.rol IN ('admin', 'calidad')
    OR (v_actor.rol = 'colaborador' AND v_queja.responsable_id IS NOT DISTINCT FROM v_actor.id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DRIVE_ATTACHMENT_FORBIDDEN';
  END IF;

  IF char_length(v_nombre) NOT BETWEEN 1 AND 255
    OR v_nombre ~ '[[:cntrl:]/\\]'
    OR v_path !~ '^[A-Za-z0-9_-]{10,200}$'
    OR p_tamano IS NULL OR p_tamano NOT BETWEEN 1 AND 4194304
    OR char_length(v_mime) NOT BETWEEN 3 AND 127
    OR v_mime !~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*/[A-Za-z0-9][A-Za-z0-9.+_-]*$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DRIVE_ATTACHMENT_INVALID';
  END IF;

  -- Con respuesta perdida, confirmar el mismo archivo retorna la misma fila y no repite auditoría.
  SELECT * INTO v_adjunto FROM public.queja_adjuntos
  WHERE queja_id = p_queja_id AND storage_path = v_path
  ORDER BY created_at, id LIMIT 1;
  IF FOUND THEN
    IF v_adjunto.usuario_id IS DISTINCT FROM p_actor_id
      OR v_adjunto.nombre IS DISTINCT FROM v_nombre
      OR v_adjunto.tamano IS DISTINCT FROM p_tamano
      OR v_adjunto.tipo_mime IS DISTINCT FROM v_mime
    THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'DRIVE_ATTACHMENT_CONFLICT';
    END IF;
    RETURN v_adjunto;
  END IF;

  SELECT count(*), coalesce(sum(greatest(coalesce(tamano, 0), 0)), 0)
  INTO v_count, v_bytes FROM public.queja_adjuntos WHERE queja_id = p_queja_id;
  SELECT count(*), coalesce(sum(u.tamano), 0)
  INTO v_reserved_count, v_reserved_bytes
  FROM public.public_form_submissions s
  JOIN public.public_form_uploads u
    ON u.form_id = s.form_id AND u.submission_id = s.submission_id
  WHERE s.queja_id = p_queja_id AND u.status = 'reserved';
  IF v_count + v_reserved_count >= 10
    OR v_bytes + v_reserved_bytes + p_tamano > 41943040
  THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'DRIVE_ATTACHMENT_QUOTA';
  END IF;

  INSERT INTO public.queja_adjuntos (
    queja_id, nombre, nombre_archivo, storage_path, url_archivo,
    tamano, tipo_mime, usuario_id, created_at
  ) VALUES (
    p_queja_id, v_nombre, v_nombre, v_path, v_path,
    p_tamano::integer, v_mime, p_actor_id, now()
  ) RETURNING * INTO v_adjunto;
  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), p_actor_id, 'adjunto', 'quejas',
    'Adjunto registrado por servidor en la queja ' || p_queja_id);
  RETURN v_adjunto;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_adjunto_queja_servidor(uuid,uuid,text,text,bigint,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_adjunto_queja_servidor(uuid,uuid,text,text,bigint,text)
TO service_role;

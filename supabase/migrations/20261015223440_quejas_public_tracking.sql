-- Seguimiento por capacidad privada. El consecutivo nunca concede lectura.
-- Aditiva: los RPC y snapshots anteriores conservan su contrato y permisos.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.queja_public_access (
  queja_id uuid PRIMARY KEY REFERENCES public.quejas(id) ON DELETE CASCADE,
  nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  closed_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  -- Abierto no tiene cuenta regresiva. Son 720 horas reales, independientes de DST.
  CONSTRAINT queja_public_access_closure_window CHECK (
    (closed_at IS NULL AND expires_at IS NULL) OR
    (closed_at IS NOT NULL AND expires_at IS NOT NULL AND isfinite(closed_at)
      AND isfinite(expires_at) AND expires_at=closed_at+interval '720 hours')
  )
);
CREATE TABLE public.queja_public_resolutions (
  queja_id uuid PRIMARY KEY REFERENCES public.quejas(id) ON DELETE RESTRICT,
  respuesta text NOT NULL CHECK (length(btrim(respuesta)) BETWEEN 1 AND 10000),
  adjunto_id uuid NOT NULL REFERENCES public.queja_adjuntos(id) ON DELETE RESTRICT,
  investigation_run_id uuid REFERENCES public.qms_stage_runs(id) ON DELETE RESTRICT,
  publicado_por uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  publicado_at timestamptz NOT NULL DEFAULT now(),
  source_revision bigint NOT NULL,
  publication_txid bigint NOT NULL
);
CREATE INDEX queja_public_resolutions_attachment ON public.queja_public_resolutions(adjunto_id);
CREATE INDEX queja_public_resolutions_actor ON public.queja_public_resolutions(publicado_por);
CREATE INDEX queja_public_resolutions_run ON public.queja_public_resolutions(investigation_run_id);

-- La reserva persiste antes de borrar Drive: un timeout no permite publicar un archivo
-- cuya eliminación ya empezó. Reintentar la misma eliminación conserva la reserva.
CREATE TABLE public.queja_attachment_deletions (
  adjunto_id uuid PRIMARY KEY REFERENCES public.queja_adjuntos(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX queja_attachment_deletions_actor ON public.queja_attachment_deletions(actor_id);
CREATE INDEX IF NOT EXISTS public_form_submissions_case ON public.public_form_submissions(queja_id);
ALTER TABLE public.queja_public_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queja_public_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queja_attachment_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queja_public_access,public.queja_public_resolutions,
  public.queja_attachment_deletions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.queja_public_access,public.queja_public_resolutions,
  public.queja_attachment_deletions TO service_role;
GRANT SELECT ON public.queja_public_resolutions TO authenticated;
CREATE POLICY queja_public_resolution_case_read ON public.queja_public_resolutions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.quejas q WHERE q.id=queja_id
  ));

-- El mismo orden de locks que el workflow: expediente antes de capacidad. Crear el
-- enlace al mismo tiempo que se cierra no puede dejar una ventana sin vencimiento.
CREATE FUNCTION public.qms_ensure_public_tracking_access(p_queja_id uuid)
RETURNS public.queja_public_access LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE access public.queja_public_access; complaint public.quejas; historical_close timestamptz;
BEGIN
  SELECT * INTO complaint FROM public.quejas WHERE id=p_queja_id FOR UPDATE;
  IF complaint.id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_TRACKING_UNAVAILABLE' USING ERRCODE='42501';
  END IF;
  IF complaint.estado IN ('No Procede','Finalizado')
      AND isfinite(complaint.fecha_cierre) AND complaint.fecha_cierre>=complaint.fecha
      AND complaint.fecha_cierre<=clock_timestamp() THEN
    historical_close:=date_trunc('second',complaint.fecha_cierre);
  END IF;
  -- Un cierre histórico sin fecha fiable nunca obtiene 30 días nuevos al consultar.
  -- Solo se crea bajo demanda; no se reescriben expedientes ni correos anteriores.
  INSERT INTO public.queja_public_access(queja_id,closed_at,expires_at,revoked_at)
    VALUES(p_queja_id,historical_close,historical_close+interval '720 hours',
      CASE WHEN complaint.estado IN ('No Procede','Finalizado') AND historical_close IS NULL
        THEN clock_timestamp() END)
    ON CONFLICT(queja_id) DO NOTHING;
  SELECT * INTO access FROM public.queja_public_access WHERE queja_id=p_queja_id;
  RETURN access;
END;
$function$;

-- Solo la primera transición real de cierre fija el límite. Resuelto es una fase
-- intermedia; reabrir o volver a cerrar no renueva el enlace ni corrige fecha_cierre.
CREATE FUNCTION public.qms_close_public_tracking_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE moment timestamptz:=date_trunc('second',clock_timestamp());
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado IN ('No Procede','Finalizado') THEN
    INSERT INTO public.queja_public_access(queja_id,closed_at,expires_at)
      VALUES(NEW.id,moment,moment+interval '720 hours')
      ON CONFLICT(queja_id) DO UPDATE SET closed_at=excluded.closed_at,expires_at=excluded.expires_at
        WHERE public.queja_public_access.closed_at IS NULL
          AND public.queja_public_access.revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER qms_close_public_tracking_access BEFORE UPDATE OF estado ON public.quejas
  FOR EACH ROW EXECUTE FUNCTION public.qms_close_public_tracking_access();

CREATE FUNCTION public.qms_public_tracking_access(p_queja_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE access public.queja_public_access;
BEGIN
  IF EXISTS (SELECT 1 FROM public.public_form_submissions
      WHERE queja_id=p_queja_id AND finalized_at IS NULL) THEN
    RAISE EXCEPTION 'PUBLIC_TRACKING_UNAVAILABLE' USING ERRCODE='42501';
  END IF;
  access:=public.qms_ensure_public_tracking_access(p_queja_id);
  IF access.revoked_at IS NOT NULL OR (access.expires_at IS NOT NULL AND access.expires_at<=now()) THEN
    RAISE EXCEPTION 'PUBLIC_TRACKING_UNAVAILABLE' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object('queja_id',access.queja_id,'nonce',access.nonce);
END;
$function$;

CREATE FUNCTION public.qms_public_tracking_read(p_queja_id uuid,p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $function$
DECLARE complaint public.quejas; publication public.queja_public_resolutions;
  document public.queja_adjuntos; events jsonb; last_change timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.queja_public_access a WHERE a.queja_id=p_queja_id
      AND a.nonce=p_nonce AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at>now()))
    OR EXISTS (SELECT 1 FROM public.public_form_submissions
      WHERE queja_id=p_queja_id AND finalized_at IS NULL) THEN
    RAISE EXCEPTION 'PUBLIC_TRACKING_UNAVAILABLE' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT complaint FROM public.quejas WHERE id=p_queja_id;
  -- Solo hitos públicos. Nunca proyectar snapshots, eventos internos, autores o notas.
  SELECT coalesce(jsonb_agg(jsonb_build_object('nombre',e.name,'fecha',e.moment)
      ORDER BY e.moment,e.position),'[]'::jsonb), max(e.moment)
    INTO events,last_change FROM (
      SELECT 'Recepción'::text name,complaint.fecha moment,1 position
      UNION ALL SELECT 'Investigación',r.started_at,2 FROM (
        SELECT last.started_at FROM public.qms_stage_runs last
          WHERE last.case_id=p_queja_id AND last.stage_id='quejas.investigation'
          ORDER BY last.started_at DESC,last.id DESC LIMIT 1
      ) r
      UNION ALL SELECT 'Respuesta',r.publicado_at,3 FROM public.queja_public_resolutions r
        WHERE r.queja_id=p_queja_id AND complaint.estado IN ('Resuelto','No Procede','Finalizado')
          AND r.investigation_run_id IS NOT DISTINCT FROM (SELECT last.id FROM public.qms_stage_runs last
            WHERE last.case_id=p_queja_id AND last.stage_id='quejas.investigation' ORDER BY last.started_at DESC,last.id DESC LIMIT 1)
      UNION ALL SELECT 'Cierre',complaint.fecha_cierre,4
        WHERE complaint.estado='Finalizado' AND complaint.fecha_cierre IS NOT NULL
          -- Algunas reaperturas legacy conservaron fecha_cierre. No presentarla
          -- como un cierre posterior a hechos que realmente ocurrieron después.
          AND complaint.fecha_cierre>=coalesce((SELECT max(last.started_at) FROM public.qms_stage_runs last
            WHERE last.case_id=p_queja_id AND last.stage_id='quejas.investigation'),'-infinity'::timestamptz)
          AND complaint.fecha_cierre>=coalesce((SELECT r.publicado_at FROM public.queja_public_resolutions r
            WHERE r.queja_id=p_queja_id),'-infinity'::timestamptz)
    ) e WHERE e.moment IS NOT NULL;
  IF complaint.estado IN ('Resuelto','No Procede','Finalizado') THEN
    SELECT * INTO publication FROM public.queja_public_resolutions p WHERE p.queja_id=p_queja_id
      AND p.investigation_run_id IS NOT DISTINCT FROM (SELECT last.id FROM public.qms_stage_runs last
        WHERE last.case_id=p_queja_id AND last.stage_id='quejas.investigation' ORDER BY last.started_at DESC,last.id DESC LIMIT 1);
    IF publication.queja_id IS NOT NULL THEN
      SELECT * INTO document FROM public.queja_adjuntos
        WHERE id=publication.adjunto_id AND queja_id=p_queja_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('folio',complaint.folio,'estado',complaint.estado,
    'recibido_at',complaint.fecha,'actualizado_at',last_change,'etapas',events,
    'respuesta',publication.respuesta,
    'numero_oficio',CASE WHEN publication.queja_id IS NOT NULL THEN complaint.numero_oficio_resolucion END,
    'documento',CASE WHEN document.id IS NOT NULL THEN jsonb_build_object(
      'id',document.id,'nombre',document.nombre,'tipo_mime',document.tipo_mime,'tamano',document.tamano) END);
END;
$function$;

CREATE FUNCTION public.qms_public_tracking_document(p_queja_id uuid,p_nonce uuid,p_adjunto_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $function$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('storage_path',d.storage_path,'nombre',d.nombre,
      'tipo_mime',d.tipo_mime,'tamano',d.tamano,'folio',q.folio) INTO result
    FROM public.queja_public_access a JOIN public.quejas q ON q.id=a.queja_id
    JOIN public.queja_public_resolutions r ON r.queja_id=q.id
    JOIN public.queja_adjuntos d ON d.id=r.adjunto_id AND d.queja_id=q.id
    WHERE q.id=p_queja_id AND a.nonce=p_nonce AND a.revoked_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at>now())
      AND q.estado IN ('Resuelto','No Procede','Finalizado') AND d.id=p_adjunto_id
      AND r.investigation_run_id IS NOT DISTINCT FROM (SELECT last.id FROM public.qms_stage_runs last
        WHERE last.case_id=q.id AND last.stage_id='quejas.investigation' ORDER BY last.started_at DESC,last.id DESC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM public.public_form_submissions s
        WHERE s.queja_id=q.id AND s.finalized_at IS NULL);
  IF result IS NULL THEN RAISE EXCEPTION 'PUBLIC_TRACKING_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  RETURN result;
END;
$function$;

CREATE FUNCTION public.qms_resolve_complaint_with_document(
  p_queja_id uuid,p_estado text,p_detalles jsonb,p_expected_revision bigint,
  p_adjunto_id uuid,p_respuesta_publica text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE complaint public.quejas; document public.queja_adjuntos; result jsonb;
  actor uuid; response text:=btrim(coalesce(p_respuesta_publica,''));
BEGIN
  actor:=public.app_usuario_actual_id();
  IF auth.uid() IS NULL OR actor IS NULL OR NOT (coalesce(public.app_es_admin(),false)
      OR (coalesce(public.app_es_staff(),false) AND coalesce(public.app_tiene_permiso('quejas',true),false))) THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE='42501';
  END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('rejected','resolved')
    OR p_detalles IS NULL OR jsonb_typeof(p_detalles)<>'object'
    OR p_detalles-ARRAY['resolution','resolution_format','office_number']<>'{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(p_detalles) e WHERE jsonb_typeof(e.value)<>'string')
    OR length(response) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Revisá la respuesta y el documento final.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO complaint FROM public.quejas WHERE id=p_queja_id FOR UPDATE;
  IF complaint.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada.' USING ERRCODE='P0002'; END IF;
  IF p_expected_revision IS NULL OR complaint.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Otra persona modificó la queja. Actualiza antes de guardar.' USING ERRCODE='40001';
  END IF;
  SELECT * INTO document FROM public.queja_adjuntos WHERE id=p_adjunto_id FOR UPDATE;
  IF document.id IS NULL OR document.queja_id IS DISTINCT FROM p_queja_id
    OR document.usuario_id IS NULL OR document.storage_path !~ '^[A-Za-z0-9_-]{10,200}$'
    OR char_length(btrim(coalesce(document.nombre,''))) NOT BETWEEN 1 AND 255
    OR document.nombre ~ '[[:cntrl:]/\\]'
    OR document.tamano IS NULL OR document.tamano NOT BETWEEN 1 AND 4194304
    OR char_length(coalesce(document.tipo_mime,'')) NOT BETWEEN 3 AND 127
    OR document.tipo_mime !~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*/[A-Za-z0-9][A-Za-z0-9.+_-]*$' THEN
    RAISE EXCEPTION 'Seleccioná el oficio adjunto de este expediente.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.queja_attachment_deletions WHERE adjunto_id=p_adjunto_id) THEN
    RAISE EXCEPTION 'El archivo tiene una eliminación pendiente.' USING ERRCODE='55000';
  END IF;
  -- Publicación antes de la transición: el trigger encola una referencia coherente.
  -- Cualquier fallo de CAS/estado/oficio revierte ambas escrituras en esta transacción.
  INSERT INTO public.queja_public_resolutions(queja_id,respuesta,adjunto_id,publicado_por,
    investigation_run_id,source_revision,publication_txid)
    VALUES(p_queja_id,response,p_adjunto_id,actor,(SELECT last.id FROM public.qms_stage_runs last
      WHERE last.case_id=p_queja_id AND last.stage_id='quejas.investigation' ORDER BY last.started_at DESC,last.id DESC LIMIT 1),
      p_expected_revision,txid_current())
    ON CONFLICT(queja_id) DO UPDATE
    SET respuesta=excluded.respuesta,adjunto_id=excluded.adjunto_id,
      publicado_por=excluded.publicado_por,publicado_at=now(),investigation_run_id=excluded.investigation_run_id,
      source_revision=excluded.source_revision,publication_txid=excluded.publication_txid;
  result:=public.qms_transition_complaint(p_queja_id,p_expected_revision,p_estado,
    coalesce(nullif(p_detalles->>'resolution',''),response),NULL,NULL,NULL,
    p_detalles->>'office_number',coalesce(p_detalles->>'resolution_format','plain'),NULL);
  INSERT INTO public.logs(fecha,usuario_id,accion,modulo,detalle)
    VALUES(now(),actor,'publicar','quejas','Respuesta y oficio publicados para '||complaint.folio);
  RETURN result;
END;
$function$;

CREATE FUNCTION public.qms_claim_attachment_delete(p_adjunto_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE actor public.usuarios; document public.queja_adjuntos; complaint public.quejas; case_id uuid;
BEGIN
  SELECT * INTO actor FROM public.usuarios
    WHERE id=p_actor_id AND estado='activo' AND auth_id IS NOT NULL FOR SHARE;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'DRIVE_ATTACHMENT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT queja_id INTO case_id FROM public.queja_adjuntos WHERE id=p_adjunto_id;
  SELECT * INTO complaint FROM public.quejas WHERE id=case_id FOR UPDATE;
  SELECT * INTO document FROM public.queja_adjuntos WHERE id=p_adjunto_id FOR UPDATE;
  IF document.id IS NULL OR complaint.id IS NULL OR NOT coalesce(actor.rol IN ('admin','calidad')
      OR (actor.rol='colaborador' AND complaint.responsable_id=actor.id),false) THEN
    RAISE EXCEPTION 'DRIVE_ATTACHMENT_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.queja_public_resolutions WHERE adjunto_id=p_adjunto_id) THEN
    RAISE EXCEPTION 'DRIVE_ATTACHMENT_PUBLISHED' USING ERRCODE='55000';
  END IF;
  INSERT INTO public.queja_attachment_deletions(adjunto_id,actor_id) VALUES(p_adjunto_id,p_actor_id)
    ON CONFLICT(adjunto_id) DO NOTHING;
  RETURN jsonb_build_object('id',document.id,'queja_id',document.queja_id,'storage_path',document.storage_path);
END;
$function$;

-- Solo INSERT nuevo: no tocar payloads históricos, reservas o diarios ya emitidos.
ALTER TABLE public.queja_mail_outbox ADD COLUMN public_tracking jsonb;
CREATE FUNCTION public.qms_snapshot_public_tracking_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE access public.queja_public_access;
BEGIN
  IF NEW.tipo IN ('recibido','investigacion','final') THEN
    access:=public.qms_ensure_public_tracking_access(NEW.queja_id);
    IF access.revoked_at IS NULL AND (access.expires_at IS NULL OR access.expires_at>now()) THEN
      NEW.public_tracking:=jsonb_build_object('queja_id',access.queja_id,'nonce',access.nonce);
    ELSE NEW.public_tracking:=NULL; END IF;
  ELSE NEW.public_tracking:=NULL; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER qms_snapshot_public_tracking_mail BEFORE INSERT ON public.queja_mail_outbox
  FOR EACH ROW EXECUTE FUNCTION public.qms_snapshot_public_tracking_mail();

-- v2 conserva tipo de retorno, privilegios y semántica de reclamo. v3 proyecta
-- únicamente el snapshot fijado al encolar, nunca una capacidad reconstruida al enviar.
CREATE FUNCTION public.qms_mail_claim_batch_v3(
  p_limit integer,p_lease_seconds integer,p_run_nonce uuid,p_issued_at bigint
) RETURNS TABLE(id uuid,claim_token uuid,tipo text,destinatario text,folio text,
  estado text,numero_oficio text,public_tracking jsonb)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $function$
  SELECT c.id,c.claim_token,c.tipo,c.destinatario,c.folio,c.estado,c.numero_oficio,o.public_tracking
    FROM public.qms_mail_claim_batch_v2(p_limit,p_lease_seconds,p_run_nonce,p_issued_at) c
    JOIN public.queja_mail_outbox o ON o.id=c.id;
$function$;

REVOKE ALL ON FUNCTION public.qms_public_tracking_access(uuid),
  public.qms_ensure_public_tracking_access(uuid),public.qms_close_public_tracking_access(),
  public.qms_public_tracking_read(uuid,uuid),public.qms_public_tracking_document(uuid,uuid,uuid),
  public.qms_claim_attachment_delete(uuid,uuid),public.qms_snapshot_public_tracking_mail(),
  public.qms_mail_claim_batch_v3(integer,integer,uuid,bigint)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.qms_close_public_tracking_access(),public.qms_snapshot_public_tracking_mail()
  FROM service_role;
GRANT EXECUTE ON FUNCTION public.qms_public_tracking_access(uuid),
  public.qms_ensure_public_tracking_access(uuid),
  public.qms_public_tracking_read(uuid,uuid),public.qms_public_tracking_document(uuid,uuid,uuid),
  public.qms_claim_attachment_delete(uuid,uuid),public.qms_mail_claim_batch_v3(integer,integer,uuid,bigint)
  TO service_role;
REVOKE ALL ON FUNCTION public.qms_resolve_complaint_with_document(uuid,text,jsonb,bigint,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qms_resolve_complaint_with_document(uuid,text,jsonb,bigint,uuid,text)
  TO authenticated;

-- Solo estructura para PostgreSQL temporal; sin filas ni credenciales de ECA-QMS.
create table public.qms_calendars (
  id bigint primary key,
  weekdays integer[],
  holidays jsonb,
  timezone text,
  created_at timestamp with time zone,
  created_by uuid
);
create table public.queja_adjuntos (
  id uuid,
  queja_id uuid,
  nombre_archivo text,
  url_archivo text,
  tipo_archivo text,
  tamano integer,
  subido_por uuid,
  fecha_subida timestamp with time zone,
  nombre text,
  storage_path text,
  tipo_mime text,
  usuario_id uuid,
  created_at timestamp with time zone
);
create table public.quejas (
  id uuid primary key,
  folio text,
  cliente_nombre text,
  email_cliente text,
  telefono text,
  categoria text,
  descripcion text,
  prioridad text,
  estado text,
  fecha_sla timestamp with time zone,
  fecha timestamp with time zone,
  notas text,
  resolucion text,
  responsable_id uuid,
  derivado_sacp_id uuid,
  fecha_cierre timestamp with time zone,
  fecha_limite_investigacion timestamp with time zone,
  reabierta boolean,
  motivo_reapertura text,
  revision bigint,
  tipo text,
  area_afectada text,
  fecha_recepcion_gc date,
  numero_oficio_resolucion text,
  observaciones text,
  resolucion_formato text,
  notas_formato text,
  justificacion_procede text,
  justificacion_procede_formato text
);
create table public.quejas_actividad (
  id uuid,
  queja_id uuid,
  tipo text,
  descripcion text,
  usuario_id uuid,
  created_at timestamp with time zone
);
create table public.qms_case_events (
  id bigint,
  module text,
  case_id uuid,
  kind text,
  occurred_at timestamp with time zone,
  provenance text
);
create table public.qms_stage_runs (
  id uuid,
  case_id uuid,
  stage_id text,
  rule_id bigint,
  calendar_id bigint,
  snapshot jsonb,
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  attention_at timestamp with time zone,
  ended_at timestamp with time zone,
  end_event text,
  provenance text
);
create table public.queja_gc_revisiones (
  queja_id uuid,
  source_revision bigint,
  decision text,
  motivo text,
  propuesta text,
  propuesta_formato text,
  investigation_run_id uuid,
  usuario_id uuid,
  created_at timestamp with time zone,
  operation_txid bigint
);
create table public.queja_informes (
  queja_id uuid,
  version integer,
  contenido text,
  fuente_revision bigint,
  creado_por uuid,
  created_at timestamp with time zone
);
create table public.quejas_comentarios (
  id uuid,
  queja_id uuid,
  usuario_id uuid,
  comentario text,
  tipo text,
  visible_cliente boolean,
  fecha timestamp with time zone
);
create table public.queja_public_resolutions (
  queja_id uuid,
  respuesta text,
  adjunto_id uuid,
  investigation_run_id uuid,
  publicado_por uuid,
  publicado_at timestamp with time zone,
  source_revision bigint,
  publication_txid bigint
);
create table public.queja_resolution_drafts (
  queja_id uuid,
  version bigint,
  source_revision bigint,
  contenido text,
  formato text,
  actualizado_por uuid,
  updated_at timestamp with time zone
);
create table public.queja_response_drafts (
  queja_id uuid,
  version bigint,
  respuesta text,
  numero_oficio text,
  adjunto_id uuid,
  actualizado_por uuid,
  updated_at timestamp with time zone,
  correo_asunto text,
  correo_cuerpo text,
  motivo_no_procede text,
  motivo_no_procede_formato text
);
create table public.queja_investigation_assignments (
  queja_id uuid,
  responsable_id uuid,
  instrucciones text,
  oficio_adjunto_id uuid,
  updated_at timestamp with time zone
);

create table catalogos(id uuid,modulo text,tipo text,valor_interno text,codigo text,valor text,color text,orden integer);
create function qms_classify(timestamptz,timestamptz) returns text language sql as $$select 'ok'::text$$;
CREATE OR REPLACE FUNCTION public.qms_business_day(p_day date, p_calendar bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 SELECT extract(isodow FROM p_day)::int=ANY(weekdays) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(holidays) h WHERE (h->>'date')::date=p_day)
 FROM qms_calendars WHERE id=p_calendar;
$function$
;
create view qms_quejas with(security_invoker=true) as  SELECT q.id,
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
    q.tipo,
    q.area_afectada,
    q.fecha_recepcion_gc,
    q.numero_oficio_resolucion,
    q.observaciones,
    q.resolucion_formato,
    q.notas_formato,
    q.justificacion_procede,
    q.justificacion_procede_formato
   FROM quejas q
     LEFT JOIN LATERAL ( SELECT catalogos.codigo,
            catalogos.valor,
            catalogos.color
           FROM catalogos
          WHERE catalogos.modulo = 'quejas'::text AND catalogos.tipo = 'estado_queja'::text AND catalogos.valor_interno = q.estado
          ORDER BY catalogos.orden, catalogos.id
         LIMIT 1) c ON true
     LEFT JOIN LATERAL ( SELECT sr.id,
            sr.case_id,
            sr.stage_id,
            sr.rule_id,
            sr.calendar_id,
            sr.snapshot,
            sr.started_at,
            sr.expires_at,
            sr.attention_at,
            sr.ended_at,
            sr.end_event,
            sr.provenance
           FROM qms_stage_runs sr
          WHERE sr.case_id = q.id AND (sr.ended_at IS NULL OR q.estado = 'Pendiente de Revisión GC'::text AND sr.stage_id = 'quejas.investigation'::text AND sr.end_event = 'Pendiente de Revisión GC'::text)
          ORDER BY (sr.ended_at IS NULL) DESC, sr.started_at DESC
         LIMIT 1) r ON true;


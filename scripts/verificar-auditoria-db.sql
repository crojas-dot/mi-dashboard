-- Regresion de la auditoria: solo fixtures sinteticos, sin salida de identidades.
-- Ejecutar como postgres mediante una conexion administrativa. BEGIN/ROLLBACK
-- descarta perfiles, permisos, filas, cambios de configuracion y helpers temporales.
-- Para fase A anteponer: SET qms.audit.expect_ai_isolated = 'false';
-- Para fase B anteponer: SET qms.audit.expect_ai_isolated = 'true';
-- Nunca imprimir valor de configuraciones_sistema, credenciales ni datos reales.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

-- Grants y RLS forman capas distintas: no basta con una politica correcta.
DO $metadata$
DECLARE v_table text; v_priv text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['acciones','riesgos','procesos','reuniones','hallazgos',
    'documento_versiones','versiones_documentos','solicitudes_documentales','tareas',
    'catalogos','sla_config','formularios_publicos','configuraciones_sistema'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.' || v_table))
      THEN RAISE EXCEPTION 'RLS deshabilitada en %', v_table; END IF;
    FOREACH v_priv IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, v_priv)
        OR pg_catalog.has_table_privilege('anon', 'public.' || v_table, v_priv)
        THEN RAISE EXCEPTION 'Privilegio % excesivo en %', v_priv, v_table; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE contype = 'c' AND conname IN (
    'qms_procesos_nombre_nonblank','qms_reuniones_titulo_nonblank','qms_documentos_titulo_nonblank',
    'qms_documentos_codigo_nonblank','qms_acciones_folio_nonblank','qms_riesgos_folio_nonblank',
    'qms_auditorias_folio_nonblank','qms_riesgos_probabilidad_range',
    'qms_riesgos_impacto_range','qms_acciones_seguimiento_range','qms_sla_plazos_range')) <> 11
    THEN RAISE EXCEPTION 'Faltan checks de auditoria'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.auditorias'::regclass AND tgname='qms_auditorias_fechas_validas' AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'Falta validacion de fechas de auditoria';
  END IF;
END;
$metadata$;

CREATE TEMP TABLE qms_audit_cases (
  tabla text PRIMARY KEY,
  modulo text NOT NULL,
  id uuid NOT NULL,
  payload jsonb NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON qms_audit_cases TO authenticated, anon, service_role;

-- Inserta solamente columnas presentes en el payload para conservar defaults.
CREATE FUNCTION pg_temp.qms_insert(p_tabla text, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_columnas text; v_id uuid;
BEGIN
  SELECT string_agg(pg_catalog.quote_ident(k), ', ' ORDER BY k)
    INTO v_columnas FROM pg_catalog.jsonb_object_keys(p_payload) k;
  EXECUTE pg_catalog.format(
    'INSERT INTO public.%I (%s) SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.%I, $1) RETURNING id',
    p_tabla, v_columnas, v_columnas, p_tabla
  ) INTO v_id USING p_payload;
  RETURN v_id;
END;
$fn$;

CREATE FUNCTION pg_temp.qms_fresh(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_payload jsonb := p_payload || pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid()); v_key text;
BEGIN
  FOREACH v_key IN ARRAY ARRAY['folio', 'codigo_doc', 'token'] LOOP
    IF v_payload ? v_key THEN
      v_payload := pg_catalog.jsonb_set(v_payload, ARRAY[v_key], to_jsonb(v_payload->>v_key || '-' || pg_catalog.gen_random_uuid()::text));
    END IF;
  END LOOP;
  RETURN v_payload;
END;
$fn$;

CREATE FUNCTION pg_temp.qms_crud(p_tabla text, p_id uuid, p_payload jsonb, p_leer boolean, p_escribir boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_existe boolean; v_filas integer; v_nuevo uuid;
BEGIN
  EXECUTE pg_catalog.format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1)', p_tabla)
    INTO v_existe USING p_id;
  IF v_existe IS DISTINCT FROM p_leer THEN
    RAISE EXCEPTION 'Lectura RLS inesperada en %', p_tabla;
  END IF;
  EXECUTE pg_catalog.format('UPDATE public.%I SET id = id WHERE id = $1', p_tabla) USING p_id;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> (CASE WHEN p_escribir THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION 'UPDATE RLS inesperado en %', p_tabla;
  END IF;
  IF p_escribir THEN
    v_nuevo := pg_temp.qms_insert(p_tabla, pg_temp.qms_fresh(p_payload));
    EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE id = $1', p_tabla) USING v_nuevo;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> 1 THEN RAISE EXCEPTION 'DELETE RLS autorizado fallo en %', p_tabla; END IF;
  ELSE
    BEGIN
      PERFORM pg_temp.qms_insert(p_tabla, pg_temp.qms_fresh(p_payload));
      RAISE EXCEPTION 'INSERT RLS sin permiso en %', p_tabla;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE id = $1', p_tabla) USING p_id;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> 0 THEN RAISE EXCEPTION 'DELETE RLS sin permiso en %', p_tabla; END IF;
  END IF;
END;
$fn$;

CREATE FUNCTION pg_temp.qms_invalid(p_tabla text, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  BEGIN
    PERFORM pg_temp.qms_insert(p_tabla, p_payload || pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid()));
    RAISE EXCEPTION 'Se acepto payload invalido en %', p_tabla;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$fn$;


DO $setup$
DECLARE v_schema text;
BEGIN
  SELECT nspname INTO v_schema FROM pg_catalog.pg_namespace WHERE oid = pg_catalog.pg_my_temp_schema();
  EXECUTE pg_catalog.format('GRANT USAGE ON SCHEMA %I TO authenticated, anon, service_role', v_schema);
END;
$setup$;
GRANT EXECUTE ON FUNCTION pg_temp.qms_insert(text,jsonb), pg_temp.qms_fresh(jsonb),
  pg_temp.qms_crud(text,uuid,jsonb,boolean,boolean), pg_temp.qms_invalid(text,jsonb)
  TO authenticated, anon, service_role;

-- No ejecutar fixtures Auth si hay triggers de signup no revisados: los efectos
-- externos no se deshacen necesariamente con ROLLBACK. La revision de triggers
-- debe preceder a cualquier excepcion explicita a esta salvaguarda.
DO $test$
DECLARE v_actor text; v_auth uuid; v_usuario uuid; v_rol text; v_estado text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN RAISE EXCEPTION 'Revisar triggers Auth antes de crear fixtures'; END IF;
  FOREACH v_actor IN ARRAY ARRAY['admin', 'reader', 'writer', 'denied', 'write_only', 'inactive', 'staff'] LOOP
    v_auth := pg_catalog.gen_random_uuid(); v_usuario := pg_catalog.gen_random_uuid();
    v_rol := CASE v_actor WHEN 'admin' THEN 'admin' WHEN 'inactive' THEN 'admin'
      WHEN 'staff' THEN 'calidad' ELSE '__qms_audit_' || v_actor END;
    v_estado := CASE WHEN v_actor = 'inactive' THEN 'inactivo' ELSE 'activo' END;
    INSERT INTO auth.users (id, email, aud, role)
      VALUES (v_auth, 'qms-audit-' || v_auth || '@example.invalid', 'authenticated', 'authenticated');
    INSERT INTO public.usuarios (id, auth_id, nombre, email, rol, estado)
      VALUES (v_usuario, v_auth, 'Fixture transaccional QMS', 'qms-audit-' || v_auth || '@example.invalid', v_rol, v_estado);
    PERFORM pg_catalog.set_config('qms.audit.auth_' || v_actor, v_auth::text, true);
    PERFORM pg_catalog.set_config('qms.audit.user_' || v_actor, v_usuario::text, true);
  END LOOP;
  IF pg_catalog.current_setting('qms.audit.auth_reader') = pg_catalog.current_setting('qms.audit.user_reader') THEN
    RAISE EXCEPTION 'El fixture no distingue identidad Auth de usuario operativo';
  END IF;
  INSERT INTO public.permisos (rol, modulo, leer, escribir)
  SELECT '__qms_audit_' || actor, modulo,
    actor IN ('reader', 'writer'), actor IN ('writer', 'write_only')
  FROM unnest(ARRAY['reader', 'writer', 'denied', 'write_only']) actor
    CROSS JOIN unnest(ARRAY['sacp', 'riesgos', 'procesos', 'revision', 'auditorias', 'documentos']) modulo;
  INSERT INTO public.permisos (rol, modulo, leer, escribir)
    VALUES ('calidad', 'quejas', true, true), ('calidad', 'sacp', true, false)
    ON CONFLICT (rol, modulo) DO UPDATE SET leer = EXCLUDED.leer, escribir = EXCLUDED.escribir;

  INSERT INTO qms_audit_cases (tabla, modulo, id, payload)
  SELECT tabla, modulo, pg_catalog.gen_random_uuid(), payload FROM (VALUES
    ('acciones', 'sacp', '{"folio":"QMS-AUDIT-SACP","estado":"Abierta","seguimiento_porcentaje":50}'::jsonb),
    ('riesgos', 'riesgos', '{"folio":"QMS-AUDIT-RIESGO","probabilidad":1,"impacto":1,"estado":"Identificado"}'::jsonb),
    ('procesos', 'procesos', '{"nombre_proceso":"Fixture transaccional QMS","objetivo":""}'::jsonb),
    ('reuniones', 'revision', '{"titulo":"Fixture transaccional QMS"}'::jsonb),
    ('hallazgos', 'auditorias', '{"descripcion":"Fixture transaccional QMS"}'::jsonb),
    ('documento_versiones', 'documentos', '{"version":"1.0","motivo_cambio":"Fixture QMS"}'::jsonb),
    ('versiones_documentos', 'documentos', '{"version":"1.0","cambios":"Fixture QMS"}'::jsonb),
    ('solicitudes_documentales', 'documentos', '{"tipo":"Actualizacion","descripcion":"Fixture QMS"}'::jsonb)
  ) fixtures(tabla, modulo, payload);
  UPDATE qms_audit_cases SET payload = payload || pg_catalog.jsonb_build_object('id', id);
  -- Folios unicos del fixture, sin usar secuencias reales para los CRUD.
  UPDATE qms_audit_cases SET payload = pg_catalog.jsonb_set(payload, '{folio}', to_jsonb(payload->>'folio' || '-' || id::text))
    WHERE payload ? 'folio';
END;
$test$;

DO $test$
DECLARE v_case record; v_id uuid; v_codigo text;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', pg_catalog.current_setting('qms.audit.auth_admin'), 'role', 'authenticated')::text, true);
  FOR v_case IN SELECT * FROM qms_audit_cases LOOP
    PERFORM pg_temp.qms_insert(v_case.tabla, v_case.payload);
  END LOOP;
  INSERT INTO public.documentos (id, titulo, codigo_doc, estado)
    VALUES (pg_catalog.gen_random_uuid(), 'Fixture transaccional QMS', 'QMS-AUDIT-' || pg_catalog.gen_random_uuid(), 'Borrador')
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.documento', v_id::text, true);
  INSERT INTO public.auditorias (id, folio, tipo, estado, fecha_inicio, fecha_fin)
    VALUES (pg_catalog.gen_random_uuid(), 'QMS-AUDIT-' || pg_catalog.gen_random_uuid(), 'Interna', 'Planificada', '2026-01-01', '2026-01-02')
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.auditoria', v_id::text, true);
  INSERT INTO public.tareas (id, titulo, responsable_id)
    VALUES (pg_catalog.gen_random_uuid(), 'Fixture tarea propia', pg_catalog.current_setting('qms.audit.user_reader')::uuid)
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.tarea_propia', v_id::text, true);
  INSERT INTO public.tareas (id, titulo, responsable_id)
    VALUES (pg_catalog.gen_random_uuid(), 'Fixture tarea ajena', pg_catalog.current_setting('qms.audit.user_admin')::uuid)
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.tarea_ajena', v_id::text, true);

  FOREACH v_codigo IN ARRAY ARRAY['public_active', 'public_inactive', 'private_active'] LOOP
    INSERT INTO public.catalogos (id, tipo, valor, modulo, codigo, valor_interno, activo)
    VALUES (pg_catalog.gen_random_uuid(), CASE WHEN v_codigo = 'private_active' THEN 'categoria_riesgo' ELSE 'categoria_queja' END,
      'Fixture QMS ' || v_codigo, CASE WHEN v_codigo = 'private_active' THEN 'riesgos' ELSE 'quejas' END, 'qms_audit_' || replace(pg_catalog.gen_random_uuid()::text, '-', '_'),
      'Fixture QMS ' || v_codigo, v_codigo <> 'public_inactive') RETURNING id INTO v_id;
    PERFORM pg_catalog.set_config('qms.audit.catalogo_' || v_codigo, v_id::text, true);
  END LOOP;
  INSERT INTO public.sla_config (id, proceso, prioridad, dias_alerta, dias_vencimiento)
    VALUES (pg_catalog.gen_random_uuid(), 'qms_audit', 'qms_audit', 1, 3) RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.sla', v_id::text, true);
  INSERT INTO public.formularios_publicos (id, modulo, nombre, token, activo)
    VALUES (pg_catalog.gen_random_uuid(), 'quejas', 'Fixture QMS activo', 'qms_audit_' || pg_catalog.gen_random_uuid(), true)
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.form_active', v_id::text, true);
  INSERT INTO public.formularios_publicos (id, modulo, nombre, token, activo)
    VALUES (pg_catalog.gen_random_uuid(), 'quejas', 'Fixture QMS inactivo', 'qms_audit_' || pg_catalog.gen_random_uuid(), false)
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.form_inactive', v_id::text, true);
  INSERT INTO public.configuraciones_sistema (clave, valor, categoria)
    VALUES ('__qms_audit_config__', '{"fixture":true}', 'prueba'), ('ai___qms_audit_secret__', '{"fixture":true}', 'ia');
  INSERT INTO public.quejas (id, folio, cliente_nombre, descripcion, estado)
    VALUES (pg_catalog.gen_random_uuid(), 'QMS-AUDIT-' || pg_catalog.gen_random_uuid(), 'Fixture QMS', 'Fixture QMS', 'Resuelto')
    RETURNING id INTO v_id;
  PERFORM pg_catalog.set_config('qms.audit.queja_derivacion', v_id::text, true);
END;
$test$;

-- Cada operacion se verifica con el rol de transporte real y el auth_id real
-- del fixture. No hay consultas privadas sin filtro ni valores reales en salida.
SET LOCAL ROLE authenticated;
DO $test$
DECLARE v_actor text; v_case record; v_filas integer; v_leer boolean; v_escribir boolean; v_nuevo uuid; v_ai_permitido boolean;
BEGIN
  FOREACH v_actor IN ARRAY ARRAY['admin', 'reader', 'writer', 'denied', 'write_only', 'inactive'] LOOP
    PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
      'sub', pg_catalog.current_setting('qms.audit.auth_' || v_actor), 'role', 'authenticated',
      'user_metadata', pg_catalog.jsonb_build_object('rol', 'admin'))::text, true);
    v_leer := v_actor IN ('admin', 'reader', 'writer'); v_escribir := v_actor IN ('admin', 'writer');
    IF public.app_es_admin() IS DISTINCT FROM (v_actor = 'admin') THEN
      RAISE EXCEPTION 'El perfil activo o user_metadata altera la autoridad de admin';
    END IF;
    FOR v_case IN SELECT * FROM qms_audit_cases LOOP
      PERFORM pg_temp.qms_crud(v_case.tabla, v_case.id, v_case.payload, v_leer, v_escribir);
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.catalogos WHERE id = pg_catalog.current_setting('qms.audit.catalogo_private_active')::uuid)
      IS DISTINCT FROM (v_actor <> 'inactive') THEN RAISE EXCEPTION 'Lectura catalogos no respeta perfil activo'; END IF;
    IF EXISTS (SELECT 1 FROM public.sla_config WHERE id = pg_catalog.current_setting('qms.audit.sla')::uuid)
      IS DISTINCT FROM (v_actor <> 'inactive') THEN RAISE EXCEPTION 'Lectura SLA no respeta perfil activo'; END IF;
    UPDATE public.sla_config SET dias_alerta = 1 WHERE id = pg_catalog.current_setting('qms.audit.sla')::uuid;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> (CASE WHEN v_actor = 'admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Escritura SLA no es exclusiva admin'; END IF;
    UPDATE public.catalogos SET color = 'primary' WHERE id = pg_catalog.current_setting('qms.audit.catalogo_private_active')::uuid;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> (CASE WHEN v_actor = 'admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Escritura catalogo no es exclusiva admin'; END IF;

    IF v_actor = 'admin' THEN
      v_nuevo := pg_temp.qms_insert('sla_config', pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid(),
        'proceso', 'qms_audit_' || pg_catalog.gen_random_uuid(), 'dias_alerta', 1, 'dias_vencimiento', 3));
      DELETE FROM public.sla_config WHERE id = v_nuevo;
      GET DIAGNOSTICS v_filas = ROW_COUNT;
      IF v_filas <> 1 THEN RAISE EXCEPTION 'Admin perdio DELETE de SLA'; END IF;
      PERFORM pg_temp.qms_insert('catalogos', pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid(),
        'tipo','categoria_riesgo','modulo','riesgos','valor','Fixture insercion QMS', 'valor_interno','Fixture insercion QMS',
        'codigo','qms_audit_' || replace(pg_catalog.gen_random_uuid()::text,'-','_'),'activo',true));
    ELSE
      BEGIN
        PERFORM pg_temp.qms_insert('sla_config', pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid(),
          'proceso', 'qms_audit_' || pg_catalog.gen_random_uuid(), 'dias_alerta', 1, 'dias_vencimiento', 3));
        RAISE EXCEPTION 'No admin creo SLA';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN
        PERFORM pg_temp.qms_insert('catalogos', pg_catalog.jsonb_build_object('id', pg_catalog.gen_random_uuid(),
          'tipo','categoria_riesgo','modulo','riesgos','valor','Fixture insercion QMS','valor_interno','Fixture insercion QMS',
          'codigo','qms_audit_' || replace(pg_catalog.gen_random_uuid()::text,'-','_'),'activo',true));
        RAISE EXCEPTION 'No admin creo catalogo';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.formularios_publicos WHERE id = pg_catalog.current_setting('qms.audit.form_active')::uuid)
      THEN RAISE EXCEPTION 'Se bloqueo formulario ciudadano activo para authenticated'; END IF;
    IF EXISTS (SELECT 1 FROM public.formularios_publicos WHERE id = pg_catalog.current_setting('qms.audit.form_inactive')::uuid)
      IS DISTINCT FROM (v_actor = 'admin') THEN RAISE EXCEPTION 'Formulario inactivo expuesto fuera de admin'; END IF;
    PERFORM pg_temp.qms_crud('formularios_publicos', pg_catalog.current_setting('qms.audit.form_active')::uuid,
      '{"nombre":"Fixture QMS","modulo":"quejas","activo":true}', true, v_actor = 'admin');

    IF EXISTS (SELECT 1 FROM public.configuraciones_sistema WHERE clave = '__qms_audit_config__')
      IS DISTINCT FROM (v_actor = 'admin') THEN RAISE EXCEPTION 'Configuracion ordinaria expuesta fuera de admin'; END IF;
    UPDATE public.configuraciones_sistema SET descripcion = 'Fixture QMS'
      WHERE clave = '__qms_audit_config__';
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> (CASE WHEN v_actor = 'admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Escritura de configuracion no exclusiva admin'; END IF;
    IF v_actor = 'admin' THEN
      INSERT INTO public.configuraciones_sistema (clave, valor) VALUES ('__qms_audit_admin_created__', '{}');
      DELETE FROM public.configuraciones_sistema WHERE clave = '__qms_audit_admin_created__';
      GET DIAGNOSTICS v_filas = ROW_COUNT;
      IF v_filas <> 1 THEN RAISE EXCEPTION 'Admin perdio DELETE de configuracion ordinaria'; END IF;
    ELSE
      DELETE FROM public.configuraciones_sistema WHERE clave = '__qms_audit_config__';
      GET DIAGNOSTICS v_filas = ROW_COUNT;
      IF v_filas <> 0 THEN RAISE EXCEPTION 'No admin borro configuracion'; END IF;
      BEGIN
        INSERT INTO public.configuraciones_sistema (clave, valor) VALUES ('__qms_audit_denied_' || pg_catalog.gen_random_uuid(), '{}');
        RAISE EXCEPTION 'No admin creo configuracion';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END IF;
    v_ai_permitido := v_actor = 'admin' AND NOT COALESCE(pg_catalog.current_setting('qms.audit.expect_ai_isolated', true), 'false')::boolean;
    IF EXISTS (SELECT 1 FROM public.configuraciones_sistema WHERE clave = 'ai___qms_audit_secret__')
      IS DISTINCT FROM v_ai_permitido THEN RAISE EXCEPTION 'Configuracion IA no coincide con fase A/B'; END IF;
    UPDATE public.configuraciones_sistema SET descripcion = 'Fixture IA' WHERE clave = 'ai___qms_audit_secret__';
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas <> (CASE WHEN v_ai_permitido THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'UPDATE IA no coincide con aislamiento'; END IF;
    IF v_ai_permitido THEN
      INSERT INTO public.configuraciones_sistema (clave, valor) VALUES ('ai___qms_audit_created__', '{}');
      DELETE FROM public.configuraciones_sistema WHERE clave = 'ai___qms_audit_created__';
      GET DIAGNOSTICS v_filas = ROW_COUNT;
      IF v_filas <> 1 THEN RAISE EXCEPTION 'Admin perdio DELETE IA durante fase A'; END IF;
    ELSE
      BEGIN
        INSERT INTO public.configuraciones_sistema (clave, valor) VALUES ('ai___qms_audit_denied_' || pg_catalog.gen_random_uuid(), '{}');
        RAISE EXCEPTION 'Cliente pudo crear configuracion IA restringida';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      DELETE FROM public.configuraciones_sistema WHERE clave = 'ai___qms_audit_secret__';
      GET DIAGNOSTICS v_filas = ROW_COUNT;
      IF v_filas <> 0 THEN RAISE EXCEPTION 'Cliente borro configuracion IA restringida'; END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM public.tareas WHERE id = pg_catalog.current_setting('qms.audit.tarea_propia')::uuid)
      IS DISTINCT FROM (v_actor IN ('admin', 'reader')) THEN RAISE EXCEPTION 'Tarea propia no usa usuarios.id y perfil activo'; END IF;
    IF EXISTS (SELECT 1 FROM public.tareas WHERE id = pg_catalog.current_setting('qms.audit.tarea_ajena')::uuid)
      IS DISTINCT FROM (v_actor = 'admin') THEN RAISE EXCEPTION 'Tarea ajena visible fuera de admin'; END IF;
    PERFORM pg_temp.qms_crud('tareas', pg_catalog.current_setting('qms.audit.tarea_propia')::uuid,
      '{"titulo":"Fixture QMS"}', v_actor IN ('admin', 'reader'), v_actor = 'admin');
  END LOOP;
END;
$test$;

-- Bypass de RLS: SECDEF de derivacion debe exigir ambos permisos reales.
DO $test$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('qms.audit.auth_staff'), 'role', 'authenticated')::text, true);
  IF NOT public.app_es_staff() OR NOT public.app_tiene_permiso('quejas', true) OR public.app_tiene_permiso('sacp', true)
    THEN RAISE EXCEPTION 'Fixture staff sin escritura SACP no representa el caso de prueba'; END IF;
  BEGIN
    PERFORM public.derivar_queja_a_sacp(pg_catalog.current_setting('qms.audit.queja_derivacion')::uuid);
    RAISE EXCEPTION 'Derivacion SECDEF omite permiso SACP de escritura';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF has_function_privilege('authenticated', 'public.incrementar_tokens_proveedor(text,integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.transicionar_queja(uuid,text,text,text,uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.actualizar_detalles_queja(uuid,text,text,uuid,text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'Se reabrieron RPC legacy o consumo IA al navegador'; END IF;
END;
$test$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $test$
DECLARE v_case record; v_existe boolean; v_filas integer;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claims', '{}', true);
  FOR v_case IN SELECT * FROM qms_audit_cases LOOP
    BEGIN
      EXECUTE pg_catalog.format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1)', v_case.tabla)
        INTO v_existe USING v_case.id;
      IF v_existe THEN RAISE EXCEPTION 'Anon lee tabla privada %', v_case.tabla; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM pg_temp.qms_insert(v_case.tabla, pg_temp.qms_fresh(v_case.payload));
      RAISE EXCEPTION 'Anon inserta tabla privada %', v_case.tabla;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.catalogos WHERE id = pg_catalog.current_setting('qms.audit.catalogo_public_active')::uuid)
    THEN RAISE EXCEPTION 'Anon perdio categoria ciudadana activa'; END IF;
  IF EXISTS (SELECT 1 FROM public.catalogos WHERE id IN (
    pg_catalog.current_setting('qms.audit.catalogo_public_inactive')::uuid,
    pg_catalog.current_setting('qms.audit.catalogo_private_active')::uuid))
    THEN RAISE EXCEPTION 'Anon ve categorias inactivas o catalogos internos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formularios_publicos WHERE id = pg_catalog.current_setting('qms.audit.form_active')::uuid)
    OR EXISTS (SELECT 1 FROM public.formularios_publicos WHERE id = pg_catalog.current_setting('qms.audit.form_inactive')::uuid)
    THEN RAISE EXCEPTION 'Lectura ciudadana de formularios incorrecta'; END IF;
  BEGIN
    INSERT INTO public.formularios_publicos (nombre, modulo) VALUES ('Fixture prohibido', 'quejas');
    RAISE EXCEPTION 'Anon crea formularios';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF NOT has_function_privilege('anon', 'public.crear_queja_publica(text,text,text,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.notificar_queja_publica(text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'Se bloqueo ACL del flujo ciudadano'; END IF;
  IF has_function_privilege('anon', 'public.incrementar_tokens_proveedor(text,integer)', 'EXECUTE')
    THEN RAISE EXCEPTION 'Anon tiene consumo IA'; END IF;
END;
$test$;
RESET ROLE;

-- Validaciones se comprueban en INSERT y UPDATE incluso con bypass de RLS.
SET LOCAL ROLE service_role;
DO $test$
DECLARE v_case record; v_version text; v_filas integer;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  FOR v_case IN SELECT * FROM qms_audit_cases LOOP
    PERFORM pg_temp.qms_crud(v_case.tabla, v_case.id, v_case.payload, true, true);
  END LOOP;
  PERFORM pg_temp.qms_invalid('procesos', '{"nombre_proceso":"  "}');
  PERFORM pg_temp.qms_invalid('reuniones', '{"titulo":"  "}');
  PERFORM pg_temp.qms_invalid('documentos', '{"titulo":"  "}');
  PERFORM pg_temp.qms_invalid('documentos', '{"titulo":"Fixture QMS","codigo_doc":"  "}');
  PERFORM pg_temp.qms_invalid('acciones', '{"folio":"  "}');
  PERFORM pg_temp.qms_invalid('riesgos', '{"folio":"  "}');
  PERFORM pg_temp.qms_invalid('auditorias', '{"folio":"  "}');
  PERFORM pg_temp.qms_invalid('riesgos', '{"folio":"QMS-INVALID-PROB0","probabilidad":0}');
  PERFORM pg_temp.qms_invalid('riesgos', '{"folio":"QMS-INVALID-PROB4","probabilidad":4}');
  PERFORM pg_temp.qms_invalid('riesgos', '{"folio":"QMS-INVALID-IMP0","impacto":0}');
  PERFORM pg_temp.qms_invalid('riesgos', '{"folio":"QMS-INVALID-IMP4","impacto":4}');
  PERFORM pg_temp.qms_invalid('acciones', '{"folio":"QMS-INVALID-PCT-1","seguimiento_porcentaje":-1}');
  PERFORM pg_temp.qms_invalid('acciones', '{"folio":"QMS-INVALID-PCT101","seguimiento_porcentaje":101}');
  PERFORM pg_temp.qms_invalid('auditorias', '{"folio":"QMS-INVALID-FECHAS","fecha_inicio":"2026-01-02","fecha_fin":"2026-01-01"}');
  PERFORM pg_temp.qms_invalid('sla_config', '{"proceso":"qms_audit","dias_alerta":-1,"dias_vencimiento":3}');
  PERFORM pg_temp.qms_invalid('sla_config', '{"proceso":"qms_audit","dias_alerta":0,"dias_vencimiento":0}');
  PERFORM pg_temp.qms_invalid('sla_config', '{"proceso":"qms_audit","dias_alerta":4,"dias_vencimiento":3}');
  BEGIN
    UPDATE public.riesgos SET probabilidad = 0 WHERE id = (SELECT id FROM qms_audit_cases WHERE tabla = 'riesgos');
    RAISE EXCEPTION 'UPDATE evade escala de riesgo';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.auditorias SET fecha_fin = '2025-12-31' WHERE id = pg_catalog.current_setting('qms.audit.auditoria')::uuid;
    RAISE EXCEPTION 'UPDATE evade orden de fechas';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF NOT has_table_privilege('service_role', 'public.usuarios', 'UPDATE') THEN
    RAISE EXCEPTION 'La API administrativa perdio privilegios'; END IF;

  -- La proyeccion de xmin no contiene datos sensibles. La verificacion REST
  -- separada debe confirmar que PostgREST lo soporta en el proyecto desplegado.
  SELECT xmin::text INTO v_version FROM public.configuraciones_sistema WHERE clave = '__qms_audit_config__';
  IF v_version IS NULL THEN RAISE EXCEPTION 'xmin no disponible para CAS'; END IF;
  UPDATE public.configuraciones_sistema SET descripcion = 'Fixture CAS'
    WHERE clave = '__qms_audit_config__' AND xmin::text = v_version;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'CAS sobre xmin no acepta version vigente'; END IF;
END;
$test$;
RESET ROLE;

-- Copia sintetica de proveedores dentro de la transaccion: no se extrae ni se
-- imprime el JSONB original. ROLLBACK conserva la configuracion real intacta.
INSERT INTO public.configuraciones_sistema (clave, valor, categoria)
  VALUES ('ai_providers', '[{"id":"__qms_audit__","tokens_usados":0}]', 'ia')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
SET LOCAL ROLE service_role;
DO $test$
DECLARE v_tokens bigint;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM public.incrementar_tokens_proveedor('__qms_audit__', 7);
  PERFORM public.incrementar_tokens_proveedor('__qms_audit__', 3);
  SELECT (item->>'tokens_usados')::bigint INTO v_tokens
    FROM public.configuraciones_sistema c CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(c.valor) item
    WHERE c.clave = 'ai_providers' AND item->>'id' = '__qms_audit__';
  IF v_tokens IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Contador IA no acumula consumo'; END IF;
  BEGIN
    PERFORM public.incrementar_tokens_proveedor('__qms_audit__', -1);
    RAISE EXCEPTION 'Se acepto consumo negativo';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$test$;

-- PASS solo significa que se completaron las aserciones, no persiste fixtures.
RESET ROLE;
SELECT 'PASS: RLS, ACL, perfiles activos, flujos publicos, checks y consumo IA; fixtures descartados con ROLLBACK' AS resultado;
ROLLBACK;

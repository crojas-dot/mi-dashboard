-- Regresión real de RLS/ACL. Todos los perfiles, documentos y contadores de
-- prueba existen únicamente en esta transacción y se descartan con ROLLBACK.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $prueba$
DECLARE v_rol text; v_auth uuid; v_usuario uuid; v_doc uuid; v_aud uuid; v_informe uuid; v_queja uuid;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['admin', 'calidad', 'colaborador', 'inactivo'] LOOP
    v_auth := gen_random_uuid(); v_usuario := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
      VALUES (v_auth, 'qms-audit-' || v_auth || '@example.invalid', 'authenticated', 'authenticated');
    INSERT INTO public.usuarios (id, auth_id, nombre, email, rol, estado)
      VALUES (v_usuario, v_auth, 'Prueba transaccional QMS', 'qms-audit-' || v_auth || '@example.invalid',
        CASE WHEN v_rol = 'inactivo' THEN 'admin' ELSE v_rol END,
        CASE WHEN v_rol = 'inactivo' THEN 'inactivo' ELSE 'activo' END);
    PERFORM set_config('qms.audit.auth_' || v_rol, v_auth::text, true);
    PERFORM set_config('qms.audit.user_' || v_rol, v_usuario::text, true);
  END LOOP;
  INSERT INTO public.documentos (titulo, version_actual, estado)
    VALUES ('Prueba transaccional QMS', '1.0', 'Borrador') RETURNING id INTO v_doc;
  INSERT INTO public.auditorias (folio, tipo, estado)
    VALUES ('QMS-AUDIT-' || gen_random_uuid(), 'Interna', 'Planificada') RETURNING id INTO v_aud;
  INSERT INTO public.informes_config (nombre, modulo, creado_por)
    VALUES ('Prueba transaccional QMS', 'quejas', current_setting('qms.audit.user_calidad')::uuid)
    RETURNING id INTO v_informe;
  INSERT INTO public.quejas (folio, cliente_nombre, estado, responsable_id, fecha)
    VALUES ('QMS-AUDIT-' || gen_random_uuid(), 'Prueba transaccional QMS', 'Finalizado',
      current_setting('qms.audit.user_colaborador')::uuid, now()) RETURNING id INTO v_queja;
  INSERT INTO public.quejas_comentarios (queja_id, usuario_id, comentario, tipo)
    VALUES (v_queja, current_setting('qms.audit.user_admin')::uuid, 'Prueba transaccional QMS', 'interno');
  INSERT INTO public.quejas (folio, cliente_nombre, estado, responsable_id, fecha)
    VALUES ('QMS-AUDIT-' || gen_random_uuid(), 'Prueba transaccional QMS', 'Finalizado',
      current_setting('qms.audit.user_admin')::uuid, now());
  PERFORM set_config('qms.audit.doc', v_doc::text, true);
  PERFORM set_config('qms.audit.aud', v_aud::text, true);
  PERFORM set_config('qms.audit.informe', v_informe::text, true);
END;
$prueba$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('qms.audit.auth_admin'), 'role', 'authenticated')::text, true);
DO $prueba$
DECLARE v_filas integer;
BEGIN
  IF NOT public.app_es_admin() THEN RAISE EXCEPTION 'Admin activo no reconocido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.documentos WHERE id = current_setting('qms.audit.doc')::uuid)
    THEN RAISE EXCEPTION 'Admin perdió lectura de documentos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auditorias WHERE id = current_setting('qms.audit.aud')::uuid)
    THEN RAISE EXCEPTION 'Admin perdió lectura de auditorías'; END IF;
  UPDATE public.documentos SET version_actual = '1.1' WHERE id = current_setting('qms.audit.doc')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'Admin perdió escritura documental'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.informes_config WHERE id = current_setting('qms.audit.informe')::uuid)
    THEN RAISE EXCEPTION 'Admin perdió lectura de informes'; END IF;
END;
$prueba$;

SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('qms.audit.auth_calidad'), 'role', 'authenticated')::text, true);
DO $prueba$
DECLARE v_filas integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documentos WHERE id = current_setting('qms.audit.doc')::uuid)
    THEN RAISE EXCEPTION 'Calidad perdió lectura autorizada'; END IF;
  UPDATE public.documentos SET version_actual = '1.2' WHERE id = current_setting('qms.audit.doc')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'Calidad perdió escritura autorizada'; END IF;
  UPDATE public.auditorias SET tipo = 'Interna' WHERE id = current_setting('qms.audit.aud')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'Calidad perdió escritura de auditorías'; END IF;
  UPDATE public.informes_config SET nombre = 'Prueba propia' WHERE id = current_setting('qms.audit.informe')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'Calidad perdió edición de su informe'; END IF;
  BEGIN
    UPDATE public.informes_config SET creado_por = current_setting('qms.audit.user_admin')::uuid
      WHERE id = current_setting('qms.audit.informe')::uuid;
    RAISE EXCEPTION 'Se pudo transferir un informe sin permiso';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.usuarios SET rol = 'admin' WHERE id = current_setting('qms.audit.user_calidad')::uuid;
    RAISE EXCEPTION 'Se pudo escalar el rol propio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.usuarios SET estado = 'inactivo' WHERE id = current_setting('qms.audit.user_calidad')::uuid;
    RAISE EXCEPTION 'Se pudo cambiar el estado propio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.usuarios SET auth_id = gen_random_uuid() WHERE id = current_setting('qms.audit.user_calidad')::uuid;
    RAISE EXCEPTION 'Se pudo cambiar la identidad propia';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.usuarios SET notif_sonido = false WHERE id = current_setting('qms.audit.user_calidad')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN RAISE EXCEPTION 'Se bloquearon las preferencias propias'; END IF;
  UPDATE public.usuarios SET notif_sonido = false WHERE id = current_setting('qms.audit.user_admin')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 0 THEN RAISE EXCEPTION 'Se pudo editar el perfil ajeno'; END IF;
  PERFORM public.actualizar_mis_preferencias_notificacion(true, true, 'notification/info');
  IF has_function_privilege('authenticated', 'public.incrementar_tokens_proveedor(text,integer)', 'EXECUTE')
    THEN RAISE EXCEPTION 'El navegador puede alterar consumo IA'; END IF;
  IF has_function_privilege('authenticated', 'public.transicionar_queja(uuid,text,text,text,uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.actualizar_detalles_queja(uuid,text,text,uuid,text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'Se reabrieron los RPC que omiten revisión concurrente'; END IF;
END;
$prueba$;

RESET ROLE;
UPDATE public.permisos SET escribir = false WHERE rol = 'calidad' AND modulo = 'documentos';
SET LOCAL ROLE authenticated;
DO $prueba$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documentos WHERE id = current_setting('qms.audit.doc')::uuid)
    THEN RAISE EXCEPTION 'Quitar escritura eliminó lectura'; END IF;
  BEGIN
    INSERT INTO public.documentos (titulo, estado) VALUES ('No autorizado', 'Borrador');
    RAISE EXCEPTION 'Un permiso solo lectura permitió crear';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$prueba$;
RESET ROLE;
UPDATE public.permisos SET escribir = true WHERE rol = 'calidad' AND modulo = 'documentos';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('qms.audit.auth_colaborador'), 'role', 'authenticated', 'user_metadata', json_build_object('rol', 'admin'))::text, true);
DO $prueba$
DECLARE v_total bigint; v_filas integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.documentos) OR EXISTS (SELECT 1 FROM public.auditorias)
    OR EXISTS (SELECT 1 FROM public.informes_config) THEN RAISE EXCEPTION 'Colaborador sin permisos vio módulos restringidos'; END IF;
  SELECT count(*) INTO v_total FROM public.quejas;
  IF v_total <> 1 THEN RAISE EXCEPTION 'Colaborador no ve exactamente su queja de prueba'; END IF;
  IF (public.obtener_estadisticas_quejas()->>'total')::bigint <> v_total
    THEN RAISE EXCEPTION 'Estadísticas evadieron RLS'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = current_setting('qms.audit.user_admin')::uuid)
    THEN RAISE EXCEPTION 'Se ocultó el autor de un comentario visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id NOT IN
    (current_setting('qms.audit.user_colaborador')::uuid, current_setting('qms.audit.user_admin')::uuid))
    THEN RAISE EXCEPTION 'Colaborador puede leer perfiles no relacionados'; END IF;
  BEGIN
    INSERT INTO public.auditorias (folio) VALUES ('QMS-BLOCKED-' || gen_random_uuid());
    RAISE EXCEPTION 'Colaborador puede crear auditorías';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.documentos SET version_actual = '2.0' WHERE id = current_setting('qms.audit.doc')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 0 THEN RAISE EXCEPTION 'Colaborador modificó un documento'; END IF;
END;
$prueba$;

SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('qms.audit.auth_inactivo'), 'role', 'authenticated')::text, true);
DO $prueba$
DECLARE v_filas integer;
BEGIN
  IF public.app_usuario_actual_id() IS NOT NULL OR public.current_usuario_id() IS NOT NULL
    OR public.current_rol() IS NOT NULL OR public.app_es_admin() THEN RAISE EXCEPTION 'Cuenta inactiva conserva identidad operativa'; END IF;
  IF EXISTS (SELECT 1 FROM public.documentos) OR EXISTS (SELECT 1 FROM public.auditorias)
    OR EXISTS (SELECT 1 FROM public.informes_config) THEN RAISE EXCEPTION 'Cuenta inactiva conserva acceso a módulos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = current_setting('qms.audit.user_inactivo')::uuid)
    THEN RAISE EXCEPTION 'Login no puede leer el estado de su propio perfil'; END IF;
  BEGIN
    PERFORM public.actualizar_mis_preferencias_notificacion(true, true, 'notification/info');
    RAISE EXCEPTION 'Cuenta inactiva ejecutó preferencias';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.usuarios SET nombre = 'No autorizado' WHERE id = current_setting('qms.audit.user_inactivo')::uuid;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 0 THEN RAISE EXCEPTION 'Cuenta inactiva modificó su perfil'; END IF;
END;
$prueba$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
DO $prueba$
DECLARE v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['usuarios', 'documentos', 'auditorias', 'informes_config'] LOOP
    IF has_table_privilege('anon', 'public.' || v_tabla, 'SELECT')
      OR has_table_privilege('anon', 'public.' || v_tabla, 'TRUNCATE')
      OR has_table_privilege('authenticated', 'public.' || v_tabla, 'TRUNCATE')
      THEN RAISE EXCEPTION 'Privilegio de tabla excesivo: %', v_tabla; END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.obtener_estadisticas_quejas()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.crear_queja_interna(text,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.incrementar_tokens_proveedor(text,integer)', 'EXECUTE')
    THEN RAISE EXCEPTION 'RPC interno sigue expuesto a anon'; END IF;
  IF NOT has_function_privilege('anon', 'public.crear_queja_publica(text,text,text,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.notificar_queja_publica(text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'Se bloqueó el flujo público'; END IF;
END;
$prueba$;

RESET ROLE;
-- El contenido privado de proveedores nunca sale de la BD. Solo añadir un
-- proveedor ficticio a la copia transaccional para verificar el incremento.
UPDATE public.configuraciones_sistema SET valor = valor ||
  '[{"id":"__qms_audit__","tokens_usados":0}]'::jsonb WHERE clave = 'ai_providers';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.incrementar_tokens_proveedor('__qms_audit__', 7);
SELECT public.incrementar_tokens_proveedor('__qms_audit__', 3);
DO $prueba$
DECLARE v_tokens bigint;
BEGIN
  SELECT (item->>'tokens_usados')::bigint INTO v_tokens
  FROM public.configuraciones_sistema c CROSS JOIN LATERAL jsonb_array_elements(c.valor) item
  WHERE c.clave = 'ai_providers' AND item->>'id' = '__qms_audit__';
  IF v_tokens IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'El incremento IA no acumula correctamente'; END IF;
  BEGIN
    PERFORM public.incrementar_tokens_proveedor('__qms_audit__', -1);
    RAISE EXCEPTION 'Se permitió un consumo negativo';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF NOT has_table_privilege('service_role', 'public.usuarios', 'UPDATE')
    THEN RAISE EXCEPTION 'Se bloquearon las API administrativas'; END IF;
END;
$prueba$;
RESET ROLE;
ROLLBACK;

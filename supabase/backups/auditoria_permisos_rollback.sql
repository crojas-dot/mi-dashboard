-- Recuperación opcional: restaurar solo metadatos anteriores. NO ejecutar automáticamente.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=public,pg_catalog;
DROP TRIGGER IF EXISTS qms_auditorias_fechas_validas ON public.auditorias;
DROP FUNCTION IF EXISTS public.app_validar_fechas_auditoria();
ALTER TABLE public."procesos" DROP CONSTRAINT IF EXISTS "qms_procesos_nombre_nonblank";
ALTER TABLE public."reuniones" DROP CONSTRAINT IF EXISTS "qms_reuniones_titulo_nonblank";
ALTER TABLE public."documentos" DROP CONSTRAINT IF EXISTS "qms_documentos_titulo_nonblank";
ALTER TABLE public."documentos" DROP CONSTRAINT IF EXISTS "qms_documentos_codigo_nonblank";
ALTER TABLE public."acciones" DROP CONSTRAINT IF EXISTS "qms_acciones_folio_nonblank";
ALTER TABLE public."riesgos" DROP CONSTRAINT IF EXISTS "qms_riesgos_folio_nonblank";
ALTER TABLE public."auditorias" DROP CONSTRAINT IF EXISTS "qms_auditorias_folio_nonblank";
ALTER TABLE public."riesgos" DROP CONSTRAINT IF EXISTS "qms_riesgos_probabilidad_range";
ALTER TABLE public."riesgos" DROP CONSTRAINT IF EXISTS "qms_riesgos_impacto_range";
ALTER TABLE public."acciones" DROP CONSTRAINT IF EXISTS "qms_acciones_seguimiento_range";
ALTER TABLE public."sla_config" DROP CONSTRAINT IF EXISTS "qms_sla_plazos_range";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='acciones' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'acciones');END LOOP;END;$restore$;
REVOKE ALL ON public."acciones" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","folio","tipo","origen","origen_id","descripcion","responsable_id","fecha_limite","estado","prioridad","seguimiento_porcentaje","validado_por_gc","eficacia","notas","fecha_apertura") ON public."acciones" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_acciones" ON public."acciones" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."acciones" TO "anon";
GRANT SELECT ON public."acciones" TO "anon";
GRANT UPDATE ON public."acciones" TO "anon";
GRANT DELETE ON public."acciones" TO "anon";
GRANT TRUNCATE ON public."acciones" TO "anon";
GRANT REFERENCES ON public."acciones" TO "anon";
GRANT TRIGGER ON public."acciones" TO "anon";
GRANT INSERT ON public."acciones" TO "authenticated";
GRANT SELECT ON public."acciones" TO "authenticated";
GRANT UPDATE ON public."acciones" TO "authenticated";
GRANT DELETE ON public."acciones" TO "authenticated";
GRANT TRUNCATE ON public."acciones" TO "authenticated";
GRANT REFERENCES ON public."acciones" TO "authenticated";
GRANT TRIGGER ON public."acciones" TO "authenticated";
GRANT INSERT ON public."acciones" TO "service_role";
GRANT SELECT ON public."acciones" TO "service_role";
GRANT UPDATE ON public."acciones" TO "service_role";
GRANT DELETE ON public."acciones" TO "service_role";
GRANT TRUNCATE ON public."acciones" TO "service_role";
GRANT REFERENCES ON public."acciones" TO "service_role";
GRANT TRIGGER ON public."acciones" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='riesgos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'riesgos');END LOOP;END;$restore$;
REVOKE ALL ON public."riesgos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","folio","tipo","categoria","descripcion","causa","efecto","probabilidad","impacto","nivel","responsable_id","estado","accion_mitigacion","fecha_identificacion") ON public."riesgos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_riesgos" ON public."riesgos" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."riesgos" TO "anon";
GRANT SELECT ON public."riesgos" TO "anon";
GRANT UPDATE ON public."riesgos" TO "anon";
GRANT DELETE ON public."riesgos" TO "anon";
GRANT TRUNCATE ON public."riesgos" TO "anon";
GRANT REFERENCES ON public."riesgos" TO "anon";
GRANT TRIGGER ON public."riesgos" TO "anon";
GRANT INSERT ON public."riesgos" TO "authenticated";
GRANT SELECT ON public."riesgos" TO "authenticated";
GRANT UPDATE ON public."riesgos" TO "authenticated";
GRANT DELETE ON public."riesgos" TO "authenticated";
GRANT TRUNCATE ON public."riesgos" TO "authenticated";
GRANT REFERENCES ON public."riesgos" TO "authenticated";
GRANT TRIGGER ON public."riesgos" TO "authenticated";
GRANT INSERT ON public."riesgos" TO "service_role";
GRANT SELECT ON public."riesgos" TO "service_role";
GRANT UPDATE ON public."riesgos" TO "service_role";
GRANT DELETE ON public."riesgos" TO "service_role";
GRANT TRUNCATE ON public."riesgos" TO "service_role";
GRANT REFERENCES ON public."riesgos" TO "service_role";
GRANT TRIGGER ON public."riesgos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='procesos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'procesos');END LOOP;END;$restore$;
REVOKE ALL ON public."procesos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","nombre_proceso","tipo","objetivo","responsable_id","documentos_vinculados","kpis","estado","created_at") ON public."procesos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_procesos" ON public."procesos" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."procesos" TO "anon";
GRANT SELECT ON public."procesos" TO "anon";
GRANT UPDATE ON public."procesos" TO "anon";
GRANT DELETE ON public."procesos" TO "anon";
GRANT TRUNCATE ON public."procesos" TO "anon";
GRANT REFERENCES ON public."procesos" TO "anon";
GRANT TRIGGER ON public."procesos" TO "anon";
GRANT INSERT ON public."procesos" TO "authenticated";
GRANT SELECT ON public."procesos" TO "authenticated";
GRANT UPDATE ON public."procesos" TO "authenticated";
GRANT DELETE ON public."procesos" TO "authenticated";
GRANT TRUNCATE ON public."procesos" TO "authenticated";
GRANT REFERENCES ON public."procesos" TO "authenticated";
GRANT TRIGGER ON public."procesos" TO "authenticated";
GRANT INSERT ON public."procesos" TO "service_role";
GRANT SELECT ON public."procesos" TO "service_role";
GRANT UPDATE ON public."procesos" TO "service_role";
GRANT DELETE ON public."procesos" TO "service_role";
GRANT TRUNCATE ON public."procesos" TO "service_role";
GRANT REFERENCES ON public."procesos" TO "service_role";
GRANT TRIGGER ON public."procesos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reuniones' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'reuniones');END LOOP;END;$restore$;
REVOKE ALL ON public."reuniones" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","titulo","tipo","fecha_programada","hora","duracion","organizador_id","participantes","agenda","estado","acta_drive_id","acuerdos","created_at") ON public."reuniones" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_reuniones" ON public."reuniones" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."reuniones" TO "anon";
GRANT SELECT ON public."reuniones" TO "anon";
GRANT UPDATE ON public."reuniones" TO "anon";
GRANT DELETE ON public."reuniones" TO "anon";
GRANT TRUNCATE ON public."reuniones" TO "anon";
GRANT REFERENCES ON public."reuniones" TO "anon";
GRANT TRIGGER ON public."reuniones" TO "anon";
GRANT INSERT ON public."reuniones" TO "authenticated";
GRANT SELECT ON public."reuniones" TO "authenticated";
GRANT UPDATE ON public."reuniones" TO "authenticated";
GRANT DELETE ON public."reuniones" TO "authenticated";
GRANT TRUNCATE ON public."reuniones" TO "authenticated";
GRANT REFERENCES ON public."reuniones" TO "authenticated";
GRANT TRIGGER ON public."reuniones" TO "authenticated";
GRANT INSERT ON public."reuniones" TO "service_role";
GRANT SELECT ON public."reuniones" TO "service_role";
GRANT UPDATE ON public."reuniones" TO "service_role";
GRANT DELETE ON public."reuniones" TO "service_role";
GRANT TRUNCATE ON public."reuniones" TO "service_role";
GRANT REFERENCES ON public."reuniones" TO "service_role";
GRANT TRIGGER ON public."reuniones" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hallazgos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'hallazgos');END LOOP;END;$restore$;
REVOKE ALL ON public."hallazgos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","auditoria_id","tipo","descripcion","evidencia","requisito","estado","responsable_id","derivado_sacp_id","created_at") ON public."hallazgos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_hallazgos" ON public."hallazgos" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."hallazgos" TO "anon";
GRANT SELECT ON public."hallazgos" TO "anon";
GRANT UPDATE ON public."hallazgos" TO "anon";
GRANT DELETE ON public."hallazgos" TO "anon";
GRANT TRUNCATE ON public."hallazgos" TO "anon";
GRANT REFERENCES ON public."hallazgos" TO "anon";
GRANT TRIGGER ON public."hallazgos" TO "anon";
GRANT INSERT ON public."hallazgos" TO "authenticated";
GRANT SELECT ON public."hallazgos" TO "authenticated";
GRANT UPDATE ON public."hallazgos" TO "authenticated";
GRANT DELETE ON public."hallazgos" TO "authenticated";
GRANT TRUNCATE ON public."hallazgos" TO "authenticated";
GRANT REFERENCES ON public."hallazgos" TO "authenticated";
GRANT TRIGGER ON public."hallazgos" TO "authenticated";
GRANT INSERT ON public."hallazgos" TO "service_role";
GRANT SELECT ON public."hallazgos" TO "service_role";
GRANT UPDATE ON public."hallazgos" TO "service_role";
GRANT DELETE ON public."hallazgos" TO "service_role";
GRANT TRUNCATE ON public."hallazgos" TO "service_role";
GRANT REFERENCES ON public."hallazgos" TO "service_role";
GRANT TRIGGER ON public."hallazgos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='documento_versiones' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'documento_versiones');END LOOP;END;$restore$;
REVOKE ALL ON public."documento_versiones" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","documento_id","version","drive_file_id_historico","motivo_cambio","aprobado_por","fecha_version") ON public."documento_versiones" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_documento_versiones" ON public."documento_versiones" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."documento_versiones" TO "anon";
GRANT SELECT ON public."documento_versiones" TO "anon";
GRANT UPDATE ON public."documento_versiones" TO "anon";
GRANT DELETE ON public."documento_versiones" TO "anon";
GRANT TRUNCATE ON public."documento_versiones" TO "anon";
GRANT REFERENCES ON public."documento_versiones" TO "anon";
GRANT TRIGGER ON public."documento_versiones" TO "anon";
GRANT INSERT ON public."documento_versiones" TO "authenticated";
GRANT SELECT ON public."documento_versiones" TO "authenticated";
GRANT UPDATE ON public."documento_versiones" TO "authenticated";
GRANT DELETE ON public."documento_versiones" TO "authenticated";
GRANT TRUNCATE ON public."documento_versiones" TO "authenticated";
GRANT REFERENCES ON public."documento_versiones" TO "authenticated";
GRANT TRIGGER ON public."documento_versiones" TO "authenticated";
GRANT INSERT ON public."documento_versiones" TO "service_role";
GRANT SELECT ON public."documento_versiones" TO "service_role";
GRANT UPDATE ON public."documento_versiones" TO "service_role";
GRANT DELETE ON public."documento_versiones" TO "service_role";
GRANT TRUNCATE ON public."documento_versiones" TO "service_role";
GRANT REFERENCES ON public."documento_versiones" TO "service_role";
GRANT TRIGGER ON public."documento_versiones" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='versiones_documentos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'versiones_documentos');END LOOP;END;$restore$;
REVOKE ALL ON public."versiones_documentos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","documento_id","version","cambios","autor_id","fecha") ON public."versiones_documentos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_versiones_documentos" ON public."versiones_documentos" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."versiones_documentos" TO "anon";
GRANT SELECT ON public."versiones_documentos" TO "anon";
GRANT UPDATE ON public."versiones_documentos" TO "anon";
GRANT DELETE ON public."versiones_documentos" TO "anon";
GRANT TRUNCATE ON public."versiones_documentos" TO "anon";
GRANT REFERENCES ON public."versiones_documentos" TO "anon";
GRANT TRIGGER ON public."versiones_documentos" TO "anon";
GRANT INSERT ON public."versiones_documentos" TO "authenticated";
GRANT SELECT ON public."versiones_documentos" TO "authenticated";
GRANT UPDATE ON public."versiones_documentos" TO "authenticated";
GRANT DELETE ON public."versiones_documentos" TO "authenticated";
GRANT TRUNCATE ON public."versiones_documentos" TO "authenticated";
GRANT REFERENCES ON public."versiones_documentos" TO "authenticated";
GRANT TRIGGER ON public."versiones_documentos" TO "authenticated";
GRANT INSERT ON public."versiones_documentos" TO "service_role";
GRANT SELECT ON public."versiones_documentos" TO "service_role";
GRANT UPDATE ON public."versiones_documentos" TO "service_role";
GRANT DELETE ON public."versiones_documentos" TO "service_role";
GRANT TRUNCATE ON public."versiones_documentos" TO "service_role";
GRANT REFERENCES ON public."versiones_documentos" TO "service_role";
GRANT TRIGGER ON public."versiones_documentos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_documentales' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'solicitudes_documentales');END LOOP;END;$restore$;
REVOKE ALL ON public."solicitudes_documentales" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","tipo","solicitante_id","descripcion","justificacion","estado","revisor_id","nuevo_drive_file_id","fecha") ON public."solicitudes_documentales" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_solicitudes_documentales" ON public."solicitudes_documentales" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."solicitudes_documentales" TO "anon";
GRANT SELECT ON public."solicitudes_documentales" TO "anon";
GRANT UPDATE ON public."solicitudes_documentales" TO "anon";
GRANT DELETE ON public."solicitudes_documentales" TO "anon";
GRANT TRUNCATE ON public."solicitudes_documentales" TO "anon";
GRANT REFERENCES ON public."solicitudes_documentales" TO "anon";
GRANT TRIGGER ON public."solicitudes_documentales" TO "anon";
GRANT INSERT ON public."solicitudes_documentales" TO "authenticated";
GRANT SELECT ON public."solicitudes_documentales" TO "authenticated";
GRANT UPDATE ON public."solicitudes_documentales" TO "authenticated";
GRANT DELETE ON public."solicitudes_documentales" TO "authenticated";
GRANT TRUNCATE ON public."solicitudes_documentales" TO "authenticated";
GRANT REFERENCES ON public."solicitudes_documentales" TO "authenticated";
GRANT TRIGGER ON public."solicitudes_documentales" TO "authenticated";
GRANT INSERT ON public."solicitudes_documentales" TO "service_role";
GRANT SELECT ON public."solicitudes_documentales" TO "service_role";
GRANT UPDATE ON public."solicitudes_documentales" TO "service_role";
GRANT DELETE ON public."solicitudes_documentales" TO "service_role";
GRANT TRUNCATE ON public."solicitudes_documentales" TO "service_role";
GRANT REFERENCES ON public."solicitudes_documentales" TO "service_role";
GRANT TRIGGER ON public."solicitudes_documentales" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tareas' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'tareas');END LOOP;END;$restore$;
REVOKE ALL ON public."tareas" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","titulo","descripcion","responsable_id","fecha_limite","estado","prioridad","origen","created_at") ON public."tareas" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "authenticated_all_tareas" ON public."tareas" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
GRANT INSERT ON public."tareas" TO "anon";
GRANT SELECT ON public."tareas" TO "anon";
GRANT UPDATE ON public."tareas" TO "anon";
GRANT DELETE ON public."tareas" TO "anon";
GRANT TRUNCATE ON public."tareas" TO "anon";
GRANT REFERENCES ON public."tareas" TO "anon";
GRANT TRIGGER ON public."tareas" TO "anon";
GRANT INSERT ON public."tareas" TO "authenticated";
GRANT SELECT ON public."tareas" TO "authenticated";
GRANT UPDATE ON public."tareas" TO "authenticated";
GRANT DELETE ON public."tareas" TO "authenticated";
GRANT TRUNCATE ON public."tareas" TO "authenticated";
GRANT REFERENCES ON public."tareas" TO "authenticated";
GRANT TRIGGER ON public."tareas" TO "authenticated";
GRANT INSERT ON public."tareas" TO "service_role";
GRANT SELECT ON public."tareas" TO "service_role";
GRANT UPDATE ON public."tareas" TO "service_role";
GRANT DELETE ON public."tareas" TO "service_role";
GRANT TRUNCATE ON public."tareas" TO "service_role";
GRANT REFERENCES ON public."tareas" TO "service_role";
GRANT TRIGGER ON public."tareas" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='catalogos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'catalogos');END LOOP;END;$restore$;
REVOKE ALL ON public."catalogos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","tipo","valor","color","orden","activo","modulo","codigo","valor_interno") ON public."catalogos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "catalogos_admin_write" ON public."catalogos" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_es_admin()) WITH CHECK (app_es_admin());
CREATE POLICY "catalogos_anon_public_quejas" ON public."catalogos" AS PERMISSIVE FOR SELECT TO "anon" USING (((modulo = 'quejas'::text) AND (tipo = 'categoria_queja'::text) AND ((activo IS NULL) OR (activo = true))));
CREATE POLICY "catalogos_delete_admin" ON public."catalogos" AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin());
CREATE POLICY "catalogos_insert_admin" ON public."catalogos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (es_admin());
CREATE POLICY "catalogos_select" ON public."catalogos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "catalogos_staff_select" ON public."catalogos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_es_staff());
CREATE POLICY "catalogos_update_admin" ON public."catalogos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin()) WITH CHECK (es_admin());
GRANT INSERT ON public."catalogos" TO "anon";
GRANT SELECT ON public."catalogos" TO "anon";
GRANT UPDATE ON public."catalogos" TO "anon";
GRANT DELETE ON public."catalogos" TO "anon";
GRANT TRUNCATE ON public."catalogos" TO "anon";
GRANT REFERENCES ON public."catalogos" TO "anon";
GRANT TRIGGER ON public."catalogos" TO "anon";
GRANT INSERT ON public."catalogos" TO "authenticated";
GRANT SELECT ON public."catalogos" TO "authenticated";
GRANT UPDATE ON public."catalogos" TO "authenticated";
GRANT DELETE ON public."catalogos" TO "authenticated";
GRANT TRUNCATE ON public."catalogos" TO "authenticated";
GRANT REFERENCES ON public."catalogos" TO "authenticated";
GRANT TRIGGER ON public."catalogos" TO "authenticated";
GRANT INSERT ON public."catalogos" TO "service_role";
GRANT SELECT ON public."catalogos" TO "service_role";
GRANT UPDATE ON public."catalogos" TO "service_role";
GRANT DELETE ON public."catalogos" TO "service_role";
GRANT TRUNCATE ON public."catalogos" TO "service_role";
GRANT REFERENCES ON public."catalogos" TO "service_role";
GRANT TRIGGER ON public."catalogos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sla_config' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'sla_config');END LOOP;END;$restore$;
REVOKE ALL ON public."sla_config" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","proceso","prioridad","dias_alerta","dias_vencimiento") ON public."sla_config" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "sla_admin_write" ON public."sla_config" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_es_admin()) WITH CHECK (app_es_admin());
CREATE POLICY "sla_config_delete_admin" ON public."sla_config" AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin());
CREATE POLICY "sla_config_insert_admin" ON public."sla_config" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (es_admin());
CREATE POLICY "sla_config_select" ON public."sla_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "sla_config_update_admin" ON public."sla_config" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin()) WITH CHECK (es_admin());
CREATE POLICY "sla_staff_select" ON public."sla_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app_es_staff());
GRANT INSERT ON public."sla_config" TO "anon";
GRANT SELECT ON public."sla_config" TO "anon";
GRANT UPDATE ON public."sla_config" TO "anon";
GRANT DELETE ON public."sla_config" TO "anon";
GRANT TRUNCATE ON public."sla_config" TO "anon";
GRANT REFERENCES ON public."sla_config" TO "anon";
GRANT TRIGGER ON public."sla_config" TO "anon";
GRANT INSERT ON public."sla_config" TO "authenticated";
GRANT SELECT ON public."sla_config" TO "authenticated";
GRANT UPDATE ON public."sla_config" TO "authenticated";
GRANT DELETE ON public."sla_config" TO "authenticated";
GRANT TRUNCATE ON public."sla_config" TO "authenticated";
GRANT REFERENCES ON public."sla_config" TO "authenticated";
GRANT TRIGGER ON public."sla_config" TO "authenticated";
GRANT INSERT ON public."sla_config" TO "service_role";
GRANT SELECT ON public."sla_config" TO "service_role";
GRANT UPDATE ON public."sla_config" TO "service_role";
GRANT DELETE ON public."sla_config" TO "service_role";
GRANT TRUNCATE ON public."sla_config" TO "service_role";
GRANT REFERENCES ON public."sla_config" TO "service_role";
GRANT TRIGGER ON public."sla_config" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='formularios_publicos' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'formularios_publicos');END LOOP;END;$restore$;
REVOKE ALL ON public."formularios_publicos" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("id","modulo","nombre","token","activo","creado_por","created_at") ON public."formularios_publicos" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "formularios_publicos_admin_all" ON public."formularios_publicos" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_es_admin()) WITH CHECK (app_es_admin());
CREATE POLICY "formularios_publicos_delete_staff" ON public."formularios_publicos" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "formularios_publicos_insert_staff" ON public."formularios_publicos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "formularios_publicos_select_anon" ON public."formularios_publicos" AS PERMISSIVE FOR SELECT TO "anon" USING ((activo = true));
CREATE POLICY "formularios_publicos_select_staff" ON public."formularios_publicos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "formularios_publicos_update_staff" ON public."formularios_publicos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true);
GRANT INSERT ON public."formularios_publicos" TO "anon";
GRANT SELECT ON public."formularios_publicos" TO "anon";
GRANT UPDATE ON public."formularios_publicos" TO "anon";
GRANT DELETE ON public."formularios_publicos" TO "anon";
GRANT TRUNCATE ON public."formularios_publicos" TO "anon";
GRANT REFERENCES ON public."formularios_publicos" TO "anon";
GRANT TRIGGER ON public."formularios_publicos" TO "anon";
GRANT INSERT ON public."formularios_publicos" TO "authenticated";
GRANT SELECT ON public."formularios_publicos" TO "authenticated";
GRANT UPDATE ON public."formularios_publicos" TO "authenticated";
GRANT DELETE ON public."formularios_publicos" TO "authenticated";
GRANT TRUNCATE ON public."formularios_publicos" TO "authenticated";
GRANT REFERENCES ON public."formularios_publicos" TO "authenticated";
GRANT TRIGGER ON public."formularios_publicos" TO "authenticated";
GRANT INSERT ON public."formularios_publicos" TO "service_role";
GRANT SELECT ON public."formularios_publicos" TO "service_role";
GRANT UPDATE ON public."formularios_publicos" TO "service_role";
GRANT DELETE ON public."formularios_publicos" TO "service_role";
GRANT TRUNCATE ON public."formularios_publicos" TO "service_role";
GRANT REFERENCES ON public."formularios_publicos" TO "service_role";
GRANT TRIGGER ON public."formularios_publicos" TO "service_role";
DO $restore$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='configuraciones_sistema' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'configuraciones_sistema');END LOOP;END;$restore$;
REVOKE ALL ON public."configuraciones_sistema" FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ("clave","valor","descripcion","categoria") ON public."configuraciones_sistema" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY "config_admin_only" ON public."configuraciones_sistema" AS PERMISSIVE FOR ALL TO "authenticated" USING (app_es_admin()) WITH CHECK (app_es_admin());
CREATE POLICY "configuraciones_sistema_delete_admin" ON public."configuraciones_sistema" AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin());
CREATE POLICY "configuraciones_sistema_insert_admin" ON public."configuraciones_sistema" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (es_admin());
CREATE POLICY "configuraciones_sistema_select" ON public."configuraciones_sistema" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "configuraciones_sistema_update_admin" ON public."configuraciones_sistema" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin()) WITH CHECK (es_admin());
GRANT INSERT ON public."configuraciones_sistema" TO "anon";
GRANT SELECT ON public."configuraciones_sistema" TO "anon";
GRANT UPDATE ON public."configuraciones_sistema" TO "anon";
GRANT DELETE ON public."configuraciones_sistema" TO "anon";
GRANT TRUNCATE ON public."configuraciones_sistema" TO "anon";
GRANT REFERENCES ON public."configuraciones_sistema" TO "anon";
GRANT TRIGGER ON public."configuraciones_sistema" TO "anon";
GRANT INSERT ON public."configuraciones_sistema" TO "authenticated";
GRANT SELECT ON public."configuraciones_sistema" TO "authenticated";
GRANT UPDATE ON public."configuraciones_sistema" TO "authenticated";
GRANT DELETE ON public."configuraciones_sistema" TO "authenticated";
GRANT TRUNCATE ON public."configuraciones_sistema" TO "authenticated";
GRANT REFERENCES ON public."configuraciones_sistema" TO "authenticated";
GRANT TRIGGER ON public."configuraciones_sistema" TO "authenticated";
GRANT INSERT ON public."configuraciones_sistema" TO "service_role";
GRANT SELECT ON public."configuraciones_sistema" TO "service_role";
GRANT UPDATE ON public."configuraciones_sistema" TO "service_role";
GRANT DELETE ON public."configuraciones_sistema" TO "service_role";
GRANT TRUNCATE ON public."configuraciones_sistema" TO "service_role";
GRANT REFERENCES ON public."configuraciones_sistema" TO "service_role";
GRANT TRIGGER ON public."configuraciones_sistema" TO "service_role";
CREATE OR REPLACE FUNCTION public.app_es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_id = auth.uid()
      AND estado = 'activo'
      AND rol = 'admin'
  );
$function$
;
REVOKE EXECUTE ON FUNCTION public.app_es_admin() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_es_admin() TO "anon";
GRANT EXECUTE ON FUNCTION public.app_es_admin() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.app_es_admin() TO "service_role";
CREATE OR REPLACE FUNCTION public.app_es_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_id = auth.uid()
      AND estado = 'activo'
      AND rol IN ('admin', 'calidad')
  );
$function$
;
REVOKE EXECUTE ON FUNCTION public.app_es_staff() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_es_staff() TO "anon";
GRANT EXECUTE ON FUNCTION public.app_es_staff() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.app_es_staff() TO "service_role";
CREATE OR REPLACE FUNCTION public.app_tiene_permiso(p_modulo text, p_requiere_escribir boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.permisos p
    JOIN public.usuarios u ON u.rol = p.rol
    WHERE u.auth_id = auth.uid()
      AND u.estado = 'activo'
      AND p.modulo = p_modulo
      AND p.leer = true
      AND (NOT p_requiere_escribir OR p.escribir = true)
  );
$function$
;
REVOKE EXECUTE ON FUNCTION public.app_tiene_permiso(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_tiene_permiso(text,boolean) TO "anon";
GRANT EXECUTE ON FUNCTION public.app_tiene_permiso(text,boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.app_tiene_permiso(text,boolean) TO "service_role";
CREATE OR REPLACE FUNCTION public.derivar_queja_a_sacp(p_queja_id uuid)
 RETURNS acciones
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_queja public.quejas;
  v_accion public.acciones;
BEGIN
  IF NOT public.app_es_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_queja FROM public.quejas WHERE id = p_queja_id FOR UPDATE;
  IF v_queja.id IS NULL THEN RAISE EXCEPTION 'Queja no encontrada'; END IF;
  IF v_queja.estado NOT IN ('En Investigación', 'Resuelto') THEN
    RAISE EXCEPTION 'Sólo se puede derivar una queja en investigación o resuelta';
  END IF;
  IF v_queja.derivado_sacp_id IS NOT NULL THEN
    SELECT * INTO v_accion FROM public.acciones WHERE id = v_queja.derivado_sacp_id;
    RETURN v_accion;
  END IF;

  INSERT INTO public.acciones (
    folio, tipo, origen, origen_id, descripcion, estado,
    seguimiento_porcentaje, fecha_apertura
  ) VALUES (
    public.generar_folio_sacp(), 'Correctiva', 'queja', v_queja.id,
    COALESCE(v_queja.descripcion, v_queja.cliente_nombre), 'Abierta', 0, now()
  ) RETURNING * INTO v_accion;

  UPDATE public.quejas SET derivado_sacp_id = v_accion.id WHERE id = v_queja.id;
  INSERT INTO public.logs (fecha, usuario_id, accion, modulo, detalle)
  VALUES (now(), public.app_usuario_actual_id(), 'derivar', 'quejas', 'Queja ' || v_queja.folio || ' derivada a ' || v_accion.folio);
  RETURN v_accion;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.derivar_queja_a_sacp(uuid) TO "service_role";
COMMIT;

-- Solo metadatos: no devuelve IDs, nombres ni rutas de evidencias.
SELECT p.oid::regprocedure::text AS signature,
  NOT p.prosecdef AS invoker, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p
WHERE p.oid IN (
  'public.registrar_adjunto_queja_servidor(uuid,uuid,text,text,bigint,text)'::regprocedure,
  'public.registrar_adjunto_queja(uuid,text,text,bigint,text)'::regprocedure
);
SELECT rol, privilege,
  has_table_privilege(rol, 'public.queja_adjuntos', privilege) AS allowed
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rol)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(privilege)
ORDER BY rol, privilege;
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'queja_adjuntos';
SELECT attname AS column_name, attacl AS column_privileges
FROM pg_attribute WHERE attrelid = 'public.queja_adjuntos'::regclass
AND attnum > 0 AND NOT attisdropped;

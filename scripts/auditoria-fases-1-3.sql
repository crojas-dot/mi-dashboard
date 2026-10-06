-- Auditoría de solo lectura. No sustituir las políticas transaccionales de Quejas.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'quejas', 'permisos', 'documentos', 'auditorias', 'informes_config')
ORDER BY tablename;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar definición y columnas, no solo nombres: UNIQUE y PK también indexan.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'quejas', 'permisos', 'documentos')
ORDER BY tablename, indexname;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('usuarios', 'permisos')
ORDER BY table_name, ordinal_position;

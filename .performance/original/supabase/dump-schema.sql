-- DUMP ESQUEMA - proyecto fykhrrpeoehwqznccmfp

-- 1) TABLAS Y COLUMNAS
SELECT table_schema, table_name, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('public', 'dashboard')
ORDER BY table_schema, table_name, ordinal_position;

-- 2) CLAVES Y RELACIONES (PK, FK, UNIQUE)
SELECT tc.table_name, tc.constraint_type, tc.constraint_name,
       kcu.column_name,
       ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema IN ('public', 'dashboard')
ORDER BY tc.table_name;

-- 3) INDICES
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname IN ('public', 'dashboard')
ORDER BY tablename;

-- 4) RLS: estado por tabla
SELECT n.nspname AS schema, c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'dashboard') AND c.relkind = 'r'
ORDER BY c.relname;

-- 5) POLITICAS RLS
SELECT tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'dashboard')
ORDER BY tablename, policyname;

-- 6) FUNCIONES con codigo completo (lo mas importante)
SELECT n.nspname AS schema, p.proname AS nombre,
       pg_get_function_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS tipo_retorno,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'dashboard') AND p.prokind IN ('f', 'p')
ORDER BY p.proname;

-- 7) TRIGGERS
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'dashboard')
ORDER BY event_object_table;

-- 8) SECUENCIAS
SELECT sequence_schema, sequence_name
FROM information_schema.sequences
WHERE sequence_schema IN ('public', 'dashboard')
ORDER BY sequence_name;

-- 9) TIPOS ENUM
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS etiquetas
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname IN ('public', 'dashboard')
GROUP BY t.typname
ORDER BY t.typname;

-- 10) CONTEO DE FILAS POR TABLA (aprox.)
SELECT schemaname, relname AS tabla, n_live_tup AS filas_aprox
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'dashboard')
ORDER BY relname;

-- 11) DATOS DE CATALOGOS Y CONFIG
SELECT * FROM catalogos ORDER BY modulo, tipo, orden LIMIT 1000;
SELECT * FROM sla_config ORDER BY proceso, prioridad LIMIT 1000;
SELECT * FROM configuraciones_sistema ORDER BY categoria, clave LIMIT 1000;
SELECT * FROM usuarios ORDER BY created_at LIMIT 1000;

-- ============================================================
-- EXPORTAR ESTRUCTURA DE LA BASE DE DATOS (schema `public`)
-- ------------------------------------------------------------
-- CÓMO USARLO:
--   1. Abrí Supabase → SQL Editor → New query.
--   2. Pegá TODO este archivo y ejecutalo (Run).
--   3. Cada bloque devuelve una tabla de resultados.
--   4. Copiá cada resultado y pegalo al agente (o exportá a CSV/JSON).
--
-- Alternativa (más completa, vía CLI):
--   supabase link --project-ref <TU_REF>
--   supabase db dump --schema public > schema-dump.sql
-- ============================================================

-- 1) TABLAS y COLUMNAS ----------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  COALESCE(character_maximum_length, numeric_precision) AS max_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2) CONSTRAINTS (PK / FK / UNIQUE / CHECK) --------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(c.oid) AS definicion
FROM information_schema.table_constraints tc
JOIN pg_class tbl ON tbl.relname = tc.table_name AND tbl.relnamespace = 'public'::regnamespace
JOIN pg_constraint c ON c.conrelid = tbl.oid AND c.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 3) FUNCIONES (definición completa) ---------------------------
SELECT
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_function_result(p.oid) AS retorna,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.proname;

-- 4) TRIGGERS -------------------------------------------------
SELECT
  event_object_table AS tabla,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5) POLÍTICAS RLS --------------------------------------------
SELECT
  tablename AS tabla,
  policyname AS politica,
  cmd AS comando,
  qual AS using,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6) RLS HABILITADO POR TABLA ---------------------------------
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitado,
  c.relforcerowsecurity AS rls_forzado
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
ORDER BY c.relname;

-- 7) SECUENCIAS -----------------------------------------------
SELECT
  sequence_name,
  start_value,
  increment_by,
  last_value
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 8) ÍNDICES --------------------------------------------------
SELECT
  tablename AS tabla,
  indexname AS indice,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 9) TIPOS ENUM / DOMINIOS ------------------------------------
SELECT
  t.typname AS tipo,
  t.typtype,
  e.enumlabel AS valor_enum
FROM pg_type t
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typnamespace = 'public'::regnamespace
ORDER BY t.typname, e.enumsortorder;

-- 10) EXTENSIONES (pg_cron, etc.) ------------------------------
SELECT extname, extversion FROM pg_extension ORDER BY extname;

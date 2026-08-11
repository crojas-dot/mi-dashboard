-- ============================================================
-- ALINEAR DB AL CÓDIGO — LOGIN (tabla public.usuarios + Auth)
-- Ejecutar COMPLETO en el SQL Editor de Supabase.
--
-- Qué hace:
--   1) Renombra la tabla legacy `usuarios` (PasswordHash/Salt)
--      a `usuarios_legacy` para no perder los datos.
--   2) Crea la tabla `usuarios` moderna que espera el código
--      (con auth_id, rol, estado, etc.).
--   3) Enlaza el usuario de Supabase Auth ya creado
--      (c.rojas@eca.or.cr) con su auth_id.
--   4) Activa RLS y la policy que permite el login.
-- ============================================================

-- ------------------------------------------------
-- PASO 0 — DIAGNÓSTICO (opcional pero recomendado)
-- Confirma el nombre real de la tabla legacy.
-- ------------------------------------------------
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%usuario%';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
ORDER BY ordinal_position;

-- ------------------------------------------------
-- PASO 1 — Renombrar la tabla legacy (reversible)
-- Acepta que la legacy se llame `usuarios` o `Usuarios`.
-- ------------------------------------------------
DO $$
DECLARE
  legacy_tbl regclass := to_regclass('public.usuarios');
BEGIN
  IF legacy_tbl IS NULL THEN
    legacy_tbl := to_regclass('public."Usuarios"');
  END IF;
  IF legacy_tbl IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = LOWER('Usuarios')
         AND column_name = 'auth_id'
     ) THEN
    EXECUTE 'ALTER TABLE ' || legacy_tbl::text || ' RENAME TO usuarios_legacy';
  END IF;
END $$;

-- ------------------------------------------------
-- PASO 2 — Crear la tabla `usuarios` que espera el código
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  email text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL DEFAULT 'calidad',
  estado text NOT NULL DEFAULT 'activo',
  ultimo_acceso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usuarios_auth_id_idx ON public.usuarios (auth_id);

-- ------------------------------------------------
-- PASO 3 — Enlazar c.rojas@eca.or.cr con su auth_id
-- Intenta tomar nombre real de la tabla legacy;
-- si no existe, usa un valor por defecto.
-- ------------------------------------------------
-- 3a) Migrar desde la legacy si la fila existe.
-- Las columnas legacy se crearon con comillas ("Email", "Nombre"),
-- así que se referencian citadas. Si el esquema legacy difiere,
-- se omite la copia sin abortar el script.
DO $$
BEGIN
  IF to_regclass('public.usuarios_legacy') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
      INSERT INTO public.usuarios (auth_id, email, nombre, rol, estado, created_at)
      SELECT
        '8629ef0e-ed7f-4736-882c-9652d34d99a8',
        lower(btrim(u."Email")),
        COALESCE(NULLIF(btrim(u."Nombre"), ''), 'Carlos Rojas'),
        'admin',
        'activo',
        now()
      FROM public.usuarios_legacy u
      WHERE lower(btrim(u."Email")) = 'c.rojas@eca.or.cr'
        AND NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'c.rojas@eca.or.cr')
      $sql$;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      RAISE NOTICE 'No se copio nombre desde legacy; se usara el valor por defecto';
    END;
  END IF;
END $$;

-- 3b) Respaldo por si la legacy no tiene esa fila
INSERT INTO public.usuarios (auth_id, email, nombre, rol, estado, created_at)
SELECT '8629ef0e-ed7f-4736-882c-9652d34d99a8', 'c.rojas@eca.or.cr', 'Carlos Rojas', 'admin', 'activo', now()
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'c.rojas@eca.or.cr');

-- ------------------------------------------------
-- PASO 4 — RLS: permitir que cada usuario lea su fila
-- (necesario para el login: lib/auth.ts lee usuarios por auth_id)
-- ------------------------------------------------
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
CREATE POLICY "usuarios_select_own" ON public.usuarios
  FOR SELECT USING (auth_id = auth.uid());

-- ------------------------------------------------
-- PASO 5 — VERIFICACIÓN
-- ------------------------------------------------
SELECT id, auth_id, email, nombre, rol, estado, created_at
FROM public.usuarios
WHERE email = 'c.rojas@eca.or.cr';

-- ============================================================
-- LOGIN CONTRA TABLA usuarios (temporal, sin Supabase Auth)
-- 1) Agrega columna password_hash (SHA-256)
-- 2) Crea función SECURITY DEFINER login_usuario (bypasea RLS)
-- 3) Asigna contraseña temporal: c.rojas@eca.or.cr / 12345678
-- ============================================================

-- PASO 1 — Columna password_hash
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS password_hash text;

-- PASO 2 — Función de login (no expone la tabla a anon)
CREATE OR REPLACE FUNCTION public.login_usuario(p_email text, p_password_hash text)
RETURNS TABLE (id uuid, email text, nombre text, rol text, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.nombre, u.rol, u.estado
  FROM public.usuarios u
  WHERE lower(btrim(u.email)) = lower(btrim(p_email))
    AND u.password_hash = p_password_hash
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.login_usuario(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon, authenticated;

-- PASO 3 — Asignar contraseña temporal (SHA-256 de "12345678")
UPDATE public.usuarios
SET password_hash = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f'
WHERE lower(btrim(email)) = 'c.rojas@eca.or.cr';

-- PASO 4 — Verificación
SELECT id, email, nombre, rol, estado,
       (password_hash = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f') AS hash_ok
FROM public.usuarios
WHERE lower(btrim(email)) = 'c.rojas@eca.or.cr';

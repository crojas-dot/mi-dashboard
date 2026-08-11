-- Admin: admin@eca-qms.com / 123456
-- El hash SHA-256 se genera automáticamente desde el login page
-- Este SQL solo inserta el registro si no existe

INSERT INTO public.usuarios (id, nombre, email, rol, estado, created_at)
SELECT
  gen_random_uuid(),
  'Administrador',
  'admin@eca-qms.com',
  'admin',
  'activo',
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'admin@eca-qms.com');

-- El password se configura desde el login con "Crear cuenta administrador inicial"

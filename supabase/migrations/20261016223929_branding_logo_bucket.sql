-- Bucket de la marca institucional (logo del shell).
-- Es público a propósito: el logo se muestra a todo usuario autenticado y no es
-- información sensible. Solo se publica lectura; no se crean policies de
-- INSERT/UPDATE/DELETE para anon/authenticated, así que un usuario no puede
-- escribir en el bucket aunque conozca la ruta. La subida ocurre únicamente en
-- /api/configuracion/logo con service role, tras validar sesión y rol admin.
-- Los límites del bucket refuerzan la validación del endpoint.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

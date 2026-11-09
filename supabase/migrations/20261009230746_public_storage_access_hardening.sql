-- Evidencias Storage legacy: lectura ligada al expediente; subidas actuales usan Drive.
-- La tabla storage.objects conserva DML grants administrados por Supabase; RLS decide filas.
DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'quejas-adjuntos' AND public = false) THEN
    RAISE EXCEPTION 'Expected private evidence bucket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Storage RLS must remain enabled';
  END IF;
END;
$preflight$;

DROP POLICY "Staff puede subir archivos" ON storage.objects;
DROP POLICY "Staff puede leer archivos" ON storage.objects;

-- EXISTS mantiene las policies de Quejas/Adjuntos, además de exigir identidad activa.
CREATE POLICY quejas_adjuntos_legacy_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quejas-adjuntos'
  AND EXISTS (
    SELECT 1
    FROM public.queja_adjuntos a
    JOIN public.quejas q ON q.id = a.queja_id
    WHERE a.storage_path = storage.objects.name
      AND (
        (SELECT public.app_es_staff())
        OR (
          (SELECT public.app_es_colaborador())
          AND (SELECT public.app_tiene_permiso('mis_quejas', false))
          AND q.responsable_id = (SELECT public.app_usuario_actual_id())
        )
      )
  )
);

-- RLS no restringe TRUNCATE; estos privilegios no pertenecen a un cliente de archivos.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE storage.objects
FROM PUBLIC, anon, authenticated;

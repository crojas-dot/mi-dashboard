-- Envía el borrador versionado a Revisión GC. El destino del workflow usa el código
-- de catálogo vigente ('quality_review' para 'Pendiente de Revisión GC'); el valor
-- legible no es un código aceptado por el catálogo de estados.
create or replace function public.qms_submit_resolution_draft(
  p_id uuid, p_expected bigint, p_version bigint, p_content text, p_format text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(btrim(p_content), '') is null then
    raise exception 'Escribí la resolución antes de enviarla.' using errcode = '22023';
  end if;
  perform qms_private.save_resolution_draft(p_id,p_expected,p_version,p_content,p_format);
  return public.qms_transition_complaint(p_id,p_expected,'quality_review',
    p_resolution => p_content, p_resolution_format => p_format);
end $$;
revoke all on function public.qms_submit_resolution_draft(uuid,bigint,bigint,text,text) from public, anon, authenticated, service_role;
grant execute on function public.qms_submit_resolution_draft(uuid,bigint,bigint,text,text) to authenticated;

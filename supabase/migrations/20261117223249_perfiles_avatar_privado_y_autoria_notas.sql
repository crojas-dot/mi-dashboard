begin;
set local lock_timeout = '5s';

-- El archivo personal se lee y escribe a través de la API autenticada. No se
-- amplían las policies de storage.objects ni se emiten enlaces públicos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qms-avatars', 'qms-avatars', false, 524288, array['image/webp']);

-- La columna anterior se conserva. Solo la API puede publicar una ruta nueva.
revoke update (avatar_url) on public.usuarios from anon, authenticated;

create function qms_private.set_queja_note_author() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Las transiciones registran su propio actor y tipo en SQL privilegiado.
  -- La escritura directa del cliente se limita a una nota con autor real.
  if current_user = 'authenticated' then
    new.usuario_id := public.app_usuario_actual_id();
    new.created_at := statement_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function qms_private.set_queja_note_author() from public, anon, authenticated;

create trigger qms_set_note_author before insert on public.quejas_actividad
for each row execute function qms_private.set_queja_note_author();

create policy qms_direct_activity_is_own_note on public.quejas_actividad
as restrictive for insert to authenticated with check (
  tipo = 'nota' and usuario_id = (select public.app_usuario_actual_id())
);

-- Coinciden con la búsqueda de Drive y el orden del menú de avisos.
create index if not exists idx_queja_adjuntos_storage_path on public.queja_adjuntos(storage_path);
create index if not exists idx_notificaciones_visibles_fecha
on public.notificaciones(usuario_id, fecha desc, id desc) where archivada = false;

commit;

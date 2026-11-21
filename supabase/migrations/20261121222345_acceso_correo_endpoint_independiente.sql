-- Correo de acceso: permitir una implementación Apps Script distinta de Quejas.
-- En ausencia de access_endpoint se conserva exactamente el transporte anterior.
-- No rotar secretos, alterar el outbox ni modificar endpoint de Quejas.
begin;

alter table qms_private.mail_wake_settings
  add column if not exists access_endpoint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'qms_private.mail_wake_settings'::regclass
      and conname = 'mail_wake_settings_access_endpoint_check'
  ) then
    alter table qms_private.mail_wake_settings
      add constraint mail_wake_settings_access_endpoint_check
      check (
        access_endpoint is null or
        access_endpoint ~ '^https://script[.]google[.]com/macros/s/[A-Za-z0-9_-]{20,200}/exec$'
      );
  end if;
end
$$;

create or replace function public.qms_access_mail_transport()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'endpoint', coalesce(access_endpoint, endpoint),
    'enabled', enabled
  )
  from qms_private.mail_wake_settings
  where singleton;
$$;

revoke all on function public.qms_access_mail_transport() from public, anon, authenticated;
grant execute on function public.qms_access_mail_transport() to service_role;

commit;

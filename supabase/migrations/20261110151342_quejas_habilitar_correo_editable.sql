-- Aplicar solo después de verificar que la Edge consume qms_mail_claim_batch_v4.
begin;
create or replace function qms_private.email_delivery_ready() returns boolean
language sql stable security invoker set search_path='' as $$select true$$;
revoke all on function qms_private.email_delivery_ready() from public,anon,authenticated,service_role;
commit;

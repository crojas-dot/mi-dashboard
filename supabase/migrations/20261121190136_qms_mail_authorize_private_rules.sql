begin;

-- El emisor ya tiene EXECUTE en esta función de máquina, pero service_role no
-- tiene USAGE de qms_private. PostgreSQL resuelve esa referencia incluso al
-- validar un envío final. Conservar el cuerpo instalado y el alcance del lease.
alter function public.qms_mail_authorize_v2(uuid, uuid) security definer;
alter function public.qms_mail_authorize_v2(uuid, uuid) set search_path = '';
revoke all on function public.qms_mail_authorize_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.qms_mail_authorize_v2(uuid, uuid) to service_role;

commit;

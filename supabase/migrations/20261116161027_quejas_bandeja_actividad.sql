-- Función de presentación pura respecto del expediente; hoy es civil de CR.
-- El calendario se lee como invoker, usando la versión capturada en su evaluación.
create function qms_private.complaint_activity_context(
  ingreso timestamptz, ultima timestamptz, gestionada boolean, estado text,
  calendario bigint, hoy date default (now() at time zone 'America/Costa_Rica')::date
) returns text language plpgsql stable security invoker set search_path='' as $$
declare inicio date := (ingreso at time zone 'America/Costa_Rica')::date;
  dia date := (coalesce(ultima,ingreso) at time zone 'America/Costa_Rica')::date;
  tercero date; dias integer;
begin
  if estado in ('Resuelto','Finalizado','No Procede','Cerrado','Cerrada') or ingreso is null then return null; end if;
  if not coalesce(gestionada,false) then
    if estado <> 'Recibido' or calendario is null or inicio > hoy then return null; end if;
    select inicio+n into tercero from generate_series(0,370) n
      where public.qms_business_day(inicio+n,calendario) order by n offset 2 limit 1;
    return case when hoy < tercero then 'Nuevo' end;
  end if;
  dias := hoy-dia;
  return case when dias=0 then 'Actualización: hoy'
    when dias=1 then 'Actualización: ayer'
    when dias between 2 and 30 then 'Actualización: hace '||dias||' días'
    else 'Actualización: '||to_char(dia,'DD/MM/YYYY') end;
end $$;
revoke all on function qms_private.complaint_activity_context(timestamptz,timestamptz,boolean,text,bigint,date) from public, anon, authenticated, service_role;
grant execute on function qms_private.complaint_activity_context(timestamptz,timestamptz,boolean,text,bigint,date) to authenticated,service_role;

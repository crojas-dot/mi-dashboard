-- Ejecutar tras el corte, solo metadata y llamadas anon/auth negadas antes de efectos.
begin read only;
do $audit$
declare v_signature text; v_role text;
begin
  foreach v_signature in array array[
    'public.crear_queja_publica(text,text,text,text,text,text)',
    'public.crear_queja_publica_con_atributos(text,text,text,text,text,text)',
    'public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text)',
    'public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text)',
    'public.notificar_queja_publica(text)'] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role,v_signature,'EXECUTE') then
        raise exception 'Public mutation bypass remains: % / %',v_role,v_signature;
      end if;
    end loop;
    if not has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception 'Service legacy dependency unavailable: %',v_signature;
    end if;
  end loop;
  if has_table_privilege('anon','public.formularios_publicos','SELECT')
    or exists(select 1 from pg_policies where schemaname='public' and tablename='formularios_publicos' and policyname='formularios_publicos_active_select') then
    raise exception 'Public form enumeration remains';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='formularios_publicos' and policyname='formularios_publicos_admin_write') then
    raise exception 'Admin form policy missing';
  end if;
end;
$audit$;
set local role anon;
do $audit$
begin
  begin perform public.crear_queja_publica(null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Anon create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.crear_queja_publica_con_atributos(null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Anon alternate create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.crear_queja_publica_con_atributos(null::text,null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Anon alternate area create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.registrar_adjunto_queja_publica(null::uuid,null::text,null::text,null::bigint,null::text); raise exception 'Anon attachment not denied'; exception when insufficient_privilege then null; end;
  begin perform public.notificar_queja_publica(null::text); raise exception 'Anon notify not denied'; exception when insufficient_privilege then null; end;
end;
$audit$;
reset role;
set local role authenticated;
do $audit$
begin
  begin perform public.crear_queja_publica(null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Authenticated create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.crear_queja_publica_con_atributos(null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Authenticated alternate create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.crear_queja_publica_con_atributos(null::text,null::text,null::text,null::text,null::text,null::text,null::text); raise exception 'Authenticated alternate area create not denied'; exception when insufficient_privilege then null; end;
  begin perform public.registrar_adjunto_queja_publica(null::uuid,null::text,null::text,null::bigint,null::text); raise exception 'Authenticated attachment not denied'; exception when insufficient_privilege then null; end;
  begin perform public.notificar_queja_publica(null::text); raise exception 'Authenticated notify not denied'; exception when insufficient_privilege then null; end;
end;
$audit$;
reset role;
select 'public_forms_cutover_verified' as result;
rollback;
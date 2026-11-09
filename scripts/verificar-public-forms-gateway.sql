-- Solo metadata efectiva: sin filas ciudadanas y sin efectos de negocio.
begin read only;
do $audit$
declare v_function record; v_table text; v_role text; v_count integer := 0;
begin
  for v_function in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname like 'public_form_%'
  loop
    v_count := v_count + 1;
    if v_function.prosecdef or not ('search_path=""'=any(v_function.proconfig)) then
      raise exception 'Gateway RPC configuration invalid: %',v_function.proname;
    end if;
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role,v_function.oid,'EXECUTE') then
        raise exception 'Client can execute gateway RPC: % / %',v_role,v_function.proname;
      end if;
    end loop;
    if not has_function_privilege('service_role',v_function.oid,'EXECUTE') then
      raise exception 'Service cannot execute gateway RPC: %',v_function.proname;
    end if;
  end loop;
  if v_count<>6 then raise exception 'Expected six gateway RPCs, observed %',v_count; end if;
  foreach v_table in array array['public_form_submissions','public_form_uploads','public_form_rate_limits'] loop
    if not exists(select 1 from pg_class where oid=('public.'||v_table)::regclass and relrowsecurity) then
      raise exception 'Gateway table lacks RLS: %',v_table;
    end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_table) then
      raise exception 'Unexpected gateway client policy: %',v_table;
    end if;
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,'public.'||v_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Client has gateway table grant: % / %',v_role,v_table;
      end if;
    end loop;
    if not has_table_privilege('service_role','public.'||v_table,'SELECT')
      or not has_table_privilege('service_role','public.'||v_table,'INSERT')
      or not has_table_privilege('service_role','public.'||v_table,'UPDATE') then
      raise exception 'Service gateway table grants missing: %',v_table;
    end if;
  end loop;
end;
$audit$;
select 'gateway_metadata_verified' as result;
rollback;
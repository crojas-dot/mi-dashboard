-- Auditoría READ ONLY: proyecto fykhrrpeoehwqznccmfp. Sin filas privadas en salida.
-- No es una migración; cualquier error aborta y debe terminar en ROLLBACK.
begin read only;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
do $$
declare has_rows boolean; table_name text;
begin
  foreach table_name in array array['quejas','queja_adjuntos'] loop
    begin
      execute format('select exists (select 1 from public.%I limit 1)', table_name) into has_rows;
      if has_rows then raise exception 'Anonymous read returned private rows in %', table_name; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;
rollback;

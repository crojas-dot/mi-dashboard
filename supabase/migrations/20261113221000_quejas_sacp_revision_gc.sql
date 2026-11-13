begin;

-- Conserva los guards y la idempotencia del RPC SECURITY DEFINER existente.
-- En revisión GC el responsable ya envió su propuesta; la SACP es paralela.
do $permitir_revision_gc$
declare
  f oid := to_regprocedure('public.derivar_queja_a_sacp(uuid)');
  cuerpo text;
  definicion text;
  nuevo text;
begin
  if f is null then
    raise exception 'No existe la derivación SACP vigente';
  end if;
  select p.prosrc, pg_get_functiondef(p.oid) into cuerpo, definicion
  from pg_proc p where p.oid = f;
  if position('qms_audit_sacp_permissions_v1' in cuerpo) = 0 then
    raise exception 'No se encontró la validación de permisos de SACP';
  end if;
  if position('v_queja.estado NOT IN (''En Investigación'', ''Pendiente de Revisión GC'', ''Resuelto'')' in cuerpo) > 0 then
    return;
  end if;
  if position('v_queja.estado NOT IN (''En Investigación'', ''Resuelto'')' in cuerpo) = 0 then
    raise exception 'El contrato de derivación cambió; revisar antes de migrar';
  end if;
  nuevo := replace(cuerpo,
    'v_queja.estado NOT IN (''En Investigación'', ''Resuelto'')',
    'v_queja.estado NOT IN (''En Investigación'', ''Pendiente de Revisión GC'', ''Resuelto'')');
  nuevo := replace(nuevo,
    'Sólo se puede derivar una queja en investigación o resuelta',
    'La derivación requiere una queja en investigación, revisión GC o resuelta');
  -- No permitir crear una acción durante Revisión GC sin propuesta del responsable.
  if position('IF v_queja.derivado_sacp_id IS NOT NULL THEN' in nuevo) = 0 then
    raise exception 'No se encontró el punto de idempotencia del RPC';
  end if;
  nuevo := replace(nuevo, 'IF v_queja.derivado_sacp_id IS NOT NULL THEN',
    'IF v_queja.estado = ''Pendiente de Revisión GC'' AND nullif(btrim(coalesce(v_queja.resolucion, '''')), '''') IS NULL THEN' ||
    chr(10) || '    RAISE EXCEPTION ''La propuesta debe estar enviada antes de derivar a SACP'' USING ERRCODE = ''22023'';' ||
    chr(10) || '  END IF;' || chr(10) || '  IF v_queja.derivado_sacp_id IS NOT NULL THEN');
  execute replace(definicion, cuerpo, nuevo);
end;
$permitir_revision_gc$;

commit;

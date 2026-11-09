-- Ejecutar SOLO después de publicar/verificar el cliente con qms_transition_complaint.
-- El motor sigue invocado por el wrapper SECURITY DEFINER; no reabrir RPC históricos.
BEGIN;
REVOKE ALL ON FUNCTION public.qms_transition(uuid,bigint,text,text,text,uuid,text),
  public.crear_queja_interna_con_atributos(text,text,text,text,text,text,text,date,text,text)
  FROM PUBLIC,anon,authenticated;
COMMIT;

-- Rollback de ACL/metadata al snapshot 8-oct-2026. No elimina datos.
-- Usar solo si también se restaura el cliente/API ciudadano anterior.
GRANT EXECUTE ON FUNCTION public.crear_queja_publica(text,text,text,text,text,text),
  public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text),
  public.notificar_queja_publica(text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_queja_publica(text,text,text,text,text,text),public.notificar_queja_publica(text) TO PUBLIC;
GRANT SELECT ON public.formularios_publicos TO anon;
CREATE POLICY formularios_publicos_active_select ON public.formularios_publicos FOR SELECT TO anon,authenticated USING (activo = true);

-- Corte coordinado tras verificar el gateway y promover el despliegue nuevo.
-- Un único bloque conserva la atomicidad incluso fuera de un runner de migraciones.
DO $cutover$
BEGIN
REVOKE ALL ON FUNCTION public.crear_queja_publica(text,text,text,text,text,text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text),
  public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text),
  public.notificar_queja_publica(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_queja_publica(text,text,text,text,text,text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text),
  public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text),
  public.registrar_adjunto_queja_publica(uuid,text,text,bigint,text),
  public.notificar_queja_publica(text) TO service_role;

DROP POLICY formularios_publicos_active_select ON public.formularios_publicos;
REVOKE SELECT ON public.formularios_publicos FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.registrar_adjunto_queja(uuid,text,text,bigint,text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.queja_adjuntos FROM PUBLIC, anon, authenticated;
DROP POLICY "Staff puede subir adjuntos" ON public.queja_adjuntos;

GRANT SELECT ON TABLE public.queja_adjuntos TO authenticated;
END;
$cutover$;

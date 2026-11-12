-- Corte solicitado por el propietario: solo nuevas altas; no renumerar ni borrar.
-- El contador heredó 2000 de la secuencia de pruebas anterior a la serie anual.
LOCK TABLE public.quejas IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE v_anterior integer;
BEGIN
  SELECT ultimo INTO STRICT v_anterior FROM public.folios_quejas_anuales WHERE anio=2026 FOR UPDATE;
  IF v_anterior NOT BETWEEN 2000 AND 2999 THEN
    RAISE EXCEPTION 'El contador cambió; revisar el corte antes de aplicarlo.';
  END IF;
  UPDATE public.folios_quejas_anuales SET ultimo=v_anterior-2000 WHERE anio=2026;
END $$;

-- Los históricos siguen ocupando sus números. Al alcanzar uno de ellos, saltarlo
-- bajo el mismo lock transaccional, sin truncar ni reutilizar un folio existente.
CREATE OR REPLACE FUNCTION public.generar_folio_queja()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_folio text;
BEGIN
  LOOP
    v_folio := qms_private.next_annual_folio('quejas', transaction_timestamp());
    IF NOT EXISTS (SELECT 1 FROM public.quejas WHERE folio=v_folio) THEN
      RETURN v_folio;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.generar_folio_queja() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generar_folio_queja() TO service_role;

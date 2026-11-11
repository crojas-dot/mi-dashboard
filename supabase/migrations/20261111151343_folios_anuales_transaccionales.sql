-- Una serie por módulo y año de recepción en Costa Rica. No renumera históricos
-- ni reinicia las secuencias anteriores: sus reservas se conservan como piso.
CREATE TABLE qms_private.folios_anuales (
  modulo text NOT NULL CHECK (modulo IN ('sacp', 'auditorias', 'riesgos', 'documentos')),
  anio integer NOT NULL CHECK (anio BETWEEN 1 AND 9999),
  ultimo bigint NOT NULL CHECK (ultimo >= 0),
  PRIMARY KEY (modulo, anio)
);
ALTER TABLE qms_private.folios_anuales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE qms_private.folios_anuales FROM PUBLIC, anon, authenticated, service_role;

-- Bloquea altas mientras se captura el máximo histórico; los wrappers RPC se
-- conservan para el cliente publicado que todavía reserva antes del INSERT.
LOCK TABLE public.acciones, public.auditorias, public.riesgos IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO qms_private.folios_anuales (modulo, anio, ultimo)
SELECT modulo, partes[1]::integer, max(partes[2]::bigint)
FROM (
  SELECT 'sacp' AS modulo, regexp_match(folio, '^SACP-([0-9]{4})-([0-9]{1,18})$') AS partes FROM public.acciones
  UNION ALL
  SELECT 'auditorias', regexp_match(folio, '^AUD-([0-9]{4})-([0-9]{1,18})$') FROM public.auditorias
  UNION ALL
  SELECT 'riesgos', regexp_match(folio, '^RIESGO-([0-9]{4})-([0-9]{1,18})$') FROM public.riesgos
) historicos
WHERE partes IS NOT NULL AND partes[1]::integer > 0
GROUP BY modulo, partes[1]::integer;

INSERT INTO qms_private.folios_anuales (modulo, anio, ultimo)
SELECT CASE sequencename
    WHEN 'seq_folio_sacp' THEN 'sacp'
    WHEN 'seq_folio_auditorias' THEN 'auditorias'
    WHEN 'seq_folio_riesgos' THEN 'riesgos'
    WHEN 'seq_folio_documentos' THEN 'documentos'
  END,
  extract(year FROM timezone('America/Costa_Rica', transaction_timestamp()))::integer,
  last_value
FROM pg_catalog.pg_sequences
WHERE schemaname = 'public'
  AND sequencename IN ('seq_folio_sacp', 'seq_folio_auditorias', 'seq_folio_riesgos', 'seq_folio_documentos')
  AND last_value IS NOT NULL
ON CONFLICT (modulo, anio) DO UPDATE
SET ultimo = greatest(qms_private.folios_anuales.ultimo, EXCLUDED.ultimo);

CREATE FUNCTION qms_private.next_annual_folio(p_modulo text, p_instante timestamptz)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_anio integer := extract(year FROM timezone('America/Costa_Rica', p_instante))::integer;
  v_numero bigint;
  v_prefijo text;
BEGIN
  IF v_anio IS NULL OR v_anio NOT BETWEEN 1 AND 9999 THEN
    RAISE EXCEPTION 'Fecha de registro inválida.' USING ERRCODE = '22023';
  END IF;
  CASE p_modulo
    WHEN 'quejas' THEN v_prefijo := '';
    WHEN 'sacp' THEN v_prefijo := 'SACP-';
    WHEN 'auditorias' THEN v_prefijo := 'AUD-';
    WHEN 'riesgos' THEN v_prefijo := 'RIESGO-';
    WHEN 'documentos' THEN v_prefijo := 'DOC-';
    ELSE RAISE EXCEPTION 'Serie no válida.' USING ERRCODE = '22023';
  END CASE;

  -- El UPSERT serializa solo la fila del módulo/año, incluido el primer alta.
  -- La tabla de Quejas sigue siendo su única fuente; no se copia su contador.
  IF p_modulo = 'quejas' THEN
    INSERT INTO public.folios_quejas_anuales (anio, ultimo) VALUES (v_anio, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo = public.folios_quejas_anuales.ultimo + 1
    RETURNING ultimo INTO v_numero;
  ELSE
    INSERT INTO qms_private.folios_anuales (modulo, anio, ultimo) VALUES (p_modulo, v_anio, 1)
    ON CONFLICT (modulo, anio) DO UPDATE SET ultimo = qms_private.folios_anuales.ultimo + 1
    RETURNING ultimo INTO v_numero;
  END IF;

  -- LPAD(text, 3) recorta 1000 a 100: el ancho debe crecer con el número.
  RETURN v_prefijo || v_anio::text || '-' || lpad(v_numero::text, greatest(3, length(v_numero::text)), '0');
END;
$$;
REVOKE ALL ON FUNCTION qms_private.next_annual_folio(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generar_folio_queja()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT qms_private.next_annual_folio('quejas', transaction_timestamp()) $$;
CREATE OR REPLACE FUNCTION public.generar_folio_sacp()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT qms_private.next_annual_folio('sacp', transaction_timestamp()) $$;
CREATE OR REPLACE FUNCTION public.generar_folio_auditoria()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT qms_private.next_annual_folio('auditorias', transaction_timestamp()) $$;
CREATE OR REPLACE FUNCTION public.generar_folio_riesgo()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT qms_private.next_annual_folio('riesgos', transaction_timestamp()) $$;
CREATE OR REPLACE FUNCTION public.generar_folio_documento()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT qms_private.next_annual_folio('documentos', transaction_timestamp()) $$;

-- Mantener ACL de wrappers existentes: aún los consume el cliente publicado.
-- Quejas solo se asigna dentro de sus altas protegidas, como antes.
REVOKE ALL ON FUNCTION public.generar_folio_queja() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generar_folio_queja() TO service_role;

CREATE FUNCTION qms_private.assign_annual_folio()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_prefijo text;
  v_partes text[];
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR NOT (
    (TG_TABLE_NAME = 'acciones' AND TG_ARGV[0] = 'sacp') OR
    (TG_TABLE_NAME = 'auditorias' AND TG_ARGV[0] = 'auditorias') OR
    (TG_TABLE_NAME = 'riesgos' AND TG_ARGV[0] = 'riesgos')
  ) THEN
    RAISE EXCEPTION 'Serie no válida.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'INSERT' AND nullif(btrim(NEW.folio), '') IS NULL THEN
    NEW.folio := qms_private.next_annual_folio(TG_ARGV[0], transaction_timestamp());
  ELSE
    -- Un folio manual de la misma serie no puede dejar el contador por debajo.
    -- No se reescribe el texto de folios históricos ni códigos manuales.
    v_prefijo := CASE TG_ARGV[0] WHEN 'sacp' THEN 'SACP' WHEN 'auditorias' THEN 'AUD' WHEN 'riesgos' THEN 'RIESGO' END;
    v_partes := regexp_match(NEW.folio, '^' || v_prefijo || '-([0-9]{4})-([0-9]{1,18})$');
    IF v_partes IS NOT NULL AND v_partes[1]::integer > 0 THEN
      INSERT INTO qms_private.folios_anuales (modulo, anio, ultimo)
      VALUES (TG_ARGV[0], v_partes[1]::integer, v_partes[2]::bigint)
      ON CONFLICT (modulo, anio) DO UPDATE
      SET ultimo = greatest(qms_private.folios_anuales.ultimo, EXCLUDED.ultimo);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION qms_private.assign_annual_folio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER a_qms_annual_folio BEFORE INSERT OR UPDATE OF folio ON public.acciones
FOR EACH ROW EXECUTE FUNCTION qms_private.assign_annual_folio('sacp');
CREATE TRIGGER a_qms_annual_folio BEFORE INSERT OR UPDATE OF folio ON public.auditorias
FOR EACH ROW EXECUTE FUNCTION qms_private.assign_annual_folio('auditorias');
CREATE TRIGGER a_qms_annual_folio BEFORE INSERT OR UPDATE OF folio ON public.riesgos
FOR EACH ROW EXECUTE FUNCTION qms_private.assign_annual_folio('riesgos');

-- Sin consumidores vigentes: este alias utilizaba otra secuencia y año UTC.
-- No redirigirlo al generador: permitiría consumir folios sin registrar quejas.
CREATE OR REPLACE FUNCTION public.siguiente_folio_queja()
RETURNS text LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN
  RAISE EXCEPTION 'El folio se asigna al registrar la queja.' USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION public.siguiente_folio_queja() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.quejas_folio_seq, public.seq_folio_quejas,
  public.seq_folio_sacp, public.seq_folio_auditorias, public.seq_folio_riesgos,
  public.seq_folio_documentos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE qms_private.folios_anuales IS 'Contadores anuales transaccionales por módulo; año de registro en America/Costa_Rica. Quejas conserva folios_quejas_anuales.';
COMMENT ON FUNCTION qms_private.next_annual_folio(text, timestamptz) IS 'Solo uso interno; nunca exponer fecha/serie ni reservar desde UI. No reiniciar ni renumerar históricos.';

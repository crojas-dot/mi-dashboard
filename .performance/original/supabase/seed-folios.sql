-- ============================================================
-- Atomic Folio Generation (concurrency-safe, no app-level locks)
-- ============================================================
-- Each sequence resets yearly (e.g. QUEJA-2026-0001)
-- The RPC functions below are SAFE for concurrent calls
-- because sequences in PostgreSQL guarantee atomic increment.

-- Drop existing sequences to recreate
DROP SEQUENCE IF EXISTS seq_folio_quejas;
DROP SEQUENCE IF EXISTS seq_folio_sacp;
DROP SEQUENCE IF EXISTS seq_folio_auditorias;
DROP SEQUENCE IF EXISTS seq_folio_riesgos;
DROP SEQUENCE IF EXISTS seq_folio_documentos;

-- Create sequences (start at 1, cache 20 for performance)
CREATE SEQUENCE seq_folio_quejas      START 1 CACHE 20;
CREATE SEQUENCE seq_folio_sacp        START 1 CACHE 20;
CREATE SEQUENCE seq_folio_auditorias  START 1 CACHE 20;
CREATE SEQUENCE seq_folio_riesgos      START 1 CACHE 20;
CREATE SEQUENCE seq_folio_documentos   START 1 CACHE 20;

-- Reset sequences yearly (call from a cron job on Jan 1)
-- ALTER SEQUENCE seq_folio_quejas RESTART WITH 1;

-- ============================================================
-- RPC: generar_folio_queja()
-- Returns: TEXT like 'QUEJA-2026-0001'
-- Usage: SELECT generar_folio_queja();
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio_queja()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
  folio  TEXT;
BEGIN
  seq_val := nextval('seq_folio_quejas');
  folio := 'QUEJA-' || year || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ============================================================
-- RPC: generar_folio_sacp()
-- Returns: TEXT like 'SACP-2026-0001'
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio_sacp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
  folio  TEXT;
BEGIN
  seq_val := nextval('seq_folio_sacp');
  folio := 'SACP-' || year || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ============================================================
-- RPC: generar_folio_auditoria()
-- Returns: TEXT like 'AUD-2026-0001'
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio_auditoria()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
  folio  TEXT;
BEGIN
  seq_val := nextval('seq_folio_auditorias');
  folio := 'AUD-' || year || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ============================================================
-- RPC: generar_folio_riesgo()
-- Returns: TEXT like 'RIESGO-2026-0001'
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio_riesgo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
  folio  TEXT;
BEGIN
  seq_val := nextval('seq_folio_riesgos');
  folio := 'RIESGO-' || year || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ============================================================
-- RPC: generar_folio_documento()
-- Returns: TEXT like 'DOC-2026-0001'
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio_documento()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
  folio  TEXT;
BEGIN
  seq_val := nextval('seq_folio_documentos');
  folio := 'DOC-' || year || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN folio;
END;
$$;

-- ============================================================
-- Optional: Auto-assign folio via trigger on INSERT
-- Uncomment for the tables you want auto-folio assignment
-- ============================================================
-- CREATE OR REPLACE FUNCTION trg_auto_folio_queja()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   IF NEW.folio IS NULL OR NEW.folio = '' THEN
--     NEW.folio := generar_folio_queja();
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
-- CREATE TRIGGER trg_queja_auto_folio BEFORE INSERT ON quejas
--   FOR EACH ROW EXECUTE FUNCTION trg_auto_folio_queja();

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION generar_folio_queja()      TO authenticated;
GRANT EXECUTE ON FUNCTION generar_folio_sacp()        TO authenticated;
GRANT EXECUTE ON FUNCTION generar_folio_auditoria()   TO authenticated;
GRANT EXECUTE ON FUNCTION generar_folio_riesgo()      TO authenticated;
GRANT EXECUTE ON FUNCTION generar_folio_documento()   TO authenticated;

-- Usage from client:
--   const { data } = await supabase.rpc('generar_folio_queja')
--   // data => "QUEJA-2026-0042"

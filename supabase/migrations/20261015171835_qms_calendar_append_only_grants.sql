-- El calendario y las reglas se publican mediante RPC con revisión y auditoría.
-- RLS no protege TRUNCATE: el cliente solo necesita los SELECT ya concedidos.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.qms_calendars, public.qms_stage_versions, public.qms_config_audit
  FROM anon, authenticated;

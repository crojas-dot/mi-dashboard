-- =============================================================================
-- Migración 014: RPC atómico para incrementar tokens de proveedores IA
-- Reemplaza el patrón read-modify-write que causaba race conditions
-- =============================================================================

CREATE OR REPLACE FUNCTION incrementar_tokens_proveedor(
  p_provider_id text,
  p_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_providers jsonb;
  v_actualizado jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  -- Leer el array actual
  SELECT valor INTO v_providers
  FROM configuraciones_sistema
  WHERE clave = 'ai_providers';

  IF v_providers IS NULL OR NOT jsonb_typeof(v_providers, 'array') THEN
    RETURN;
  END IF;

  -- Recorrer y actualizar el provider matching
  FOR v_item IN SELECT jsonb_array_elements(v_providers)
  LOOP
    IF v_item->>'id' = p_provider_id THEN
      v_actualizado := v_actualizado || jsonb_build_array(
        jsonb_set(
          jsonb_set(v_item, '{tokens_usados}', to_jsonb(
            COALESCE((v_item->>'tokens_usados')::integer, 0) + p_tokens
          )),
          '{tokens_updated_at}', to_jsonb(now()::text)
        )
      );
    ELSE
      v_actualizado := v_actualizado || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  -- Actualizar el array completo
  UPDATE configuraciones_sistema
  SET valor = v_actualizado
  WHERE clave = 'ai_providers';
END;
$$;

REVOKE ALL ON FUNCTION incrementar_tokens_proveedor(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION incrementar_tokens_proveedor(text, integer) TO authenticated;

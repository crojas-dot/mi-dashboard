-- =============================================================================
-- Migración 013: RPC para estadísticas de quejas (server-side)
-- Reemplaza el cálculo O(N) en el cliente que trae todas las filas
-- =============================================================================

CREATE OR REPLACE FUNCTION obtener_estadisticas_quejas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado JSON;
  v_total BIGINT;
  v_mes_actual BIGINT;
  v_resueltas_a_tiempo BIGINT;
  v_resueltas_total BIGINT;
  v_procedentes BIGINT;
  v_total_con_decision BIGINT;
BEGIN
  -- Total de quejas
  SELECT COUNT(*) INTO v_total FROM quejas;

  -- Quejas del mes actual
  SELECT COUNT(*) INTO v_mes_actual
  FROM quejas
  WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE);

  -- Resueltas a tiempo (fecha_cierre <= fecha_sla)
  SELECT
    COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL AND fecha_sla IS NOT NULL AND fecha_cierre <= fecha_sla),
    COUNT(*) FILTER (WHERE fecha_cierre IS NOT NULL)
  INTO v_resueltas_a_tiempo, v_resueltas_total
  FROM quejas
  WHERE estado IN ('Resuelto', 'Finalizado');

  -- Tasa de procedencia
  SELECT
    COUNT(*) FILTER (WHERE estado NOT IN ('No Procede', 'Recibido')),
    COUNT(*) FILTER (WHERE estado != 'Recibido')
  INTO v_procedentes, v_total_con_decision
  FROM quejas;

  resultado := json_build_object(
    'total', v_total,
    'mes_actual', v_mes_actual,
    'resueltas_a_tiempo', v_resueltas_a_tiempo,
    'resueltas_total', v_resueltas_total,
    'pct_a_tiempo', CASE WHEN v_resueltas_total > 0 THEN ROUND((v_resueltas_a_tiempo::NUMERIC / v_resueltas_total) * 100, 1) ELSE 0 END,
    'procedentes', v_procedentes,
    'total_con_decision', v_total_con_decision,
    'pct_procedencia', CASE WHEN v_total_con_decision > 0 THEN ROUND((v_procedentes::NUMERIC / v_total_con_decision) * 100, 1) ELSE 0 END
  );

  RETURN resultado;
END;
$$;

-- Permitir ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION obtener_estadisticas_quejas() TO authenticated;

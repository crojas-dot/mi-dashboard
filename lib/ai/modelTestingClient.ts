import type { SupabaseClient } from '@supabase/supabase-js'
import type { TestResultado } from './types'

// Utilidades client-safe para leer/limpiar los resultados de test de modelos.
// NO importan el SDK de IA, por lo que pueden usarse desde componentes cliente.

const CLAVE_TEST_PREFIX = 'ai_test_resultado_'

export async function obtenerResultadoTest(
  client: SupabaseClient,
  providerId: string,
): Promise<TestResultado | null> {
  const { data } = await client
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `${CLAVE_TEST_PREFIX}${providerId}`)
    .maybeSingle()
  return (data?.valor as TestResultado) ?? null
}

export async function limpiarResultadoTest(
  client: SupabaseClient,
  providerId: string,
  modelosActuales: string[],
): Promise<void> {
  const resultado = await obtenerResultadoTest(client, providerId)
  if (!resultado?.resultados) return
  const conjunto = new Set(modelosActuales)
  const filtrados = resultado.resultados.filter((r) => conjunto.has(r.modelo))
  if (filtrados.length !== resultado.resultados.length) {
    await client.from('configuraciones_sistema').upsert(
      {
        clave: `${CLAVE_TEST_PREFIX}${providerId}`,
        valor: { ...resultado, resultados: filtrados },
        descripcion: `Resultado de test de modelos para ${providerId}`,
        categoria: 'ia',
      },
      { onConflict: 'clave' },
    )
  }
}

export async function guardarResultadoTest(
  client: SupabaseClient,
  providerId: string,
  resultado: TestResultado,
  nombreProveedor: string,
): Promise<void> {
  await client.from('configuraciones_sistema').upsert(
    {
      clave: `${CLAVE_TEST_PREFIX}${providerId}`,
      valor: resultado,
      descripcion: `Resultado de test de modelos para ${nombreProveedor}`,
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )
}

export async function modelosExcluidosPorTest(
  client: SupabaseClient,
  providerId: string,
  modelosDisponibles: string[],
): Promise<string[]> {
  const resultado = await obtenerResultadoTest(client, providerId)
  if (!resultado?.resultados) return modelosDisponibles
  const fallidos = new Set(
    resultado.resultados.filter((r) => !r.ok).map((r) => r.modelo),
  )
  if (fallidos.size === 0) return modelosDisponibles
  return modelosDisponibles.filter((m) => !fallidos.has(m))
}

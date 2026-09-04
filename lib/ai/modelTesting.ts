import type { AIProvider } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearClienteIA } from './aiFactory'
import { obtenerModelosNoPenalizados } from './modelMemory'

const CLAVE_TEST_PREFIX = 'ai_test_resultado_'
const MAX_MODELOS_TEST = 20

const PROMPT_CORTO = 'Resuma en una sola frase: "El cambio climático está alterando los ecosistemas marinos a nivel global, provocando la migración de especies y la acidificación progresiva de los océanos."'

const PROMPT_LARGO = `Analice el siguiente texto y proporcione un resumen de 3 puntos clave:

El sistema de gestión de calidad (SGC) es un marco estructurado que permite a las organizaciones establecer, implementar, mantener y mejorar continuamente la eficacia de sus procesos. En el contexto del Ente Costarricense de Acreditación (ECA), el SGC cumple un rol fundamental en la estandarización de procedimientos, la trazabilidad documental y la auditoría interna. Un componente esencial del SGC es el manejo de no conformidades, que incluye la identificación, clasificación, seguimiento y resolución de desviaciones respecto a los estándares establecidos. Estas no conformidades pueden surgir de auditorías internas, quejas de clientes, hallazgos de procesos o evaluaciones de desempeño. La gestión efectiva requiere la asignación de responsables, el establecimiento de plazos de corrección, la implementación de acciones correctivas y preventivas, y la verificación de la eficacia de las acciones tomadas. Además, el ciclo PHVA (Planear-Hacer-Verificar-Actuar) proporciona la metodología para la mejora continua, asegurando que cada hallazgo se traduzca en una oportunidad de mejora verificable y sostenible. Los indicadores clave de desempeño (KPIs) permiten medir la efectividad del sistema, mientras que la capacitación continua del personal garantiza la sostenibilidad de las mejoras implementadas.`

export interface ModeloTestResultado {
  modelo: string
  ok: boolean
  latenciaMs: number | null
  error: string | null
}

export interface TestResultado {
  timestamp: number
  resultados: ModeloTestResultado[]
}

export async function testearModelo(
  provider: AIProvider,
  modelo: string,
  promptPrueba: string,
): Promise<ModeloTestResultado> {
  const inicio = Date.now()
  try {
    const cliente = crearClienteIA(provider, modelo)
    const resultado = await cliente.analizar({
      prompt: promptPrueba,
      maxTokens: 1024,
      temperature: 0.3,
    })
    const latenciaMs = Date.now() - inicio
    const texto = resultado.texto?.trim()
    if (!texto || texto.length < 5) {
      return { modelo, ok: false, latenciaMs, error: 'Respuesta vacía o muy corta' }
    }
    return { modelo, ok: true, latenciaMs, error: null }
  } catch (err) {
    const latenciaMs = Date.now() - inicio
    const msg = err instanceof Error ? err.message : String(err)
    return { modelo, ok: false, latenciaMs, error: msg.slice(0, 200) }
  }
}

export async function testearProveedor(
  admin: SupabaseClient,
  provider: AIProvider,
  opciones?: {
    promptsPrueba?: string[]
    maxModelos?: number
    onProgress?: (modelo: string, resultado: ModeloTestResultado) => void
    signal?: AbortSignal
  },
): Promise<TestResultado> {
  const prompts = opciones?.promptsPrueba ?? [PROMPT_CORTO, PROMPT_LARGO]
  const maxModelos = opciones?.maxModelos ?? MAX_MODELOS_TEST

  const modelosFiltrados = await obtenerModelosNoPenalizados(admin, provider.id, provider.modelos)
  const modelosAProbar = modelosFiltrados.slice(0, maxModelos)

  console.log(`[modelTesting] Testeando ${provider.nombre}: ${modelosAProbar.length} modelos`)

  const resultados: ModeloTestResultado[] = []

  for (const modelo of modelosAProbar) {
    if (opciones?.signal?.aborted) {
      console.log(`[modelTesting] Test cancelado para ${provider.nombre}`)
      break
    }

    let mejorResultado: ModeloTestResultado | null = null
    for (const prompt of prompts) {
      if (opciones?.signal?.aborted) break
      const r = await testearModelo(provider, modelo, prompt)
      if (r.ok) {
        mejorResultado = r
        break
      }
      if (!mejorResultado || (mejorResultado && !mejorResultado.ok)) {
        mejorResultado = r
      }
    }
    if (mejorResultado) {
      resultados.push(mejorResultado)
      opciones?.onProgress?.(modelo, mejorResultado)
      console.log(
        `[modelTesting] ${provider.nombre}/${modelo}: ${mejorResultado.ok ? 'OK' : 'FALLO'} (${mejorResultado.latenciaMs}ms)${mejorResultado.error ? ' - ' + mejorResultado.error.slice(0, 80) : ''}`,
      )
    }
  }

  const testResult: TestResultado = { timestamp: Date.now(), resultados }
  await admin.from('configuraciones_sistema').upsert(
    {
      clave: `${CLAVE_TEST_PREFIX}${provider.id}`,
      valor: testResult,
      descripcion: `Resultado de test de modelos para ${provider.nombre}`,
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )

  const buenos = resultados.filter(r => r.ok).length
  const malos = resultados.filter(r => !r.ok).length
  console.log(`[modelTesting] Test completado para ${provider.nombre}: ${buenos} buenos, ${malos} malos de ${resultados.length} probados`)

  return testResult
}

export async function obtenerResultadoTest(
  admin: SupabaseClient,
  providerId: string,
): Promise<TestResultado | null> {
  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `${CLAVE_TEST_PREFIX}${providerId}`)
    .maybeSingle()
  return (data?.valor as TestResultado) ?? null
}

export async function limpiarResultadoTest(
  admin: SupabaseClient,
  providerId: string,
  modelosActuales: string[],
): Promise<void> {
  const resultado = await obtenerResultadoTest(admin, providerId)
  if (!resultado?.resultados) return
  const conjunto = new Set(modelosActuales)
  const filtrados = resultado.resultados.filter(r => conjunto.has(r.modelo))
  if (filtrados.length !== resultado.resultados.length) {
    await admin.from('configuraciones_sistema').upsert(
      {
        clave: `${CLAVE_TEST_PREFIX}${providerId}`,
        valor: { ...resultado, resultados: filtrados },
        descripcion: `Resultado de test de modelos para ${providerId}`,
        categoria: 'ia',
      },
      { onConflict: 'clave' },
    )
    console.log(`[modelTesting] Test limpiado: ${resultado.resultados.length - filtrados.length} modelos eliminados`)
  }
}

export async function modelosExcluidosPorTest(
  admin: SupabaseClient,
  providerId: string,
  modelosDisponibles: string[],
): Promise<string[]> {
  const resultado = await obtenerResultadoTest(admin, providerId)
  if (!resultado?.resultados) return modelosDisponibles
  const fallidos = new Set(
    resultado.resultados.filter(r => !r.ok).map(r => r.modelo),
  )
  if (fallidos.size === 0) return modelosDisponibles
  const ok = modelosDisponibles.filter(m => !fallidos.has(m))
  console.log(`[modelTesting] ${fallidos.size} modelos excluidos por test previo de ${providerId}`)
  return ok
}

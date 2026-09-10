import type { AIProvider, ModeloTestResultado } from './types'
import { crearClienteIA } from './aiFactory'

// NOTA: este módulo importa el SDK de IA (via aiFactory), por lo que SOLO debe
// importarse en el servidor. Para las utilidades client-safe (leer/limpiar
// resultados de test), ver modelTestingClient.ts.

export const PROMPT_CORTO = 'Resuma en una sola frase: "El cambio climático está alterando los ecosistemas marinos a nivel global, provocando la migración de especies y la acidificación progresiva de los océanos."'

export const PROMPT_LARGO = `Analice el siguiente texto y proporcione un resumen de 3 puntos clave:

El sistema de gestión de calidad (SGC) es un marco estructurado que permite a las organizaciones establecer, implementar, mantener y mejorar continuamente la eficacia de sus procesos. En el contexto del Ente Costarricense de Acreditación (ECA), el SGC cumple un rol fundamental en la estandarización de procedimientos, la trazabilidad documental y la auditoría interna. Un componente esencial del SGC es el manejo de no conformidades, que incluye la identificación, clasificación, seguimiento y resolución de desviaciones respecto a los estándares establecidos. Estas no conformidades pueden surgir de auditorías internas, quejas de clientes, hallazgos de procesos o evaluaciones de desempeño. La gestión efectiva requiere la asignación de responsables, el establecimiento de plazos de corrección, la implementación de acciones correctivas y preventivas, y la verificación de la eficacia de las acciones tomadas. Además, el ciclo PHVA (Planear-Hacer-Verificar-Actuar) proporciona la metodología para la mejora continua, asegurando que cada hallazgo se traduzca en una oportunidad de mejora verificable y sostenible. Los indicadores clave de desempeño (KPIs) permiten medir la efectividad del sistema, mientras que la capacitación continua del personal garantiza la sostenibilidad de las mejoras implementadas.`

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

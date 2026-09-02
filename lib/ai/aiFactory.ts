import { GoogleGenerativeAI, type Part, type GenerateContentResult } from '@google/generative-ai'
import type { AIProvider, ArchivoIA } from './types'

export const IA_SYSTEM_PROMPT =
  'Sos un asistente experto en Gestión de Calidad (norma ISO 9001 / acreditación, Ente Costarricense de Acreditación). ' +
  'Respondé en español, con tono profesional, claro y estructurado. Usá viñetas cuando sea útil.'

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AnalizarResult {
  texto: string
  uso?: TokenUsage
}

export interface AnalizarArgs {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
  archivos?: ArchivoIA[]
}

export interface AIClient {
  analizar(args: AnalizarArgs): Promise<AnalizarResult>
}

const TIMEOUT_MS = 120_000

function quitarSlashFinal(url: string): string {
  return url.replace(/\/+$/, '')
}

function aBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

function notaArchivoNoVisual(nombre: string, mime: string): string {
  return `[Adjunto ${nombre} (${mime}) no procesable como imagen por este modelo; se envió solo el texto de la queja.]`
}

async function extraerError(res: Response, nombre: string): Promise<never> {
  let msg = `HTTP ${res.status}`
  try {
    const json = await res.json()
    const detalle = json?.error?.message || json?.error?.toString() || json?.message
    if (detalle) msg = detalle
  } catch {
    /* ignore */
  }
  throw new Error(`[${nombre}] ${msg}`)
}

function normalizarUso(u: TokenUsage | undefined): TokenUsage | undefined {
  if (!u) return undefined
  return {
    prompt_tokens: Number(u.prompt_tokens) || 0,
    completion_tokens: Number(u.completion_tokens) || 0,
    total_tokens: Number(u.total_tokens) || 0,
  }
}

function crearOpenAICompatible(provider: AIProvider, modelo: string): AIClient {
  const base = quitarSlashFinal(provider.base_url?.trim() || 'https://api.openai.com/v1')
  return {
    async analizar({ prompt, system = IA_SYSTEM_PROMPT, maxTokens = 2000, temperature = 0.3, archivos = [] }) {
      const content: unknown[] = [{ type: 'text', text: prompt }]
      for (const a of archivos) {
        if (a.mime.startsWith('image/')) {
          content.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${aBase64(a.buffer)}` } })
        } else {
          content.push({ type: 'text', text: notaArchivoNoVisual(a.nombre, a.mime) })
        }
      }
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
        body: JSON.stringify({
          model: modelo,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return extraerError(res, provider.nombre)
      const json = await res.json()
      const text = json?.choices?.[0]?.message?.content
      if (!text) throw new Error(`[${provider.nombre}] respuesta vacía del proveedor`)
      const uso = normalizarUso(
        json?.usage
          ? {
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
              total_tokens: json.usage.total_tokens,
            }
          : undefined,
      )
      return { texto: String(text).trim(), uso }
    },
  }
}

function crearAnthropic(provider: AIProvider, modelo: string): AIClient {
  return {
    async analizar({ prompt, system = IA_SYSTEM_PROMPT, maxTokens = 2000, temperature = 0.3, archivos = [] }) {
      const blocks: unknown[] = [{ type: 'text', text: prompt }]
      for (const a of archivos) {
        if (a.mime.startsWith('image/')) {
          blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime, data: aBase64(a.buffer) } })
        } else {
          blocks.push({ type: 'text', text: notaArchivoNoVisual(a.nombre, a.mime) })
        }
      }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: 'user', content: blocks }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return extraerError(res, provider.nombre)
      const json = await res.json()
      const text = json?.content?.[0]?.text
      if (!text) throw new Error(`[${provider.nombre}] respuesta vacía del proveedor`)
      const uso = normalizarUso(
        json?.usage
          ? {
              prompt_tokens: json.usage.input_tokens,
              completion_tokens: json.usage.output_tokens,
              total_tokens: (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0),
            }
          : undefined,
      )
      return { texto: String(text).trim(), uso }
    },
  }
}

interface ModeloGeminiLista {
  name?: string
  supportedGenerationMethods?: string[]
}
interface RespuestaListaModelos {
  models?: ModeloGeminiLista[]
}

async function listarModelosGemini(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error(`[Gemini] No se pudo listar modelos (HTTP ${res.status}).`)
      return []
    }
    const json = (await res.json()) as RespuestaListaModelos
    return (json.models ?? [])
      .map((m) => String(m?.name ?? '').replace(/^models\//, ''))
      .filter(Boolean)
  } catch (e) {
    console.error('[Gemini] No se pudo listar modelos para diagnóstico:', (e as Error).message)
    return []
  }
}

function procesarResultadoGemini(result: GenerateContentResult, nombreProveedor: string): { texto: string; uso?: TokenUsage } {
  let text: string
  try {
    text = result.response.text()
  } catch {
    throw new Error(`[${nombreProveedor}] respuesta vacía del proveedor`)
  }
  if (!text) throw new Error(`[${nombreProveedor}] respuesta vacía del proveedor`)
  const um = result.response.usageMetadata
  const uso = normalizarUso(
    um
      ? {
          prompt_tokens: um.promptTokenCount ?? 0,
          completion_tokens: um.candidatesTokenCount ?? 0,
          total_tokens: um.totalTokenCount ?? 0,
        }
      : undefined,
  )
  return { texto: text.trim(), uso }
}

function crearGemini(provider: AIProvider, modeloOriginal: string): AIClient {
  return {
    async analizar({ prompt, system = IA_SYSTEM_PROMPT, maxTokens = 2000, temperature = 0.3, archivos = [] }) {
      const genAI = new GoogleGenerativeAI(provider.api_key)
      let cleanModel = (modeloOriginal || '')
        .trim()
        .toLowerCase()
        .replace(/[\r\n]/g, '')
        .replace(/^models\//, '')
      if (!cleanModel) cleanModel = 'gemini-2.5-flash'
      const parts: Part[] = [{ text: prompt }]
      for (const a of archivos) {
        parts.push({ inlineData: { data: aBase64(a.buffer), mimeType: a.mime } })
      }
      const generar = async (modelName: string) =>
        genAI.getGenerativeModel({ model: modelName, systemInstruction: system }).generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        })
      try {
        const result = await generar(cleanModel)
        return procesarResultadoGemini(result, provider.nombre)
      } catch (err) {
        const e = err as { status?: number; response?: { status?: number } }
        const status = e?.status ?? e?.response?.status
        const es404 = status === 404 || /404|not found|is not found/i.test(String((err as Error).message))
        if (es404) {
          console.error(`[Gemini] El modelo "${cleanModel}" no está disponible (status ${status ?? 'desconocido'}).`)
          const lista = await listarModelosGemini(provider.api_key)
          console.error('[Gemini] Modelos habilitados para esta API Key:', lista)
          const fallback = 'gemini-2.5-flash'
          if (cleanModel !== fallback && lista.includes(fallback)) {
            console.error(`[Gemini] Reintentando con modelo por defecto "${fallback}".`)
            const result2 = await generar(fallback)
            return procesarResultadoGemini(result2, provider.nombre)
          }
        }
        throw err
      }
    },
  }
}

export function crearClienteIA(provider: AIProvider, modelo: string): AIClient {
  switch (provider.tipo) {
    case 'openai':
      return crearOpenAICompatible(provider, modelo)
    case 'anthropic':
      return crearAnthropic(provider, modelo)
    case 'gemini':
      return crearGemini(provider, modelo)
    default:
      throw new Error(`Tipo de proveedor IA no soportado: ${(provider as AIProvider).tipo}`)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { crearClienteIA, IA_SYSTEM_PROMPT } from '@/lib/ai/aiFactory'
import { getDriveClient, buscarOCrearSubcarpeta } from '@/lib/server/drive'
import type { AIProvider, AIRouting } from '@/lib/ai/types'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { type Part } from '@google/generative-ai'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODULOS_VALIDOS = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision', 'general']

const TABLA_POR_MODULO: Record<string, string> = {
  quejas: 'quejas',
  sacp: 'acciones',
  documentos: 'documentos',
  auditorias: 'auditorias',
  riesgos: 'riesgos',
  revision: 'reuniones',
  general: 'configuraciones_sistema',
}

const INSTRUCCIONES_AUTO =
  'Analizá esta entidad del sistema de gestión de calidad. Identificá: ' +
  '(1) Categorización y tipo, (2) Riesgos de calidad asociados, ' +
  '(3) Posibles causas raíz, (4) Recomendaciones, (5) Próximos pasos sugeridos. ' +
  'Si hay archivos adjuntos, tenlos en cuenta. Usá viñetas y lenguaje claro.'



// Exponential backoff retry helper
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: Error
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isRetryable = /429|503|rate.?limit|quota|exhausted|overloaded/i.test(lastError.message)
      if (!isRetryable || attempt === maxRetries) throw lastError
      const delay = baseDelayMs * Math.pow(2, attempt)
      console.warn(`[api/ai/analizar] Intento ${attempt + 1} falló, reintentando en ${delay}ms:`, lastError.message)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError!
}

async function resolverEntidad(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  modulo: string,
  entidadId: string,
): Promise<Record<string, unknown> | null> {
  if (modulo === 'quejas') {
    const { data: porId } = await admin.from('quejas').select('*').eq('id', entidadId).maybeSingle()
    if (porId) return porId as Record<string, unknown>
    const { data: porFolio } = await admin.from('quejas').select('*').eq('folio', entidadId).maybeSingle()
    return (porFolio as Record<string, unknown>) ?? null
  }
  const tabla = TABLA_POR_MODULO[modulo]
  if (!tabla) return null
  const { data } = await admin.from(tabla).select('*').eq('id', entidadId).maybeSingle()
  return (data as Record<string, unknown>) ?? null
}

function construirTextoQueja(q: Record<string, unknown>): string {
  const campo = (k: string) => (q[k] != null && q[k] !== '' ? String(q[k]) : '—')
  return [
    `Folio: ${campo('folio')}`,
    `Cliente: ${campo('cliente_nombre')}`,
    `Categoría: ${campo('categoria')}`,
    `Prioridad: ${campo('prioridad')}`,
    `Estado: ${campo('estado')}`,
    `Fecha: ${campo('fecha')}`,
    `SLA: ${campo('fecha_sla')}`,
    `Límite de investigación: ${campo('fecha_limite_investigacion')}`,
    `Descripción:\n${campo('descripcion')}`,
    `Justificación / Notas de Gestión de Calidad:\n${campo('notas')}`,
    `Resolución:\n${campo('resolucion')}`,
  ].join('\n')
}

function construirTextoGenerico(modulo: string, entidad: Record<string, unknown>): string {
  let json = ''
  try {
    json = JSON.stringify(entidad, null, 2)
  } catch {
    json = String(entidad)
  }
  return `Módulo: ${modulo}\nID: ${entidad.id ?? '—'}\nDatos:\n${json}`
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { modulo, entidad_id, tipo_consulta, prompt_usuario } = body as {
    modulo?: string
    entidad_id?: string
    tipo_consulta?: string
    prompt_usuario?: string
  }

  if (!modulo || !MODULOS_VALIDOS.includes(modulo)) {
    return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })
  }
  if (!entidad_id) {
    return NextResponse.json({ error: 'Se requiere entidad_id' }, { status: 400 })
  }
  if (tipo_consulta !== 'auto' && tipo_consulta !== 'custom') {
    return NextResponse.json({ error: 'tipo_consulta debe ser "auto" o "custom"' }, { status: 400 })
  }
  if (tipo_consulta === 'custom' && !prompt_usuario?.trim()) {
    return NextResponse.json({ error: 'prompt_usuario es requerido para consulta custom' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const esStaff = ['admin', 'calidad'].includes(current.rol)

  const entidad = await resolverEntidad(admin, modulo, entidad_id)
  if (!entidad) {
    return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
  }

  if (!esStaff) {
    if (modulo === 'quejas') {
      const { data: perfil } = await admin
        .from('usuarios')
        .select('id')
        .eq('auth_id', current.auth_id)
        .maybeSingle()
      const responsableId = entidad.responsable_id
      if (!perfil || !responsableId || responsableId !== perfil.id) {
        return NextResponse.json({ error: 'Sin permisos para analizar esta entidad' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Sin permisos para usar IA en este módulo' }, { status: 403 })
    }
  }

  const { data: provData } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', 'ai_providers')
    .maybeSingle()
  const { data: routData } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', 'ai_routing')
    .maybeSingle()

  const providers: AIProvider[] = Array.isArray(provData?.valor) ? (provData!.valor as AIProvider[]) : []
  const routing: AIRouting =
    routData?.valor && typeof routData.valor === 'object' ? (routData.valor as AIRouting) : {}

  const ruta = routing[modulo]
  if (!ruta) {
    return NextResponse.json(
      { error: `No hay proveedor IA configurado para el módulo "${modulo}"` },
      { status: 400 },
    )
  }

  const provider = providers.find((p) => p.id === ruta.proveedor_id)
  if (!provider || !provider.api_key) {
    return NextResponse.json({ error: 'Proveedor IA no encontrado o sin API key configurada' }, { status: 400 })
  }

  const system = ruta.system_prompt?.trim() || IA_SYSTEM_PROMPT

  const textoEntidad =
    modulo === 'quejas' ? construirTextoQueja(entidad) : construirTextoGenerico(modulo, entidad)

  const userPrompt =
    tipo_consulta === 'auto'
      ? `${textoEntidad}\n\n${INSTRUCCIONES_AUTO}`
      : `${textoEntidad}\n\nConsulta del usuario:\n${prompt_usuario!.trim()}`

  // Zero-Disk: buscar y leer .contexto_qms.txt en la subcarpeta de Drive de la queja
  let contextoAdicional = ''
  if (modulo === 'quejas') {
    const folio = String(entidad.folio ?? '')
    if (folio) {
      const { data: config } = await admin
        .from('configuraciones_sistema')
        .select('valor')
        .eq('clave', 'drive_folder_id_quejas')
        .maybeSingle()
      const rootFolderId = typeof config?.valor === 'string' ? config.valor.trim() : ''
      if (rootFolderId) {
        const drive = getDriveClient()
        if (drive) {
          try {
            const subcarpetaId = await buscarOCrearSubcarpeta(drive, rootFolderId, folio)
            const listRes = await drive.files.list({
              q: `'${subcarpetaId}' in parents and name = '.contexto_qms.txt' and trashed = false`,
              fields: 'files(id, name)',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            })
            const contextoFile = listRes.data.files?.[0]
            if (contextoFile?.id) {
              const downloadRes = await drive.files.get(
                { fileId: contextoFile.id, alt: 'media' },
                { responseType: 'text' },
              )
              contextoAdicional = String(downloadRes.data ?? '').trim()
            }
          } catch (e) {
            console.warn('[api/ai/analizar] No se pudo leer .contexto_qms.txt:', (e as Error).message)
          }
        }
      }
    }
  }

  const promptFinal = contextoAdicional
    ? `${userPrompt}\n\n--- Contexto pre-generado (.contexto_qms.txt) ---\n${contextoAdicional}`
    : userPrompt

  const isGemini = provider.tipo === 'gemini'
  let analisis = ''
  let totalTokens = 0

  try {
    if (isGemini) {
      // RUTA VIP PARA GEMINI: Usar Files API
      analisis = await withRetry(async () => {
        const fileManager = new GoogleAIFileManager(provider.api_key)

        // Descargar .contexto_qms.txt
        let contextoContent = ''
        if (contextoAdicional) {
          contextoContent = contextoAdicional
        } else if (modulo === 'quejas') {
          const folio = String(entidad.folio ?? '')
          if (folio) {
            const { data: config } = await admin
              .from('configuraciones_sistema')
              .select('valor')
              .eq('clave', 'drive_folder_id_quejas')
              .maybeSingle()
            const rootFolderId = typeof config?.valor === 'string' ? config.valor.trim() : ''
            if (rootFolderId) {
              const drive = getDriveClient()
              if (drive) {
                try {
                  const subcarpetaId = await buscarOCrearSubcarpeta(drive, rootFolderId, folio)
                  const listRes = await drive.files.list({
                    q: `'${subcarpetaId}' in parents and name = '.contexto_qms.txt' and trashed = false`,
                    fields: 'files(id, name)',
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true,
                  })
                  const contextoFile = listRes.data.files?.[0]
                  if (contextoFile?.id) {
                    const downloadRes = await drive.files.get(
                      { fileId: contextoFile.id, alt: 'media' },
                      { responseType: 'text' },
                    )
                    contextoContent = String(downloadRes.data ?? '').trim()
                  }
                } catch (e) {
                  console.warn('[api/ai/analizar] No se pudo leer .contexto_qms.txt:', (e as Error).message)
                }
              }
            }
          }
        }

        let tempFilePath = ''
        if (contextoContent) {
          const fileName = `contexto_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`
          tempFilePath = path.join(os.tmpdir(), fileName)
          fs.writeFileSync(tempFilePath, contextoContent, 'utf-8')
        }

        // Subir archivo a Gemini Files API si existe contexto
        let fileUri = ''
        try {
          if (tempFilePath) {
            const uploadResult = await fileManager.uploadFile(tempFilePath, {
              mimeType: 'text/plain',
              displayName: 'contexto_qms.txt',
            })
            fileUri = uploadResult.file.uri
            console.log('[api/ai/analizar] Archivo subido a Gemini Files API:', fileUri)
          }
        } finally {
          // Limpiar archivo temporal
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
              fs.unlinkSync(tempFilePath)
              console.log('[api/ai/analizar] Archivo temporal limpiado:', tempFilePath)
            } catch (cleanupError) {
              console.warn('[api/ai/analizar] No se pudo limpiar archivo temporal:', cleanupError)
            }
          }
        }

        // Preparar partes del contenido
        const parts: Part[] = [{ text: promptFinal }]
        if (fileUri) {
          parts.push({ fileData: { mimeType: 'text/plain', fileUri } })
        }

        // Llamar a Gemini con maxOutputTokens: 8192
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(provider.api_key)
        const model = genAI.getGenerativeModel({
          model: ruta.modelo_nombre,
          systemInstruction: system,
          generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
        })

        const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
        const text = result.response.text()
        if (!text) throw new Error('Respuesta vacía de Gemini')
        
        // Extraer tokens si están disponibles
        const usage = result.response.usageMetadata
        if (usage) {
          totalTokens = usage.totalTokenCount ?? 0
        }
        
        return text.trim()
      })
    } else {
      // RUTA UNIVERSAL PARA OTROS PROVEEDORES (Groq, OpenAI, Anthropic, etc.)
      analisis = await withRetry(async () => {
        const cliente = crearClienteIA(provider, ruta.modelo_nombre)
        const resultado = await cliente.analizar({
          system,
          prompt: promptFinal,
          archivos: [],
          maxTokens: 8192,
          temperature: 0.3,
        })
        if (resultado.uso?.total_tokens) {
          totalTokens = resultado.uso.total_tokens
        }
        return resultado.texto
      })
    }

    // Actualizar tokens usados
    if (totalTokens > 0) {
      const providersActualizados = providers.map((p) =>
        p.id === provider.id ? { ...p, tokens_usados: (p.tokens_usados ?? 0) + totalTokens } : p,
      )
      await admin
        .from('configuraciones_sistema')
        .update({ valor: providersActualizados })
        .eq('clave', 'ai_providers')
    }

    return NextResponse.json({
      analisis,
      tokens_consumidos: totalTokens,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al consultar el proveedor IA'
    console.error('[api/ai/analizar]', mensaje)
    // Detectar errores de proveedor saturado (503, 429, etc.)
    const esErrorProveedor = /503|429|saturado|rate.?limit|quota|exhausted|overloaded/i.test(mensaje)
    if (esErrorProveedor) {
      return NextResponse.json(
        { error: 'El proveedor de IA está saturado. Por favor, intente en un minuto.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: mensaje }, { status: 502 })
  } finally {
    // Limpieza de archivos temporales en /tmp
    // (Los archivos se limpian automáticamente por Vercel, pero por seguridad)
  }
}

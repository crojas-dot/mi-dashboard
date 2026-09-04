import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { IA_SYSTEM_PROMPT, resolverModeloAuto } from '@/lib/ai/aiFactory'
import { invalidarModelosCache, esModeloAuto, esOpenRouter } from '@/lib/ai/modelDiscovery'
import { guardarUltimoExito, obtenerUltimoExito, registrarFallo, obtenerModelosNoPenalizados } from '@/lib/ai/modelMemory'
import { getDriveClient, buscarOCrearSubcarpeta } from '@/lib/server/drive'
import type { AIProvider, AIRouting } from '@/lib/ai/types'
import type { SupabaseClient } from '@supabase/supabase-js'

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

const TIMEOUT_IA_MS = 15000
const MAX_SUBFALLBACK = 10

async function ejecutarProveedorIA(
  admin: SupabaseClient,
  provider: AIProvider,
  modelo: string,
  system: string,
  prompt: string,
): Promise<{ text: string; tokens: number }> {
  let tokens = 0

  if (esModeloAuto(modelo)) {
    const resolved = await resolverModeloAuto(admin, provider)
    if (!resolved) throw new Error(`No se pudo resolver "${modelo}" para ${provider.nombre} y no hay fallback disponible`)
    modelo = resolved
    console.log(`[api/ai] Modelo auto resuelto para ${provider.nombre}: ${modelo}`)
  }

  if (esOpenRouter(provider) && Array.isArray(provider.modelos) && provider.modelos.length > 0 && !provider.modelos.includes(modelo)) {
    console.warn(`[api/ai] Modelo "${modelo}" no está en la lista de gratuitos de OpenRouter, usando: ${provider.modelos[0]}`)
    modelo = provider.modelos[0]
  }

  if (provider.tipo === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(provider.api_key)
    const model = genAI.getGenerativeModel({
      model: modelo,
      systemInstruction: system,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    })
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      { signal: AbortSignal.timeout(TIMEOUT_IA_MS) },
    )
    const text = result.response.text()
    if (!text) throw new Error('Respuesta vacía de Gemini')
    const usage = result.response.usageMetadata
    if (usage) tokens = usage.totalTokenCount ?? 0
    return { text: text.trim(), tokens }
  }

  if (provider.tipo === 'openai') {
    const baseUrl = provider.base_url?.replace(/\/+$/, '') || 'https://api.openai.com/v1'
    const maxTokens = esOpenRouter(provider) ? 1024 : 8192
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_IA_MS),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`[${provider.nombre}] ${res.status}: ${err?.error?.message || res.statusText}`)
    }
    const json = await res.json()
    const text = json?.choices?.[0]?.message?.content
    if (!text) throw new Error('Respuesta vacía del proveedor OpenAI')
    if (json?.usage?.total_tokens) tokens = json.usage.total_tokens
    return { text: text.trim(), tokens }
  }

  if (provider.tipo === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 8192,
        temperature: 0.3,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_IA_MS),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`[${provider.nombre}] ${res.status}: ${err?.error?.message || res.statusText}`)
    }
    const json = await res.json()
    const text = json?.content?.[0]?.text
    if (!text) throw new Error('Respuesta vacía de Anthropic')
    if (json?.usage) {
      tokens = (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0)
    }
    return { text: text.trim(), tokens }
  }

  throw new Error(`Tipo de proveedor no soportado: ${provider.tipo}`)
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

  // Auto-reset mensual: verificar si hemos cruzado de mes y resetear tokens_usados
  const ahora = new Date()
  const mesActual = ahora.getFullYear() * 12 + ahora.getMonth()
  const providersConReset = providers.map((p) => {
    const ultimoReset = p.tokens_updated_at ? new Date(p.tokens_updated_at) : null
    const mesUltimoReset = ultimoReset ? ultimoReset.getFullYear() * 12 + ultimoReset.getMonth() : -1
    if (mesUltimoReset !== mesActual) {
      return { ...p, tokens_usados: 0, tokens_updated_at: new Date().toISOString() }
    }
    return p
  })
  
  // Si hubo resets, persistir inmediatamente
  if (providersConReset.some((p, i) => p.tokens_usados !== providers[i].tokens_usados)) {
    await admin
      .from('configuraciones_sistema')
      .update({ valor: providersConReset })
      .eq('clave', 'ai_providers')
    const { data: provData2 } = await admin
      .from('configuraciones_sistema')
      .select('valor')
      .eq('clave', 'ai_providers')
      .maybeSingle()
    providers.splice(0, providers.length, ...(Array.isArray(provData2?.valor) ? (provData2!.valor as AIProvider[]) : []))
  }
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

  const tieneFallback = !!ruta.fallback_provider_id

  let analisis = ''
  let totalTokens = 0

  const inicio = Date.now()
  let modeloUsado = ruta.modelo_nombre

  const ultimoExito = await obtenerUltimoExito(admin, provider.id)
  if (ultimoExito && ultimoExito !== ruta.modelo_nombre && Array.isArray(provider.modelos) && provider.modelos.includes(ultimoExito)) {
    console.log(`[api/ai] Usando último modelo exitoso: ${ultimoExito} (configurado: ${ruta.modelo_nombre})`)
    modeloUsado = ultimoExito
  }

  console.log(`[api/ai][diag] Iniciando análisis. Modelo: ${modeloUsado}`)

  try {
    const resultado = await ejecutarProveedorIA(admin, provider, modeloUsado, system, promptFinal)
    analisis = resultado.text
    totalTokens = resultado.tokens

    await guardarUltimoExito(admin, provider.id, modeloUsado)

    const duracion = Date.now() - inicio
    console.log(`[api/ai][diag] Análisis completado en ${duracion}ms. Modelo: ${modeloUsado}. Tokens: ${totalTokens}`)

    // Actualizar tokens usados (con auto-reset mensual ya aplicado arriba)
    if (totalTokens > 0) {
      const providersActualizados = providers.map((p) =>
        p.id === provider.id
          ? { ...p, tokens_usados: (p.tokens_usados ?? 0) + totalTokens, tokens_updated_at: new Date().toISOString() }
          : p,
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
    const duracion = Date.now() - inicio
    const mensaje = error instanceof Error ? error.message : 'Error al consultar el proveedor IA'
    console.error(`[api/ai][diag] Error tras ${duracion}ms: ${mensaje}`)

    await registrarFallo(admin, provider.id, modeloUsado)
    await invalidarModelosCache(admin, provider.id)
    console.warn(`[api/ai] Modelo ${modeloUsado} falló (${mensaje.split('\n')[0]}), invalidando caché de ${provider.nombre}`)

    const esErrorRecuperable =
      /\b(4\d{2}|5\d{2})\b/.test(mensaje) ||
      /rate.?limit|quota|exhausted|overloaded|saturad/i.test(mensaje) ||
      /timeout|abort/i.test(mensaje)

    // Sub-fallback intra-proveedor: probar otros modelos del mismo proveedor antes de saltar al respaldo externo
    if (esErrorRecuperable && Array.isArray(provider.modelos) && provider.modelos.length > 1) {
      const todosAlternativos = provider.modelos.filter((m) => m !== modeloUsado)
      const modelosAlternativos = (await obtenerModelosNoPenalizados(admin, provider.id, todosAlternativos)).slice(0, MAX_SUBFALLBACK)
      console.log(`[api/ai] Sub-fallback: probando ${modelosAlternativos.length} modelos no penalizados de ${provider.nombre}`)
      for (const modeloAlt of modelosAlternativos) {
        try {
          console.log(`[api/ai] Modelo ${modeloUsado} falló, intentando sub-modelo: ${modeloAlt}`)
          const sub = await ejecutarProveedorIA(admin, provider, modeloAlt, system, promptFinal)
          analisis = sub.text
          totalTokens = sub.tokens
          await guardarUltimoExito(admin, provider.id, modeloAlt)
          console.warn(`[api/ai] Sub-modelo ${modeloAlt} respondió OK`)

          if (totalTokens > 0) {
            const providersActualizados = providers.map((p) =>
              p.id === provider.id
                ? { ...p, tokens_usados: (p.tokens_usados ?? 0) + totalTokens, tokens_updated_at: new Date().toISOString() }
                : p,
            )
            await admin
              .from('configuraciones_sistema')
              .update({ valor: providersActualizados })
              .eq('clave', 'ai_providers')
          }

          return NextResponse.json({ analisis, tokens_consumidos: totalTokens })
        } catch (subErr) {
          const subMsg = subErr instanceof Error ? subErr.message : String(subErr)
          await registrarFallo(admin, provider.id, modeloAlt)
          console.warn(`[api/ai] Sub-modelo ${modeloAlt} falló: ${subMsg.split('\n')[0]}`)
        }
      }
    }

    if (esErrorRecuperable && tieneFallback && ruta.fallback_provider_id && ruta.fallback_modelo) {
      const fallbackProvider = providers.find((p) => p.id === ruta.fallback_provider_id)
      if (fallbackProvider?.api_key) {
        try {
          console.warn(
            `[api/ai] Modelo ${modeloUsado} falló con ${mensaje.split('\n')[0]}, intentando respaldo: ${fallbackProvider.nombre}/${ruta.fallback_modelo}`,
          )
          const fb = await ejecutarProveedorIA(admin, fallbackProvider, ruta.fallback_modelo, system, promptFinal)
          analisis = fb.text
          totalTokens = fb.tokens
          await guardarUltimoExito(admin, fallbackProvider.id, ruta.fallback_modelo)

          if (totalTokens > 0) {
            const providersActualizados = providers.map((p) =>
              p.id === fallbackProvider.id
                ? { ...p, tokens_usados: (p.tokens_usados ?? 0) + totalTokens, tokens_updated_at: new Date().toISOString() }
                : p,
            )
            await admin
              .from('configuraciones_sistema')
              .update({ valor: providersActualizados })
              .eq('clave', 'ai_providers')
          }

          return NextResponse.json({ analisis, tokens_consumidos: totalTokens })
        } catch (fbError) {
          const fbMsg = fbError instanceof Error ? fbError.message : String(fbError)
          await registrarFallo(admin, fallbackProvider.id, ruta.fallback_modelo)
          console.error(`[api/ai] Respaldo ${fallbackProvider.nombre}/${ruta.fallback_modelo} también falló: ${fbMsg.split('\n')[0]}`)
        }
      }
    }

    const esErrorProveedor = /503|429|saturado|rate.?limit|quota|exhausted|overloaded/i.test(mensaje)
    if (esErrorProveedor) {
      return NextResponse.json(
        { error: 'El proveedor de IA está saturado. Por favor, intente en un minuto.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_EXITO_TTL_MS = 24 * 60 * 60 * 1000
const MAX_FALLOS_REGISTROS = 50

const FALLOS_TTL: { fallos: number; ttlMs: number }[] = [
  { fallos: 1, ttlMs: 30 * 60 * 1000 },
  { fallos: 2, ttlMs: 60 * 60 * 1000 },
  { fallos: 3, ttlMs: 4 * 60 * 60 * 1000 },
]
const FALLOS_TTL_DEFAULT_MS = 4 * 60 * 60 * 1000

const PROMPT_GRANDE = 10_000

interface ExitoRecord {
  modelo: string
  timestamp: number
  latenciaMs: number | null
  tamanoPrompt: number | null
}

interface FalloRecord {
  modelo: string
  fallos: number
  ultimo_fallo: number
}

function obtenerTtlFallos(fallos: number): number {
  for (const regla of FALLOS_TTL) {
    if (fallos <= regla.fallos) return regla.ttlMs
  }
  return FALLOS_TTL_DEFAULT_MS
}

export async function guardarUltimoExito(
  admin: SupabaseClient,
  providerId: string,
  modelo: string,
  latenciaMs?: number,
  tamanoPrompt?: number,
): Promise<void> {
  await admin.from('configuraciones_sistema').upsert(
    {
      clave: `ai_ultimo_exito_${providerId}`,
      valor: { modelo, timestamp: Date.now(), latenciaMs: latenciaMs ?? null, tamanoPrompt: tamanoPrompt ?? null } satisfies ExitoRecord,
      descripcion: 'Último modelo exitoso por proveedor',
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )
  await limpiarFallo(admin, providerId, modelo)
  console.log(`[modelMemory] Último éxito guardado: ${providerId} → ${modelo}${latenciaMs ? ` (${latenciaMs}ms)` : ''}${tamanoPrompt ? ` [prompt: ${tamanoPrompt} chars]` : ''}`)
}

export async function obtenerUltimoExito(
  admin: SupabaseClient,
  providerId: string,
  tamanoPromptActual?: number,
): Promise<string | null> {
  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_ultimo_exito_${providerId}`)
    .maybeSingle()
  const record = data?.valor as ExitoRecord | null
  if (!record?.modelo || !record?.timestamp) return null
  if (Date.now() - record.timestamp >= MAX_EXITO_TTL_MS) return null

  const latencia = record.latenciaMs
  const tamanoGuardado = record.tamanoPrompt

  if (latencia == null) return record.modelo

  const eraPromptGrande = tamanoGuardado != null && tamanoGuardado >= PROMPT_GRANDE
  const promptActualGrande = tamanoPromptActual != null && tamanoPromptActual >= PROMPT_GRANDE

  if (eraPromptGrande) {
    if (promptActualGrande && latencia < 45_000) {
      return record.modelo
    }
    if (!promptActualGrande && latencia > 10_000) {
      console.log(`[modelMemory] Último éxito ${record.modelo} fue lento para prompt grande (${latencia}ms), descartando para prompt corto`)
      return null
    }
    return record.modelo
  }

  if (promptActualGrande) {
    console.log(`[modelMemory] Último éxito ${record.modelo} fue para prompt corto, permitiendo reintentar para prompt grande`)
    return record.modelo
  }

  if (latencia > 10_000) {
    console.log(`[modelMemory] Último éxito ${record.modelo} lento (${latencia}ms) para prompt corto, intentando alternativa`)
    return null
  }

  return record.modelo
}

export async function registrarFallo(
  admin: SupabaseClient,
  providerId: string,
  modelo: string,
  contexto?: { esTimeout?: boolean; tamanoPrompt?: number },
): Promise<void> {
  const esTimeoutGrande = contexto?.esTimeout === true && (contexto?.tamanoPrompt ?? 0) >= PROMPT_GRANDE

  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_fallos_${providerId}`)
    .maybeSingle()
  const lista = Array.isArray(data?.valor) ? (data!.valor as FalloRecord[]) : []
  const idx = lista.findIndex(f => f.modelo === modelo)

  if (esTimeoutGrande) {
    if (idx >= 0) {
      lista[idx] = { modelo, fallos: lista[idx].fallos, ultimo_fallo: Date.now() }
    } else {
      lista.push({ modelo, fallos: 0, ultimo_fallo: Date.now() })
    }
    console.log(`[modelMemory] Timeout en prompt grande: ${providerId}/${modelo} (sin penalizar, registro informativo)`)
  } else {
    if (idx >= 0) {
      lista[idx] = { modelo, fallos: lista[idx].fallos + 1, ultimo_fallo: Date.now() }
    } else {
      lista.push({ modelo, fallos: 1, ultimo_fallo: Date.now() })
    }
  }

  const ahora = Date.now()
  const limpios = lista
    .filter(f => {
      if (f.fallos === 0) return true
      const ttl = obtenerTtlFallos(f.fallos)
      return ahora - f.ultimo_fallo < ttl
    })
    .sort((a, b) => b.fallos - a.fallos)
    .slice(0, MAX_FALLOS_REGISTROS)
  await admin.from('configuraciones_sistema').upsert(
    {
      clave: `ai_fallos_${providerId}`,
      valor: limpios,
      descripcion: 'Contador de fallos por modelo y proveedor',
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )
  const record = limpios.find(f => f.modelo === modelo)
  if (!esTimeoutGrande) {
    const ttlMs = obtenerTtlFallos(record?.fallos ?? 1)
    console.log(`[modelMemory] Fallo registrado: ${providerId}/${modelo} (${record?.fallos ?? 1} consecutivos, excluido ${ttlMs / 60000}min)`)
  }
}

async function limpiarFallo(
  admin: SupabaseClient,
  providerId: string,
  modelo: string,
): Promise<void> {
  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_fallos_${providerId}`)
    .maybeSingle()
  const lista = Array.isArray(data?.valor) ? (data!.valor as FalloRecord[]) : []
  const filtrados = lista.filter(f => f.modelo !== modelo)
  if (filtrados.length !== lista.length) {
    await admin.from('configuraciones_sistema').upsert(
      {
        clave: `ai_fallos_${providerId}`,
        valor: filtrados,
        descripcion: 'Contador de fallos por modelo y proveedor',
        categoria: 'ia',
      },
      { onConflict: 'clave' },
    )
    console.log(`[modelMemory] Fallos reiniciados: ${providerId}/${modelo}`)
  }
}

export async function obtenerModelosNoPenalizados(
  admin: SupabaseClient,
  providerId: string,
  modelosDisponibles: string[],
): Promise<string[]> {
  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_fallos_${providerId}`)
    .maybeSingle()
  const lista = Array.isArray(data?.valor) ? (data!.valor as FalloRecord[]) : []
  const ahora = Date.now()
  const penalizados = new Set(
    lista
      .filter(f => {
        if (f.fallos === 0) return false
        const ttl = obtenerTtlFallos(f.fallos)
        return ahora - f.ultimo_fallo < ttl
      })
      .map(f => f.modelo),
  )
  if (penalizados.size === 0) return modelosDisponibles
  const ok = modelosDisponibles.filter(m => !penalizados.has(m))
  const penalizadosPresentes = modelosDisponibles.filter(m => penalizados.has(m))
  console.log(`[modelMemory] ${penalizadosPresentes.length} modelos penalizados excluidos de ${providerId}`)
  return [...ok, ...penalizadosPresentes]
}

export async function limpiarMemoriaModelos(
  admin: SupabaseClient,
  providerId: string,
  modelosActuales: string[],
): Promise<void> {
  const conjunto = new Set(modelosActuales)
  const { data: exitoData } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_ultimo_exito_${providerId}`)
    .maybeSingle()
  const exito = exitoData?.valor as ExitoRecord | null
  if (exito?.modelo && !conjunto.has(exito.modelo)) {
    await admin.from('configuraciones_sistema').delete().eq('clave', `ai_ultimo_exito_${providerId}`)
    console.log(`[modelMemory] Último éxito limpiado: ${exito.modelo} ya no existe`)
  }
  const { data: fallosData } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_fallos_${providerId}`)
    .maybeSingle()
  const fallos = Array.isArray(fallosData?.valor) ? (fallosData!.valor as FalloRecord[]) : []
  const fallosLimpios = fallos.filter(f => conjunto.has(f.modelo))
  if (fallosLimpios.length !== fallos.length) {
    await admin.from('configuraciones_sistema').upsert(
      {
        clave: `ai_fallos_${providerId}`,
        valor: fallosLimpios,
        descripcion: 'Contador de fallos por modelo y proveedor',
        categoria: 'ia',
      },
      { onConflict: 'clave' },
    )
    console.log(`[modelMemory] Fallos limpiados: ${fallos.length - fallosLimpios.length} modelos eliminados`)
  }
}

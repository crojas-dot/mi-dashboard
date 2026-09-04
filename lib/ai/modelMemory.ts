import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_EXITO_TTL_MS = 24 * 60 * 60 * 1000
const FALLOS_PENALIZACION = 2
const FALLOS_TTL_MS = 60 * 60 * 1000
const MAX_FALLOS_REGISTROS = 50

interface ExitoRecord {
  modelo: string
  timestamp: number
}

interface FalloRecord {
  modelo: string
  fallos: number
  ultimo_fallo: number
}

export async function guardarUltimoExito(
  admin: SupabaseClient,
  providerId: string,
  modelo: string,
): Promise<void> {
  await admin.from('configuraciones_sistema').upsert(
    {
      clave: `ai_ultimo_exito_${providerId}`,
      valor: { modelo, timestamp: Date.now() } satisfies ExitoRecord,
      descripcion: 'Último modelo exitoso por proveedor',
      categoria: 'ia',
    },
    { onConflict: 'clave' },
  )
  await limpiarFallo(admin, providerId, modelo)
  console.log(`[modelMemory] Último éxito guardado: ${providerId} → ${modelo}`)
}

export async function obtenerUltimoExito(
  admin: SupabaseClient,
  providerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', `ai_ultimo_exito_${providerId}`)
    .maybeSingle()
  const record = data?.valor as ExitoRecord | null
  if (record?.modelo && record?.timestamp && Date.now() - record.timestamp < MAX_EXITO_TTL_MS) {
    return record.modelo
  }
  return null
}

export async function registrarFallo(
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
  const idx = lista.findIndex(f => f.modelo === modelo)
  if (idx >= 0) {
    lista[idx] = { modelo, fallos: lista[idx].fallos + 1, ultimo_fallo: Date.now() }
  } else {
    lista.push({ modelo, fallos: 1, ultimo_fallo: Date.now() })
  }
  const ahora = Date.now()
  const limpios = lista
    .filter(f => ahora - f.ultimo_fallo < FALLOS_TTL_MS)
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
  console.log(`[modelMemory] Fallo registrado: ${providerId}/${modelo} (${record?.fallos ?? 1} consecutivos)`)
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
      .filter(f => f.fallos >= FALLOS_PENALIZACION && ahora - f.ultimo_fallo < FALLOS_TTL_MS)
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

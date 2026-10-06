import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { testearModelo, PROMPT_CORTO } from '@/lib/ai/modelTesting'
import type { AIProvider } from '@/lib/ai/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const CLAVE_PROVEEDORES = 'ai_providers'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 30, 60_000, 'ai-test')) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intente más tarde.' }, { status: 429 })
  }

  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden testear modelos' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { providerId?: string; modelo?: string } | null
  const providerId = body?.providerId
  const modelo = body?.modelo
  if (!providerId || !modelo) {
    return NextResponse.json({ error: 'providerId y modelo son requeridos' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }

  const { data } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', CLAVE_PROVEEDORES)
    .maybeSingle()

  const providers = Array.isArray(data?.valor) ? (data.valor as AIProvider[]) : []
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  const resultado = await testearModelo(provider, modelo, PROMPT_CORTO)

  return NextResponse.json(resultado)
}

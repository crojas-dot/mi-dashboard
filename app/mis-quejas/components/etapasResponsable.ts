import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

const ETAPAS = [
  { id: 'analisis', label: 'Análisis' },
  { id: 'resolucion', label: 'Resolución' },
  { id: 'revision', label: 'Revisión de Calidad' },
] as const

export type EtapaMisQuejas = typeof ETAPAS[number]['id']

export function cicloMisQuejas(estado: string, tieneDevolucion: boolean) {
  const aprobada = estado === 'Resuelto' || estado === 'Finalizado'
  const actual: EtapaMisQuejas = estado === 'Pendiente de Revisión GC' || aprobada ? 'revision'
    : estado === 'En Investigación' ? 'resolucion' : 'analisis'
  const indice = ETAPAS.findIndex(etapa => etapa.id === actual)
  return {
    actual,
    aprobada,
    etapas: ETAPAS.map((etapa, posicion) => ({
      ...etapa,
      disponible: posicion <= indice || etapa.id === 'revision' && actual === 'resolucion' && tieneDevolucion,
      completa: posicion < indice || aprobada || etapa.id === 'analisis' && estado === 'No Procede',
      actual: posicion === indice,
    })),
  }
}

export function adjuntosMisQuejas(
  adjuntos: readonly QuejaAdjunto[],
  responsableId: string | undefined,
  calidadIds: ReadonlySet<string>,
  inicioInvestigacion?: string,
) {
  const inicio = inicioInvestigacion ? Date.parse(inicioInvestigacion) : NaN
  const cliente: QuejaAdjunto[] = []
  const antecedentes: QuejaAdjunto[] = []
  const propios: QuejaAdjunto[] = []
  for (const adjunto of adjuntos) {
    if (!adjunto.usuario_id) {
      cliente.push(adjunto)
    } else if (adjunto.usuario_id === responsableId && !calidadIds.has(adjunto.id)
      && !(Date.parse(adjunto.created_at) < inicio)) {
      propios.push(adjunto)
    } else {
      antecedentes.push(adjunto)
    }
  }
  return { cliente, antecedentes, propios }
}

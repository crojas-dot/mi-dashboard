import { MODULOS, type ModuloId } from '@/lib/constants/modulos'
import type { ColumnaInforme, IncluirInforme } from './tipos'

export type IconoInforme = 'quejas' | 'sacp' | 'documentos' | 'riesgos' | 'auditorias' | 'revision_direccion'

interface ConfiguracionInforme {
  moduloRuta: ModuloId
  iconKey: IconoInforme
  tabla: string
  campoFecha: string
  catalogos: { estado?: string; prioridad?: string; tipo?: string }
  campoDistribucion: string
  campoVencido: string
  columnas: ColumnaInforme[]
}

/** Los códigos de reportería son históricos: revision_direccion no es el ID de la ruta. */
export const CONFIG_INFORMES: Record<string, ConfiguracionInforme> = {
  quejas: {
    moduloRuta: 'quejas',
    iconKey: 'quejas',
    tabla: 'quejas',
    campoFecha: 'fecha',
    catalogos: { estado: 'estado_queja', prioridad: 'prioridad' },
    campoDistribucion: 'categoria',
    campoVencido: 'fecha_sla',
    columnas: [
      { key: 'folio', label: 'Folio' },
      { key: 'cliente_nombre', label: 'Cliente' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'prioridad', label: 'Prioridad' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha', label: 'Fecha' }
    ]
  },
  sacp: {
    moduloRuta: 'sacp',
    iconKey: 'sacp',
    tabla: 'acciones',
    campoFecha: 'fecha_apertura',
    catalogos: { estado: 'estado_sacp', tipo: 'tipo_sacp' },
    campoDistribucion: 'tipo',
    campoVencido: 'fecha_limite',
    columnas: [
      { key: 'folio', label: 'Folio' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_limite', label: 'Fecha Límite' }
    ]
  },
  documentos: {
    moduloRuta: 'documentos',
    iconKey: 'documentos',
    tabla: 'documentos',
    campoFecha: 'created_at',
    catalogos: { estado: 'estado_documento' },
    campoDistribucion: 'categoria',
    campoVencido: 'fecha_publicacion',
    columnas: [
      { key: 'codigo_doc', label: 'Código' },
      { key: 'titulo', label: 'Título' },
      { key: 'version_actual', label: 'Versión' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_publicacion', label: 'Fecha Publicación' }
    ]
  },
  riesgos: {
    moduloRuta: 'riesgos',
    iconKey: 'riesgos',
    tabla: 'riesgos',
    campoFecha: 'fecha_identificacion',
    catalogos: {},
    campoDistribucion: 'tipo',
    campoVencido: 'fecha_identificacion',
    columnas: [
      { key: 'folio', label: 'Folio' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'impacto', label: 'Impacto' },
      { key: 'probabilidad', label: 'Probabilidad' },
      { key: 'estado', label: 'Estado' }
    ]
  },
  auditorias: {
    moduloRuta: 'auditorias',
    iconKey: 'auditorias',
    tabla: 'auditorias',
    campoFecha: 'fecha_inicio',
    catalogos: { estado: 'estado_auditoria' },
    campoDistribucion: 'tipo',
    campoVencido: 'fecha_inicio',
    columnas: [
      { key: 'folio', label: 'Folio' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'proceso_area', label: 'Proceso/Área' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_inicio', label: 'Fecha Inicio' }
    ]
  },
  revision_direccion: {
    moduloRuta: 'revision',
    iconKey: 'revision_direccion',
    tabla: 'reuniones',
    campoFecha: 'fecha_programada',
    catalogos: {},
    campoDistribucion: 'tipo',
    campoVencido: 'fecha_programada',
    columnas: [
      { key: 'titulo', label: 'Título' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_programada', label: 'Fecha' }
    ]
  }
}

export const MODULOS_INFORME = Object.entries(CONFIG_INFORMES).map(([value, config]) => ({
  value, label: MODULOS[config.moduloRuta].label, iconKey: config.iconKey,
}))
export const columnasPorModulo: Record<string, ColumnaInforme[]> = Object.fromEntries(
  Object.entries(CONFIG_INFORMES).map(([id, config]) => [id, config.columnas]),
)
export const campoDistribucion: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG_INFORMES).map(([id, config]) => [id, config.campoDistribucion]),
)
export const campoVencido: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG_INFORMES).map(([id, config]) => [id, config.campoVencido]),
)
export const INCLUSIONES_INFORME: { key: keyof IncluirInforme; label: string }[] = [
  { key: 'tabla', label: 'Tabla de registros' },
  { key: 'resumen', label: 'Resumen por estado' },
  { key: 'vencidos', label: 'Registros vencidos / por vencer' },
  { key: 'distribucion', label: 'Distribución por categoría/tipo' },
]
export const TAMANO_LOTE_INFORME = 500
export const MAX_REGISTROS_INFORME = 5000
